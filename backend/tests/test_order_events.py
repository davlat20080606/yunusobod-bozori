"""Order event log: every step is written with who did it, and only Bozorkom can read it."""
import asyncio
import sqlite3

from conftest import BASE_ORDER, COURIER, DB_FILE


def events(api, admin, order_id):
    return api("GET", f"/admin/orders/{order_id}/events", h=admin)[1]


def test_courier_order_history(api, ok, admin, sellers, make_staff):
    porter, taxi = make_staff("porter"), make_staff("taxi")
    # beef 1 kg from stall 2, tomato 1 kg from stall 1
    items = [{"product_id": 11, "store_id": 2, "quantity": 1}, {"product_id": 6, "store_id": 1, "quantity": 1}]
    c, order = api("POST", "/orders", {**BASE_ORDER, **COURIER, "items": items})
    oid, num = order["id"], order["order_number"]
    ok(c == 200, "courier order created")

    api("POST", f"/porter/orders/{oid}/take", {}, porter)
    api("POST", f"/seller/orders/{oid}/handed", h=sellers[1])
    beef = [i for i in order["items"] if i["product_id"] == 11][0]
    tomato = [i for i in order["items"] if i["product_id"] == 6][0]
    api("PATCH", f"/porter/items/{beef['id']}/weight", {"actual_quantity": 1.03}, porter)
    api("PATCH", f"/porter/items/{beef['id']}/weight", {"actual_quantity": 1.3}, porter)  # refused: not logged
    api("POST", f"/porter/items/{tomato['id']}/missing", {"missing": True}, porter)
    api("PATCH", f"/porter/items/{beef['id']}/picked", {"is_picked": True}, porter)
    api("PATCH", f"/porter/orders/{oid}/status", {"status": "handed_over"}, porter)
    api("POST", f"/taxi/orders/{oid}/take", {"eta_minutes": 7}, taxi)
    api("PATCH", f"/taxi/orders/{oid}/status", {"status": "on_the_way"}, taxi)
    api("PATCH", f"/taxi/orders/{oid}/status", {"status": "delivered", "code": order["handoff_code"]}, taxi)
    api("POST", f"/orders/{num}/received")

    log = events(api, admin, oid)
    steps = [(e["kind"], e["to_status"], e["actor_role"]) for e in log]
    ok(steps[0] == ("created", "pending", "customer"), f"first event is the customer's order: {steps[:1]}")
    expected = [
        ("status", "picking", "porter"),
        ("seller_handed", None, "seller"),
        ("weight", None, "porter"),
        ("missing", None, "porter"),
        ("status", "handed_over", "porter"),
        ("taxi_taken", None, "taxi"),
        ("status", "on_the_way", "taxi"),
        ("status", "delivered", "taxi"),
        ("received", None, "customer"),
    ]
    ok(steps[1:] == expected, f"every step in order with the right actor: {steps[1:]}")
    weights = [e["data"] for e in log if e["kind"] == "weight"]
    ok(weights == [{"item_id": beef["id"], "ordered": 1.0, "actual": 1.03}], f"only the accepted weight is logged: {weights}")
    ok(all(e["actor_id"] for e in log if e["actor_role"] in ("porter", "taxi", "seller")), "workers are logged with their id")
    ok([e["from_status"] for e in log if e["kind"] == "status"][0] == "pending", "status events keep the previous status")
    ok(len(set(e["created_at"] for e in log)) >= 1 and all(e["created_at"] for e in log), "every event has a time")

    ok(api("GET", f"/admin/orders/{oid}/events")[0] == 401, "the log is closed without a Bozorkom sign-in")
    ok(api("GET", f"/admin/orders/{oid}/events", h=porter)[0] == 401, "a worker cannot read it")


def test_cancel_and_system_events(api, ok, admin):
    c, order = api("POST", "/orders", {**BASE_ORDER, "fulfillment": "self", "items": [{"product_id": 10, "store_id": 2, "quantity": 1}]})
    api("POST", f"/orders/{order['order_number']}/cancel")
    log = events(api, admin, order["id"])
    ok([(e["kind"], e["to_status"], e["actor_role"]) for e in log][-1] == ("status", "cancelled", "customer"), "customer cancel is logged")

    c, order = api("POST", "/orders", {**BASE_ORDER, "fulfillment": "self", "items": [{"product_id": 10, "store_id": 2, "quantity": 1}]})
    api("POST", f"/admin/orders/{order['id']}/cancel", h=admin)
    ok(events(api, admin, order["id"])[-1]["actor_role"] == "admin", "Bozorkom cancel is logged as admin")

    # Nobody took it for a day: the server cancels it by itself
    c, order = api("POST", "/orders", {**BASE_ORDER, "fulfillment": "self", "items": [{"product_id": 10, "store_id": 2, "quantity": 1}]})
    db = sqlite3.connect(DB_FILE)
    db.execute("update orders set created_at=datetime('now','-25 hours') where id=?", (order["id"],))
    db.commit()
    from app.services import maintenance
    asyncio.run(maintenance.cancel_stale_orders())
    last = events(api, admin, order["id"])[-1]
    ok((last["to_status"], last["actor_role"]) == ("cancelled", "system"), f"auto-cancel is logged as system: {last}")
