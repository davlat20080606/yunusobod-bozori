"""Too many orders in a short time from one customer are refused (its own server, so counters start at zero)."""
from test_customer_guard import order


def test_orders_per_10_minutes(api, ok, admin, relaxed_limits):
    api("PUT", "/admin/settings", {"orders_per_10_min": 2}, admin)
    ok(order(api, "+998 95 500-00-06")[0] == 200, "1st order")
    ok(order(api, "+998 95 500-00-06")[0] == 200, "2nd order")
    c, r = order(api, "+998 95 500-00-06")
    ok(c == 429 and "Juda ko'p" in r["detail"], f"3rd order within 10 minutes is refused: {c}")
    ok(order(api, "+998 95 500-00-07")[0] == 200, "another customer is not affected")
    q = api("POST", "/orders/quote", {"fulfillment": "self", "items": [{"product_id": 10, "store_id": 2, "quantity": 1}]})
    ok(q[0] == 200, "prices can still be checked")
