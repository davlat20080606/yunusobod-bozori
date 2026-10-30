"""Brings the database to the latest schema on startup with Alembic migrations (backend/migrations).

A database made before migrations existed has no alembic_version table: it is first brought up
to the baseline (0001) the way the server used to do it, stamped, and then upgraded like any other.
"""
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import inspect

from app.database import Base, engine

BASELINE = "0001"
# Tables created by migrations after the baseline; the legacy bring-up must not make them
AFTER_BASELINE = {"order_events"}
ALEMBIC_INI = Path(__file__).resolve().parents[2] / "alembic.ini"

# Columns added before migrations existed (create_all does not alter existing tables)
LEGACY_COLUMNS = {
    "orders": [("porter_name", "VARCHAR(100)"), ("porter_phone", "VARCHAR(50)"), ("porter_accepted_at", "{dt}"),
               ("delivery_lat", "FLOAT"), ("delivery_lng", "FLOAT"),
               ("taxi_name", "VARCHAR(100)"), ("taxi_phone", "VARCHAR(50)"),
               ("fulfillment", "VARCHAR(20) DEFAULT 'courier'"), ("handoff_point", "VARCHAR(30)"),
               ("discount_amount", "FLOAT DEFAULT 0"), ("customer_confirmed_at", "{dt}"),
               ("handoff_code", "VARCHAR(6)"), ("handed_over_at", "{dt}"), ("taxi_eta_at", "{dt}"),
               ("cold_alert_sent", "BOOLEAN DEFAULT FALSE")],
    "promos": [("amount", "FLOAT"), ("gift_product_id", "INTEGER"), ("gift_qty", "FLOAT")],
    "order_bonuses": [("text_ru", "VARCHAR(200)"), ("text_en", "VARCHAR(200)")],
    "order_items": [("seller_ready", "BOOLEAN DEFAULT FALSE"), ("seller_handed", "BOOLEAN DEFAULT FALSE"),
                    ("actual_quantity", "FLOAT"), ("item_status", "VARCHAR(20) DEFAULT 'ok'"),
                    ("weight_status", "VARCHAR(20)"), ("weight_photo_url", "VARCHAR(500)")],
}


def legacy_bring_up(conn):
    Base.metadata.create_all(conn, tables=[t for name, t in Base.metadata.tables.items() if name not in AFTER_BASELINE])
    dt = "TIMESTAMP" if conn.dialect.name == "postgresql" else "DATETIME"
    for table, columns in LEGACY_COLUMNS.items():
        have = {c["name"] for c in inspect(conn).get_columns(table)}
        for col, col_type in columns:
            if col not in have:
                conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {col} {col_type.format(dt=dt)}")
    if "status" not in {c["name"] for c in inspect(conn).get_columns("stores")}:
        # Stalls that already exist were added by the administration, so they count as approved
        conn.exec_driver_sql("ALTER TABLE stores ADD COLUMN status VARCHAR(20) DEFAULT 'approved'")
        conn.exec_driver_sql("UPDATE stores SET status = 'approved'")


def upgrade(conn):
    config = Config(str(ALEMBIC_INI))
    config.attributes["connection"] = conn
    tables = set(inspect(conn).get_table_names())
    if "alembic_version" not in tables and "orders" in tables:
        legacy_bring_up(conn)
        command.stamp(config, BASELINE)
    command.upgrade(config, "head")


async def migrate():
    async with engine.begin() as conn:
        await conn.run_sync(upgrade)
