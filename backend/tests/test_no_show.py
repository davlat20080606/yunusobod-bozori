"""«Xaridor kelmadi»: the worker waits, may give up only after the set time, the goods go back to the stalls."""
import asyncio
import sqlite3
from datetime import datetime, timedelta

from conftest import DB_FILE, BASE_ORDER, COURIER

MEAT, BEEF = 10, 11  # stall 2, meat category


def db():
    return sqlite3.connect(DB_FILE)


def backdate(order_id, column, minutes):
    with db() as c:
        c.execute(f"UPDATE orders SET {column} = ? WHERE id = ?",
                  ((datetime.utcnow() - timedelta(minutes=minutes)).isoformat(sep=" "), order_id))


def product(api, seller, product_id):
    return next(p for p in api("GET", "/seller/my-store", headers=seller)[1]["products"] if p["id"] == product_id)


def place(api, phone, **where):
    c, o = api("POST", "/orders", {**BASE_ORDER, "customer_phone": phone, **where,
                                   "items": [{"product_id": MEAT, "store_id": 2, "quantity": 1}]})
    assert c == 200, o
    return o


def collect(api, porter, stall, order):
    api("POST", f"/porter/orders/{order['id']}/take", None, porter)
    api("POST", f"/seller/orders/{order['id']}/handed", None, stall)
    for item in order["items"]:
        api("PATCH", f"/porter/items/{item['id']}/picked", {"is_picked": True}, porter)


def run_timers(now):
    from app.services import maintenance
    sent = []
    maintenance.notify_wait_reminder = lambda order_id, left: sent.append(("remind", order_id, left))
    maintenance.notify_no_show = lambda order_id: sent.append(("no_show", order_id))
    maintenance.notify_return_late = lambda order_id, minutes: sent.append(("late", order_id))
    result = asyncio.run(maintenance.no_show_timers(now))
    return result, sent


def waiting_since(order_id):
    with db() as c:
        return datetime.fromisoformat(c.execute("SELECT waiting_since FROM orders WHERE id = ?", (order_id,)).fetchone()[0])


def test_point_no_show_and_return(api, ok, sellers, make_staff, admin, relaxed_limits):
    stall, porter = sellers[1], make_staff("porter")
    api("POST", "/seller/stock", {"lines": [{"product_id": MEAT, "is_available": True, "quantity": 5}]}, stall)
    order = place(api, "+998 90 710-00-01", fulfillment="point", handoff_point="main_gate")
    collect(api, porter, stall, order)
    ok(product(api, stall, MEAT)["stock_quantity"] == 4, "1 kg left the stall with the aravachi")

    c, r = api("PATCH", f"/porter/orders/{order['id']}/status", {"status": "at_point"}, porter)
    ok(c == 200 and r["waiting_since"] and r["no_show_allowed_at"], "at the point: the waiting clock starts")
    ok(r["stops"][0]["items"][0]["cold"], "meat is marked as cold for the return list")
    c, r = api("POST", f"/porter/orders/{order['id']}/no-show", None, porter)
    ok(c == 409 and "15" in r["detail"], f"«Xaridor kelmadi» cannot be pressed right away: {r.get('detail')}")

    backdate(order["id"], "waiting_since", 16)
    c, r = api("POST", f"/porter/orders/{order['id']}/no-show", None, porter)
    ok(c == 200 and r["status"] == "no_show", "after 15 minutes the aravachi marks the no-show")
    ok(any(o["id"] == order["id"] for o in api("GET", "/porter/orders", headers=porter)[1]["mine"]),
       "the order stays on the aravachi's screen until the goods are back")
    with db() as c:
        fee = c.execute("SELECT no_show_fee FROM orders WHERE id = ?", (order["id"],)).fetchone()[0]
    ok(fee == 5000, f"the aravachi's lost fee is recorded: {fee}")

    c, _ = api("POST", f"/orders/{order['order_number']}/here")
    ok(c == 200, "the customer can say «Men shu yerdaman»")
    c, r = api("POST", f"/porter/orders/{order['id']}/undo-no-show", None, porter)
    ok(c == 200 and r["status"] == "at_point", "the customer came running: the aravachi takes the no-show back")

    backdate(order["id"], "waiting_since", 20)
    api("POST", f"/porter/orders/{order['id']}/no-show", None, porter)
    ok(api("POST", f"/admin/orders/{order['id']}/cancel", None, admin)[0] == 409, "a no-show cannot just be cancelled: the goods must go back")
    ok(api("POST", f"/seller/orders/{order['id']}/handed", None, stall)[0] == 409, "the seller cannot hand it over again")

    c, r = api("POST", f"/seller/orders/{order['id']}/returned", None, stall)
    ok(c == 200 and r["status"] == "returned", "«Qaytib oldim»: every stall has its goods, the order is closed")
    ok(product(api, stall, MEAT)["stock_quantity"] == 5, "the kilo is back in the stall's stock")
    ok(api("POST", f"/seller/orders/{order['id']}/returned", None, stall)[0] == 409, "it cannot be returned twice")
    ok(api("POST", f"/porter/orders/{order['id']}/undo-no-show", None, porter)[0] == 409, "too late to undo once it is back")
    kinds = [e["kind"] for e in api("GET", f"/admin/orders/{order['id']}/events", headers=admin)[1]]
    ok(all(k in kinds for k in ("no_show", "customer_here", "no_show_undone", "returned")), f"every step is in the order's history: {kinds}")
    with db() as c:
        moves = [k for (k,) in c.execute("SELECT kind FROM stock_moves WHERE order_id = ?", (order["id"],))]
    ok("return" in moves, f"the stock log shows the return: {moves}")


