"""Taxi control: a taxi that never comes to the gate loses the order, a long trip is reported, the customer sees the car."""
import asyncio
import sqlite3
from datetime import datetime, timedelta

from conftest import DB_FILE, BASE_ORDER, COURIER

MEAT = 10  # stall 2


def db():
    return sqlite3.connect(DB_FILE)


def backdate(order_id, column, minutes):
    with db() as c:
        c.execute(f"UPDATE orders SET {column} = ? WHERE id = ?",
                  ((datetime.utcnow() - timedelta(minutes=minutes)).isoformat(sep=" "), order_id))


def at_gate(api, sellers, porter, phone):
    """A courier order collected and brought to the gate by the aravachi."""
    c, order = api("POST", "/orders", {**BASE_ORDER, "customer_phone": phone, **COURIER,
                                       "items": [{"product_id": MEAT, "store_id": 2, "quantity": 1}]})
    assert c == 200, order
    api("POST", f"/porter/orders/{order['id']}/take", None, porter)
    api("POST", f"/seller/orders/{order['id']}/handed", None, sellers[1])
    for item in order["items"]:
        api("PATCH", f"/porter/items/{item['id']}/picked", {"is_picked": True}, porter)
    c, r = api("PATCH", f"/porter/orders/{order['id']}/status", {"status": "handed_over"}, porter)
    assert c == 200, r
    return order


def staff_row(api, headers):
    me = api("GET", "/staff/me", headers=headers)[1]
    return me["id"], me["phone"]


def run_timers(now=None):
    from app.services import maintenance
    sent = []
    maintenance.notify_taxi_released = lambda order_id, tg, alert: sent.append(("released", order_id, alert))
    maintenance.notify_trip_late = lambda order_id, minutes: sent.append(("late", order_id))
    result = asyncio.run(maintenance.taxi_timers(now))
    return result, sent


def incidents(staff_id):
    with db() as c:
        return [k for (k,) in c.execute("SELECT kind FROM staff_incidents WHERE staff_id = ?", (staff_id,))]


def test_taxi_late_to_gate_loses_the_order(api, ok, sellers, make_staff, admin, relaxed_limits):
    porter, late_taxi, other_taxi = make_staff("porter"), make_staff("taxi"), make_staff("taxi")
    order = at_gate(api, sellers, porter, "+998 90 720-00-01")

    c, r = api("POST", f"/taxi/orders/{order['id']}/take", {"eta_minutes": 5}, late_taxi)
    ok(c == 200 and r["taxi_gate_deadline"], f"the taxi promises 5 minutes; the deadline is shown: {r.get('taxi_gate_deadline')}")
    result, sent = run_timers()
    ok(not sent, "on time: nothing happens")

    backdate(order["id"], "taxi_eta_at", 4)  # the promised time passed 4 minutes ago: within the 5 minutes grace
    ok(not run_timers()[1], "a few minutes late is still within the grace time")
    backdate(order["id"], "taxi_eta_at", 6)
    result, sent = run_timers()
    ok(("released", order["id"], False) in sent, f"5+ minutes past the promised time: the order is taken from the taxi ({result})")
    r = api("GET", f"/orders/{order['order_number']}")[1]
    ok(r["status"] == "handed_over" and not r["taxi_phone"], "the bag is still at the gate, waiting for a taxi again")
    late_id, _ = staff_row(api, late_taxi)
    ok(incidents(late_id) == ["late_to_gate"], f"the late taxi gets an incident: {incidents(late_id)}")

    c, r = api("PATCH", f"/taxi/orders/{order['id']}/status", {"status": "on_the_way"}, late_taxi)
    ok(c == 409 and "boshqa taksichiga" in r["detail"], f"the late taxi cannot take the bag any more: {r.get('detail')}")
    available = api("GET", "/taxi/orders", headers=other_taxi)[1]["available"]
    ok(any(o["id"] == order["id"] for o in available), "every other taxi sees the order again")

    # The second taxi gives it back himself: the second reassignment tells the Bozorkom
    api("POST", f"/taxi/orders/{order['id']}/take", {"eta_minutes": 10}, other_taxi)
    c, _ = api("POST", f"/taxi/orders/{order['id']}/release", None, other_taxi)
    ok(c == 200, "«Bora olmayman»: a taxi can give the order back")
    other_id, _ = staff_row(api, other_taxi)
    ok(incidents(other_id) == ["released"], "that is counted too, but separately")
    with db() as c:
        count = c.execute("SELECT taxi_reassign_count FROM orders WHERE id = ?", (order["id"],)).fetchone()[0]
    ok(count == 2, f"the order changed taxis twice: {count}")
    staff = {s["id"]: s for s in api("GET", "/admin/staff", headers=admin)[1]}
    ok(staff[late_id]["incidents"] == {"late_to_gate": 1}, f"the Bozorkom sees it next to the driver: {staff[late_id]['incidents']}")

    # Once he has the bag, the timer no longer applies
    api("POST", f"/taxi/orders/{order['id']}/take", {"eta_minutes": 5}, late_taxi)
    c, r = api("PATCH", f"/taxi/orders/{order['id']}/status", {"status": "on_the_way"}, late_taxi)
    ok(c == 200 and r["left_bazaar_at"], "a taxi that does come takes the bag")
    backdate(order["id"], "taxi_eta_at", 30)
    ok(not [s for s in run_timers()[1] if s[0] == "released"], "an order on the way is never taken away")
    ok(api("POST", f"/taxi/orders/{order['id']}/release", None, late_taxi)[0] == 409, "and cannot be given back once on the way")


