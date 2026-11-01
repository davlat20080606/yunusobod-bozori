"""Step 6: the Bozorkom's numbers match the orders, the evening report goes once, server errors reach the
Bozorkom (not too often), and a backup can be restored row for row."""
import asyncio
import logging
import sqlite3
import urllib.request
from datetime import date, datetime, timedelta

import pytest

from conftest import DB_FILE, RUN_DIR, BASE_ORDER

MEAT, BEEF = 10, 11  # stall 2


def place(api, phone, **extra):
    c, o = api("POST", "/orders", {**BASE_ORDER, "customer_phone": phone, "fulfillment": "point", "handoff_point": "main_gate",
                                   "items": [{"product_id": MEAT, "store_id": 2, "quantity": 1}], **extra})
    assert c == 200, o
    return o


def test_analytics_match_the_orders(api, ok, sellers, make_staff, admin, relaxed_limits):
    before = api("GET", "/admin/analytics?days=1", headers=admin)[1]
    porter = make_staff("porter", "Analitika Aravachi")

    # A: collected, brought to the point, handed over with the customer's code
    a = place(api, "+998 90 740-00-01")
    api("POST", f"/porter/orders/{a['id']}/take", None, porter)
    api("POST", f"/seller/orders/{a['id']}/handed", None, sellers[1])
    for item in a["items"]:
        api("PATCH", f"/porter/items/{item['id']}/picked", {"is_picked": True}, porter)
    api("PATCH", f"/porter/orders/{a['id']}/status", {"status": "at_point"}, porter)
    c, r = api("PATCH", f"/porter/orders/{a['id']}/status", {"status": "delivered", "code": a["handoff_code"]}, porter)
    assert c == 200, r
    a_total = api("GET", f"/orders/{a['order_number']}")[1]["total_amount"]
    # B: cancelled by the customer; its beef had run out
    b = place(api, "+998 90 740-00-02", items=[{"product_id": BEEF, "store_id": 2, "quantity": 1}])
    api("POST", f"/orders/{b['order_number']}/cancel")
    with sqlite3.connect(DB_FILE) as conn:
        conn.execute("UPDATE order_items SET item_status = 'missing' WHERE order_id = ?", (b["id"],))
    # C: still open
    place(api, "+998 90 740-00-03")

    c, after = api("GET", "/admin/analytics?days=1", headers=admin)
    ok(c == 200, "the Bozorkom opens «Tahlil»")
    ok(after["orders"] - before["orders"] == 3, f"3 new orders today ({before['orders']} → {after['orders']})")
    ok(after["delivered"] - before["delivered"] == 1, "1 delivered")
    ok(after["cancelled"] - before["cancelled"] == 1, "1 cancelled")
    ok(after["open"] - before["open"] == 1, "1 still open")
    ok(round(after["revenue"] - before["revenue"]) == round(a_total), f"sales = the delivered order's total ({a_total})")
    ok(after["avg_check"] == (round(after["revenue"] / after["delivered"]) if after["delivered"] else 0), "average check = sales / delivered")
    ok(sum(map(sum, after["heatmap"])) - sum(map(sum, before["heatmap"])) == 3, "all 3 are on the weekday × hour map")
    ok(after["stages"]["total"]["count"] - before["stages"]["total"]["count"] == 1, "the delivered order has its stage times")
    beef = next((m for m in after["missing"] if m["product"] == b["items"][0]["product_name"]), None)
    ok(beef and beef["count"] >= 1, f"the sold-out beef is in «Tugadi»: {after['missing'][:2]}")
    ok(any(p["name"] == "Analitika Aravachi" and p["delivered"] == 1 for p in after["porters"]), "the aravachi is credited with it")
    ok(after["stalls"] and after["stalls"][0]["sales"] > 0, "stalls by sales")

    req = urllib.request.Request(api.base + "/admin/analytics.csv?days=1", headers=admin)
    with urllib.request.urlopen(req) as resp:
        csv_text = resp.read().decode("utf-8-sig")
    ok(a["order_number"] in csv_text and "delivered" in csv_text, "the CSV has one line per order")
    ok("740-00-01" not in csv_text and "740000001" not in csv_text, "and no customer phones (the file gets passed around)")
    ok(api("GET", "/admin/analytics?days=1")[0] in (401, 403), "only the Bozorkom sees it")


def test_stage_times_from_the_event_log():
    from app.services.analytics import stage_minutes, p90

    class E:
        def __init__(self, to, minute):
            self.kind, self.to_status, self.created_at = "status", to, datetime(2026, 11, 1, 10, 0) + timedelta(minutes=minute)

    class O:
        created_at = datetime(2026, 11, 1, 10, 0)

    times = stage_minutes(O(), [E("picking", 4), E("handed_over", 20), E("on_the_way", 25), E("delivered", 50), E("delivered", 70)])
    assert times == {"to_porter": 4, "collecting": 16, "to_customer": 30, "total": 50}
    assert p90(list(range(1, 11))) == 10 and p90([]) is None


