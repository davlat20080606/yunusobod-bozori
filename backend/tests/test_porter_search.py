"""No aravachi took an Express order in 7 minutes: the customer waits 3 more minutes, collects at the stalls or cancels."""
import sqlite3
from datetime import datetime, timedelta

from conftest import DB_FILE


def set_search_until(order_id, when):
    with sqlite3.connect(DB_FILE) as con:
        con.execute("UPDATE orders SET search_until=? WHERE id=?", (when.strftime("%Y-%m-%d %H:%M:%S.%f") if when else None, order_id))


def test_porter_search(api, ok, admin, sellers, relaxed_limits):
    H = sellers[0]
    for pr in api("GET", "/seller/promos", headers=H)[1]:
        api("DELETE", f"/seller/promos/{pr['id']}", headers=H)
    p = [p for p in api("GET", "/seller/my-store", headers=H)[1]["products"] if p["is_available"]][0]
    items = [{"product_id": p["id"], "store_id": p["store_id"], "quantity": 2}]
    ok(api("POST", "/seller/promos", {"kind": "delivery", "min_amount": 1000, "amount": 10000}, H)[0] == 200, "stall pays 10 000 of delivery")
    body = {"customer_name": "Test", "customer_phone": "+998901234567", "delivery_time_slot": "Morning (09:00-11:00)",
            "payment_method": "cash", "fulfillment": "courier", "handoff_point": "main_gate", "delivery_address": "Yunusobod 4",
            "delivery_lat": 41.36, "delivery_lng": 69.29, "items": items}
    c, o = api("POST", "/orders", body)
    ok(c == 200 and o["search_until"] is None, "scheduled order: no 7-minute search")
    num = o["order_number"]
    ok(api("POST", f"/orders/{num}/self-pickup")[0] == 409, "no search, no switch")
    ok(api("POST", f"/orders/{num}/extend-search")[0] == 409, "no search, no extension")

    # As if it were an Express order whose 7 minutes ran out
    set_search_until(o["id"], datetime.utcnow() - timedelta(seconds=5))
    c, e = api("POST", f"/orders/{num}/extend-search")
    left = (datetime.fromisoformat(e["search_until"]) - datetime.utcnow()).total_seconds() if c == 200 else 0
    ok(c == 200 and 170 < left <= 180, f"wait 3 more minutes ({left:.0f} s)")

    before = api("GET", f"/orders/{num}")[1]
    ok(before["delivery_fee"] > 0, f"courier fee before: {before['delivery_fee']}")
    c, s = api("POST", f"/orders/{num}/self-pickup")
    subtotal = sum(i["total_price"] for i in s["items"]) if c == 200 else 0
    ok(c == 200 and s["fulfillment"] == "self" and s["handoff_point"] is None and s["search_until"] is None, "switched to self pickup")
    ok(s["delivery_fee"] == 0 and s["discount_amount"] == 10000 and s["total_amount"] == subtotal - 10000,
       f"no delivery fee, stall bonus becomes a discount: total {s['total_amount']}")
    ok(all(b["kind"] != "covers_taxi" and b["kind"] != "covers_porter" for b in s["bonuses"]), "no taxi/aravachi bonus rows left")
    ok(api("POST", f"/orders/{num}/self-pickup")[0] == 409, "cannot switch twice")
    ok(api("POST", f"/orders/{num}/cancel")[0] == 200, "still cancellable for free")

    # An aravachi already took it: the options are gone
    c, o2 = api("POST", "/orders", body)
    set_search_until(o2["id"], datetime.utcnow() - timedelta(seconds=5))
    with sqlite3.connect(DB_FILE) as con:
        con.execute("UPDATE orders SET porter_phone='+998900000000', status='picking' WHERE id=?", (o2["id"],))
    ok(api("POST", f"/orders/{o2['order_number']}/self-pickup")[0] == 409, "aravachi found: no switch")
    for pr in api("GET", "/seller/promos", headers=H)[1]:
        api("DELETE", f"/seller/promos/{pr['id']}", headers=H)
