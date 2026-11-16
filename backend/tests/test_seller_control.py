"""Seller control (Shuhrat): an Express order a stall has not packed gets a reminder to the stall, then the bozorkom
and the customer are told; each only once. The Bozorkom panel shows each stall's reliability."""
import asyncio
from datetime import datetime, timedelta

from test_no_show import backdate
from conftest import BASE_ORDER

TOMATO, MEAT = 6, 10  # stall 1 and stall 2


def run(now):
    from app.services import maintenance
    sent = []
    maintenance.notify_seller_remind = lambda o, s, m: sent.append(("remind", o, s))
    maintenance.notify_seller_late = lambda o, s, m: sent.append(("late", o, s))
    return asyncio.run(maintenance.seller_timers(now)), sent


def test_late_stall_reminded_then_reported(api, ok, sellers, admin, relaxed_limits):
    c, o = api("POST", "/orders", {**BASE_ORDER, "customer_phone": "+998 90 720-00-01", "fulfillment": "self",
                                   "delivery_time_slot": "Express (45-60 min)",
                                   "items": [{"product_id": TOMATO, "store_id": 1, "quantity": 1},
                                             {"product_id": MEAT, "store_id": 2, "quantity": 1}]})
    ok(c == 200, f"express order with two stalls ({c})")
    api("POST", f"/seller/orders/{o['id']}/ready", None, sellers[1])  # stall 2 packs at once

    now = datetime.utcnow()
    ok(run(now)[1] == [], "a fresh order: nothing")
    backdate(o["id"], "created_at", 16)
    result, sent = run(now)
    ok(sent == [("remind", o["id"], 1)], f"16 min: only the stall that has not packed gets a reminder {sent}")
    ok(run(now)[1] == [], "the reminder is sent once")

    backdate(o["id"], "created_at", 26)
    result, sent = run(now)
    ok(sent == [("late", o["id"], 1)], f"26 min: the bozorkom and the customer are told {sent}")
    ok(run(now)[1] == [], "and only once")
    events = api("GET", f"/admin/orders/{o['id']}/events", None, admin)[1]
    kinds = [e["kind"] for e in (events if isinstance(events, list) else events.get("events", []))]
    ok("seller_reminded" in kinds and "seller_late" in kinds, "both steps are in the order's history")

    stores = {s["id"]: s for s in api("GET", "/admin/stores", None, admin)[1]}
    ok(stores[1]["late_30d"] >= 1 and stores[1]["orders_30d"] >= 1 and stores[2]["late_30d"] == 0,
       f"reliability: stall 1 late {stores[1]['late_30d']}/{stores[1]['orders_30d']}, stall 2 late {stores[2]['late_30d']}")

    # Packing stops it; scheduled (not Express) orders are not timed
    c, o2 = api("POST", "/orders", {**BASE_ORDER, "customer_phone": "+998 90 720-00-02", "fulfillment": "self",
                                    "items": [{"product_id": TOMATO, "store_id": 1, "quantity": 1}]})
    backdate(o2["id"], "created_at", 40)
    ok(all(x[1] != o2["id"] for x in run(now)[1]), "a scheduled order is not timed")


def test_settings_tunable(api, ok, admin):
    c, r = api("PUT", "/admin/settings", {"seller_remind_min": 10, "seller_alert_min": 20}, admin)
    ok(c == 200 and r["seller_remind_min"] == 10 and r["seller_alert_min"] == 20, "the bozorkom can change both times")
    api("PUT", "/admin/settings", {"seller_remind_min": 15, "seller_alert_min": 25}, admin)
