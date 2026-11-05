"""Before the pilot: only self pickup while delivery is not ready, a typed phone must be a real number,
and an order with a worker in between closes only with the customer's code."""
from conftest import BASE_ORDER, COURIER

MEAT = 10  # stall 2
ITEMS = [{"product_id": MEAT, "store_id": 2, "quantity": 1}]


def order(api, phone, **where):
    return api("POST", "/orders", {**BASE_ORDER, "customer_phone": phone, "items": ITEMS, **where})


def test_pilot_is_self_pickup_only_until_the_bozorkom_opens_delivery(api, ok, admin, relaxed_limits):
    from app.services.config_store import DEFAULTS
    ok(DEFAULTS["self_pickup_only"] == "1", "a new server starts with self pickup only")
    api("PUT", "/admin/settings", {"self_pickup_only": True}, admin)
    ok(api("GET", "/config")[1]["self_pickup_only"] is True, "the app knows")
    ok(api("GET", "/admin/overview", headers=admin)[1]["self_pickup_only"] is True, "the Bozorkom sees the switch on")
    c, r = order(api, "+998 90 760-00-01", **COURIER)
    ok(c == 409 and "O'zim olaman" in r["detail"], f"delivery is refused by the server, not only hidden: {r.get('detail')}")
    ok(order(api, "+998 90 760-00-02", fulfillment="point", handoff_point="main_gate")[0] == 409, "the aravachi point too")
    ok(order(api, "+998 90 760-00-03", fulfillment="self")[0] == 200, "self pickup works")
    api("PUT", "/admin/settings", {"self_pickup_only": False}, admin)
    ok(order(api, "+998 90 760-00-04", **COURIER)[0] == 200, "the Bozorkom opens delivery: it works again")


def test_typed_phone_must_be_a_real_number(api, ok, relaxed_limits):
    for bad in ("+998 90 12", "+998 90 123-45-6", "+7 900 123-45-67", "+998 90 123-45-678", "abc"):
        c, r = order(api, bad, fulfillment="self")
        ok(c == 400 and "+998" in r["detail"], f"{bad!r} is refused: {c}")
    ok(order(api, "+998 90 760-00-05", fulfillment="self")[0] == 200, "+998 with 9 digits is fine")
    ok(order(api, "90 760-00-06", fulfillment="self")[0] == 200, "the 9 digits alone too")


def test_a_tap_cannot_close_an_order_on_its_way(api, ok, sellers, make_staff, relaxed_limits):
    porter, taxi = make_staff("porter"), make_staff("taxi")
    c, o = order(api, "+998 90 760-00-07", **COURIER)
    assert c == 200, o
    api("POST", f"/porter/orders/{o['id']}/take", None, porter)
    api("POST", f"/seller/orders/{o['id']}/handed", None, sellers[1])
    for item in o["items"]:
        api("PATCH", f"/porter/items/{item['id']}/picked", {"is_picked": True}, porter)
    api("PATCH", f"/porter/orders/{o['id']}/status", {"status": "handed_over"}, porter)
    api("POST", f"/taxi/orders/{o['id']}/take", {"eta_minutes": 5}, taxi)
    api("PATCH", f"/taxi/orders/{o['id']}/status", {"status": "on_the_way"}, taxi)

    c, _ = api("POST", f"/orders/{o['order_number']}/received")
    ok(c == 409, "on the way: «Buyurtmani oldim» is refused")
    ok(api("GET", f"/orders/{o['order_number']}")[1]["status"] == "on_the_way", "the order is still on its way")
    ok(any(x["id"] == o["id"] for x in api("GET", "/taxi/orders", headers=taxi)[1]["mine"]), "and on the driver's screen")
    c, _ = api("PATCH", f"/taxi/orders/{o['id']}/status", {"status": "delivered", "code": o["handoff_code"]}, taxi)
    ok(c == 200, "the driver closes it with the code")
    c, r = api("POST", f"/orders/{o['order_number']}/received")
    ok(c == 200 and r["customer_confirmed_at"], "then the customer confirms and can rate it")
