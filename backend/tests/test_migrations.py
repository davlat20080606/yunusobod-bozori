"""Migrations: a new database and one made before migrations both end up on the latest schema.

Runs on SQLite by default; CI also runs it on Postgres (TEST_POSTGRES_URL), like production.
"""
import asyncio
import os

import pytest
from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import inspect, text
from sqlalchemy.ext.asyncio import create_async_engine

from conftest import RUN_DIR
from app.database import Base
from app.services.migrate import ALEMBIC_INI, AFTER_BASELINE, upgrade

HEAD = ScriptDirectory.from_config(Config(str(ALEMBIC_INI))).get_current_head()


def database_urls():
    urls = [pytest.param(f"sqlite+aiosqlite:///{RUN_DIR / 'migrate.db'}", id="sqlite")]
    if os.environ.get("TEST_POSTGRES_URL"):
        urls.append(pytest.param(os.environ["TEST_POSTGRES_URL"], id="postgres"))
    return urls


def run(url, fn):
    async def go():
        engine = create_async_engine(url)
        try:
            async with engine.begin() as conn:
                return await conn.run_sync(fn)
        finally:
            await engine.dispose()
    return asyncio.run(go())


def wipe(conn):
    if conn.dialect.name == "postgresql":
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    else:
        for table in inspect(conn).get_table_names():
            conn.execute(text(f'DROP TABLE IF EXISTS "{table}"'))


def check_no_drift(conn):
    """The models and the migrations describe the same schema."""
    config = Config(str(ALEMBIC_INI))
    config.attributes["connection"] = conn
    command.check(config)


def version(conn):
    return conn.execute(text("SELECT version_num FROM alembic_version")).scalar()


@pytest.mark.parametrize("url", database_urls())
def test_new_database(url):
    run(url, wipe)
    run(url, upgrade)
    assert run(url, version) == HEAD
    assert AFTER_BASELINE <= set(run(url, lambda c: inspect(c).get_table_names()))
    run(url, check_no_drift)
    # Running again on every start changes nothing
    run(url, upgrade)
    assert run(url, version) == HEAD


@pytest.mark.parametrize("url", database_urls())
def test_database_made_before_migrations(url):
    """Like production today: tables from create_all, some columns added later by hand, real rows."""
    def make_old(conn):
        Base.metadata.create_all(conn, tables=[t for n, t in Base.metadata.tables.items() if n not in AFTER_BASELINE])
        conn.execute(text("ALTER TABLE orders DROP COLUMN handoff_code"))
        conn.execute(text("ALTER TABLE order_items DROP COLUMN weight_status"))
        # Added by migration 0003, so a database from before migrations does not have them
        conn.execute(text("DROP INDEX ix_orders_phone_key"))
        conn.execute(text("DROP INDEX ix_orders_customer_tg_id"))
        conn.execute(text("ALTER TABLE orders DROP COLUMN phone_key"))
        # ... and migration 0004
        for table, column in (("products", "track_stock"), ("products", "stock_reserved"), ("products", "low_stock_alert"),
                              ("order_items", "stock_reserved_qty"),
                              # ... and migration 0005
                              ("orders", "waiting_since"), ("orders", "wait_reminded"), ("orders", "no_show_at"),
                              ("orders", "no_show_fee"), ("orders", "no_show_forgiven"), ("orders", "return_alert_sent"),
                              ("orders", "returned_at"), ("order_items", "returned"),
                              # ... and migration 0006
                              ("orders", "taxi_taken_at"), ("orders", "left_bazaar_at"), ("orders", "taxi_reassign_count"),
                              ("orders", "taxi_lat"), ("orders", "taxi_lng"), ("orders", "taxi_loc_at"), ("orders", "late_alert_sent")):
            conn.execute(text(f"ALTER TABLE {table} DROP COLUMN {column}"))
        conn.execute(text(
            "INSERT INTO orders (order_number, customer_name, customer_phone, delivery_address, delivery_time_slot, total_amount, delivery_fee,"
            " payment_method, payment_status, status, created_at)"
            " VALUES ('YB-OLD-1', 'Eski', '+998900000000', 'Yunusobod', 'Morning', 50000, 0, 'cash', 'pending', 'delivered', CURRENT_TIMESTAMP)"))

    run(url, wipe)
    run(url, make_old)
    run(url, upgrade)
    assert run(url, version) == HEAD
    columns = run(url, lambda c: {col["name"] for col in inspect(c).get_columns("orders")})
    assert "handoff_code" in columns
    # Old orders get their phone key from the number as it was typed
    assert run(url, lambda c: c.execute(text("SELECT phone_key FROM orders WHERE order_number = 'YB-OLD-1'")).scalar()) == "900000000"
    assert run(url, lambda c: c.execute(text("SELECT customer_name FROM orders WHERE order_number = 'YB-OLD-1'")).scalar()) == "Eski"
    assert "order_events" in run(url, lambda c: inspect(c).get_table_names())


@pytest.mark.parametrize("url", database_urls())
def test_backup_restores_into_this_database(url):
    """A nightly copy goes back into Postgres (production) and SQLite alike: dates, JSON, binary, and new ids
    continue after the restored ones."""
    from app.services import backup
    source = f"sqlite+aiosqlite:///{RUN_DIR / 'backup_source.db'}"

    def fill(conn):
        conn.execute(text(
            "INSERT INTO orders (order_number, customer_name, customer_phone, delivery_address, delivery_time_slot, total_amount,"
            " delivery_fee, payment_method, payment_status, status, created_at, taxi_reassign_count)"
            " VALUES ('YB-BAK-1', 'Aziza', '+998901112233', 'Yunusobod', 'Morning', 81000, 0, 'cash', 'pending', 'delivered',"
            " '2026-11-01 10:00:00', 1)"))
        conn.execute(text("INSERT INTO order_events (order_id, kind, actor_role, data, created_at)"
                          " VALUES (1, 'status', 'porter', '{\"eta_minutes\": 5}', '2026-11-01 10:05:00')"))
        conn.execute(text("INSERT INTO media (filename, content_type, data) VALUES ('a.jpg', 'image/jpeg', :data)"),
                     {"data": b"\x00\xffphoto"})

    run(source, wipe)
    run(source, upgrade)
    run(source, fill)
    data = backup.unpack(backup.pack(run(source, backup.dump_tables), key="k"), key="k")

    run(url, wipe)
    run(url, upgrade)
    counts = run(url, lambda c: backup.load_tables(c, data))
    assert counts["orders"] == 1 and counts["order_events"] == 1 and counts["media"] == 1
    row = run(url, lambda c: c.execute(text("SELECT total_amount, created_at, taxi_reassign_count FROM orders")).one())
    assert row[0] == 81000 and str(row[1]).startswith("2026-11-01 10:00") and row[2] == 1
    assert run(url, lambda c: c.execute(text("SELECT data FROM media")).scalar()) == b"\x00\xffphoto"
    event = run(url, lambda c: c.execute(text("SELECT data FROM order_events")).scalar())
    assert (event if isinstance(event, dict) else __import__("json").loads(event)) == {"eta_minutes": 5}
    new_id = run(url, lambda c: c.execute(text(
        "INSERT INTO orders (order_number, customer_name, customer_phone, delivery_address, delivery_time_slot, total_amount,"
        " delivery_fee, payment_method, payment_status, status) VALUES ('YB-BAK-2', 'x', 'x', 'x', 'x', 1, 0, 'cash', 'pending', 'pending')"
        " RETURNING id")).scalar())
    assert new_id == 2, "new orders continue after the restored ones"
