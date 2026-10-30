"""Fake-order protection: limits for new customers, open-order limit, blocking by phone and Telegram."""
from test_stall_team import init_data

MEAT = {"product_id": 10, "store_id": 2}  # 105 000 so'm per kg, stall 2


def order(api, phone, kg=1, tg=None):
    headers = {"x-telegram-init-data": init_data(tg, "Mijoz")} if tg else None
    return api("POST", "/orders", {
        "customer_name": "Mijoz", "customer_phone": phone, "delivery_time_slot": "Morning (09:00-11:00)",
        "payment_method": "cash", "fulfillment": "self", "items": [{**MEAT, "quantity": kg}],
    }, headers)


def test_new_and_regular_customer(api, ok, admin, sellers):
    stall = sellers[1]
    # Many tries from one phone here; the per-10-minutes limit has its own test
    api("PUT", "/admin/settings", {"orders_per_10_min": 1000}, admin)
    c, r = order(api, "+998 90 100-00-01", kg=5)
    ok(c == 409 and "500 000" in r["detail"], f"first order over 500 000 is refused: {c} {r.get('detail', '')[:60]}")

    c, first = order(api, "+998 90 100-00-01")
    ok(c == 200, "first order of 105 000 goes through")
    c, r = order(api, "90 100 00 01")
    ok(c == 409 and "1 ta ochiq" in r["detail"], f"a second open order is refused, same phone typed differently: {c}")

    # The stall hands the order over: the customer has now received one, so they are a regular
    ok(api("POST", f"/seller/orders/{first['id']}/handed", None, stall)[0] == 200, "stall hands the first order over")
    ok(api("GET", f"/orders/{first['order_number']}")[1]["status"] == "delivered", "first order delivered")

    c, _ = order(api, "+998901000001", kg=5)
    ok(c == 200, "a regular customer may order over 500 000")
    ok(order(api, "+998901000001")[0] == 200, "second open order allowed")
    ok(order(api, "+998901000001")[0] == 200, "third open order allowed")
    c, r = order(api, "+998901000001")
    ok(c == 409 and "3 ta ochiq" in r["detail"], f"a fourth open order is refused: {c}")


def test_blocking(api, ok, admin):
    c, r = order(api, "+998 91 200-00-02", tg=7001)
    ok(c == 200 and r["customer_tg_id"] == "7001", "Telegram customer orders")
    c, r = api("POST", "/admin/customers/block", {"phone": "91 200 00 02", "reason": "soxta buyurtmalar"}, admin)
    ok(c == 200 and r["tg_id"] == "7001", f"Bozorkom blocks the phone; the Telegram account is blocked with it: {r}")

    c, r = order(api, "+998912000002")
    ok(c == 403 and "yopilgan" in r["detail"], "the blocked phone cannot order")
    ok(order(api, "+998 93 300-00-03", tg=7001)[0] == 403, "a new phone from the same Telegram cannot order either")
    ok(order(api, "+998 93 300-00-04", tg=7002)[0] == 200, "other customers are not affected")

    customers = api("GET", "/admin/customers?q=912000002", headers=admin)[1]
    ok(len(customers) == 1 and customers[0]["blocked"] and customers[0]["block_reason"] == "soxta buyurtmalar",
       f"the customer list shows the block and its reason: {customers}")
    ok(api("GET", "/admin/customers", headers={})[0] == 401, "the customer list needs the Bozorkom sign-in")

    ok(api("DELETE", "/admin/customers/block/912000002", None, admin)[0] == 200, "Bozorkom unblocks")
    # The first order is still open and this is still a new customer, so the next one waits for it
    c, r = order(api, "+998912000002")
    ok(c == 409, f"after unblocking the usual limits apply again: {c}")


def test_limits_are_settings(api, ok, admin):
    c, r = api("PUT", "/admin/settings", {"new_customer_max_total": 700000}, admin)
    ok(c == 200 and r["new_customer_max_total"] == 700000, "Bozorkom changes the first-order cap")
    ok(order(api, "+998 94 400-00-05", kg=6)[0] == 200, "630 000 is now allowed for a first order")
    ok(api("PUT", "/admin/settings", {"max_open_orders": 0}, admin)[0] == 422, "nonsense limits are refused")