def test_daily_report_once_an_evening(api, admin):
    from app.services import maintenance
    import app.bot.notify as notify
    sent = []

    async def fake_send(report):
        sent.append(report)
        return True
    notify.send_daily_report = fake_send
    evening = datetime(2026, 11, 2, 16, 10)  # 21:10 in Tashkent
    assert asyncio.run(maintenance.daily_report(datetime(2026, 11, 2, 12, 0))) is False  # 17:00: not yet
    assert asyncio.run(maintenance.daily_report(evening)) is True
    assert asyncio.run(maintenance.daily_report(evening + timedelta(minutes=5))) is False
    assert len(sent) == 1 and sent[0]["days"] == 1 and sent[0]["to"] == "2026-11-02"


def test_server_errors_reach_the_bozorkom_once_in_10_minutes():
    from app.services import alerts
    import app.bot.notify as notify
    got = []

    async def fake_alert(where, summary):
        got.append(summary)
    notify.send_error_alert = fake_alert
    alerts._last_sent.clear()

    async def scenario():
        log = logging.getLogger("app.api.test")
        handler = alerts.AdminAlertHandler()
        log.addHandler(handler)
        try:
            for _ in range(3):
                log.error("Neon is not answering")
            log.warning("just a warning")
            try:
                1 / 0
            except ZeroDivisionError:
                log.exception("Order failed")
            logging.getLogger("app.bot.notify").error("cannot send")  # would loop: never alerted
            await asyncio.sleep(0.05)
        finally:
            log.removeHandler(handler)

    asyncio.run(scenario())
    assert got[0] == "Neon is not answering"
    assert len(got) == 2 and "ZeroDivisionError" in got[1], got


def test_backup_restores_row_for_row(api, admin, sellers):
    from sqlalchemy.ext.asyncio import create_async_engine
    from app.services import backup
    from app.services.migrate import upgrade

    source = create_async_engine(f"sqlite+aiosqlite:///{DB_FILE}")
    target_file = RUN_DIR / "restored.db"
    target_file.unlink(missing_ok=True)
    target = create_async_engine(f"sqlite+aiosqlite:///{target_file}")

    async def run():
        async with source.connect() as conn:
            data = await conn.run_sync(backup.dump_tables)
        blob = backup.pack(data, key="test-key")
        assert b"+998" not in blob and b"Yosh" not in blob  # encrypted: nothing readable in R2
        with pytest.raises(Exception):
            backup.unpack(blob, key="wrong-key")
        copy = backup.unpack(blob, key="test-key")
        async with target.begin() as conn:
            await conn.run_sync(upgrade)
            counts = await conn.run_sync(backup.load_tables, copy)
        await source.dispose()
        await target.dispose()
        return data, counts

    data, counts = asyncio.run(run())
    assert data["schema"] and data["tables"]["orders"], "the copy has the schema version and the orders"
    assert {name: len(rows) for name, rows in data["tables"].items()} == {name: counts[name] for name in data["tables"]}
    with sqlite3.connect(DB_FILE) as a, sqlite3.connect(target_file) as b:
        query = "SELECT order_number, customer_phone, total_amount, created_at, status FROM orders ORDER BY id"
        assert a.execute(query).fetchall() == b.execute(query).fetchall(), "orders are identical after the restore"
        assert a.execute("SELECT COUNT(*) FROM order_events").fetchone() == b.execute("SELECT COUNT(*) FROM order_events").fetchone()
    # The restored database keeps working: new rows get new ids
    with sqlite3.connect(target_file) as b:
        top = b.execute("SELECT MAX(id) FROM orders").fetchone()[0]
        b.execute("INSERT INTO orders (order_number, customer_name, customer_phone, delivery_address, delivery_time_slot,"
                  " total_amount, payment_method, status) VALUES ('YB-NEW', 'x', 'x', 'x', 'x', 1, 'cash', 'pending')")
        assert b.execute("SELECT id FROM orders WHERE order_number = 'YB-NEW'").fetchone()[0] > top


def test_backup_keeps_two_weeks_and_mondays():
    from app.services.backup import to_keep, status
    today = date(2026, 11, 2)  # a Monday
    days = [today - timedelta(days=n) for n in range(80)]
    keep = to_keep(days, today)
    assert all(today - timedelta(days=n) in keep for n in range(14)), "the last 14 days"
    old_mondays = [d for d in days if (today - d).days >= 14 and d in keep]
    assert old_mondays and all(d.weekday() == 0 for d in old_mondays) and len(old_mondays) == 6, old_mondays
    assert date(2026, 8, 17) not in keep, "nothing older than 8 weeks"
    assert status().startswith("off"), "no BACKUP_KEY in tests: backups are off, and /api/health says so"


def test_health_shows_backup_state(api):
    c, health = api("GET", "/health")
    assert c == 200 and health["backup"] == "off (missing: BACKUP_KEY)"
    c, r = api("POST", "/admin/backup", None, {"x-admin-token": "nope"})
    assert c in (401, 403)