def test_long_trip_and_live_location(api, ok, sellers, make_staff, relaxed_limits):
    porter, taxi = make_staff("porter"), make_staff("taxi")
    order = at_gate(api, sellers, porter, "+998 90 720-00-02")
    api("POST", f"/taxi/orders/{order['id']}/take", {"eta_minutes": 5}, taxi)
    taxi_id, _ = staff_row(api, taxi)
    with db() as c:
        c.execute("UPDATE staff SET tg_id = '7770001' WHERE id = ?", (taxi_id,))

    from app.database import async_session_factory
    from app.services import taxi_control

    async def share(tg_id, lat, lng, now=None):
        async with async_session_factory() as s:
            saved = await taxi_control.save_location(s, tg_id, lat, lng, now)
            await s.commit()
            return saved

    ok(asyncio.run(share("123", 41.3, 69.2)) is None, "a customer's location is ignored")
    ok(asyncio.run(share("7770001", 41.36, 69.29)) == order["id"], "the driver on his way to the gate: position saved")
    ok(api("GET", f"/orders/{order['order_number']}")[1]["taxi_lat"] is None, "the customer does not see it before the bag is in the car")

    api("PATCH", f"/taxi/orders/{order['id']}/status", {"status": "on_the_way"}, taxi)
    ok(asyncio.run(share("7770001", 41.35, 69.28)) == 0, "points a few seconds apart are skipped")
    ok(asyncio.run(share("7770001", 41.35, 69.28, datetime.utcnow() + timedelta(seconds=15))) == order["id"], "the next one is saved")
    r = api("GET", f"/orders/{order['order_number']}")[1]
    ok(r["taxi_lat"] == 41.35 and r["taxi_lng"] == 69.28, f"on the way: the customer sees the car ({r['taxi_lat']}, {r['taxi_lng']})")
    seller_view = next(o for o in api("GET", "/seller/orders", headers=sellers[1])[1] if o["id"] == order["id"])
    ok(seller_view["taxi_lat"] is None, "the seller does not")
    backdate(order["id"], "taxi_loc_at", 11)
    ok(api("GET", f"/orders/{order['order_number']}")[1]["taxi_lat"] is None, "a position older than 10 minutes is hidden")

    backdate(order["id"], "left_bazaar_at", 50)
    ok(not run_timers()[1], "50 minutes on the way: still fine")
    backdate(order["id"], "left_bazaar_at", 61)
    result, sent = run_timers()
    ok(("late", order["id"]) in sent, f"an hour on the way: the Bozorkom and the customer are warned ({result})")
    ok(not run_timers()[1], "only once")
    ok(incidents(taxi_id) == ["late_delivery"], f"and the driver gets an incident: {incidents(taxi_id)}")

    c, r = api("PATCH", f"/taxi/orders/{order['id']}/status", {"status": "on_the_way"}, taxi)
    ok(c == 409, "«on the way» cannot be pressed twice")