def test_courier_no_show_needs_arrival(api, ok, sellers, make_staff, relaxed_limits):
    stall, porter, taxi = sellers[1], make_staff("porter"), make_staff("taxi")
    order = place(api, "+998 90 710-00-02", **COURIER)
    collect(api, porter, stall, order)
    api("PATCH", f"/porter/orders/{order['id']}/status", {"status": "handed_over"}, porter)
    api("POST", f"/taxi/orders/{order['id']}/take", {"eta_minutes": 5}, taxi)
    api("PATCH", f"/taxi/orders/{order['id']}/status", {"status": "on_the_way"}, taxi)

    ok(api("POST", f"/taxi/orders/{order['id']}/no-show", None, taxi)[0] == 409, "no no-show before the driver says he has arrived")
    c, r = api("POST", f"/taxi/orders/{order['id']}/arrived", None, taxi)
    ok(c == 200 and r["waiting_since"], "«Yetib keldim» starts the clock")
    backdate(order["id"], "waiting_since", 16)
    c, r = api("POST", f"/taxi/orders/{order['id']}/no-show", None, taxi)
    ok(c == 200 and r["status"] == "no_show", "after 15 minutes at the door the driver marks the no-show")
    with db() as c:
        fee = c.execute("SELECT no_show_fee FROM orders WHERE id = ?", (order["id"],)).fetchone()[0]
    ok(fee == 15000, f"both the aravachi's and the taxi's fee are recorded: {fee}")
    ok(any(o["id"] == order["id"] for o in api("GET", "/taxi/orders", headers=taxi)[1]["mine"]), "the driver still sees it (bring it back)")

    # An hour later the goods are still not back: the Bozorkom is warned once
    backdate(order["id"], "no_show_at", 61)
    result, sent = run_timers(datetime.utcnow())
    ok(("late", order["id"]) in sent, f"goods outside the stall for an hour: warning sent ({result})")
    result, sent = run_timers(datetime.utcnow())
    ok(("late", order["id"]) not in sent, "and only once")


def test_self_pickup_timers_and_strikes(api, ok, sellers, admin):
    stall = sellers[1]
    phone = "+998 90 710-00-09"
    api("PUT", "/admin/settings", {"new_customer_max_open": 5, "max_open_orders": 5, "new_customer_max_total": 100_000_000}, admin)
    api("POST", "/seller/stock", {"lines": [{"product_id": MEAT, "is_available": True, "quantity": 5}]}, stall)

    for n in (1, 2):
        order = place(api, phone, fulfillment="self")
        c, r = api("POST", f"/seller/orders/{order['id']}/ready", None, stall)
        ok(c == 200 and r["status"] == "ready", f"order {n}: the stall packed it, the customer can come")
        ok(product(api, stall, MEAT)["available_quantity"] == 4, "the packed kilo is held for the customer")
        start = waiting_since(order["id"])

        result, sent = run_timers(start + timedelta(minutes=30))
        ok(not sent, "30 minutes: nothing yet")
        result, sent = run_timers(start + timedelta(minutes=61))
        ok(("remind", order["id"], 59) in sent, f"halfway: the customer is reminded ({sent})")
        result, sent = run_timers(start + timedelta(minutes=121))
        ok(("no_show", order["id"]) in sent, "after 2 hours nobody came: closed by the server")
        status = api("GET", f"/orders/{order['order_number']}")[1]["status"]
        ok(status == "returned", f"the goods never left the stall, so the order is closed at once: {status}")
        ok(product(api, stall, MEAT)["available_quantity"] == 5, "the kilo is on sale again")

    c, r = api("POST", "/orders", {**BASE_ORDER, "customer_phone": phone, "fulfillment": "self",
                                   "items": [{"product_id": MEAT, "store_id": 2, "quantity": 1}]})
    ok(c == 403 and "2 marta" in r["detail"], f"two no-shows: new orders are closed: {r.get('detail', '')[:70]}")
    customer = next(x for x in api("GET", "/admin/customers?q=907100009", headers=admin)[1])
    ok(customer["no_shows"] == 2, f"the Bozorkom sees 2 no-shows: {customer['no_shows']}")
    ok(api("POST", f"/admin/customers/{customer['phone_key']}/forgive", None, admin)[0] == 200, "the Bozorkom forgives")
    ok(place(api, phone, fulfillment="self")["order_number"], "and the customer can order again")
