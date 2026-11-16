"""Customer and the people of the order settle payment themselves (Davlatbek, Shuhrat).
The seller, porter and taxi driver may give a card; the customer sees everyone's phone and card in the order."""
from tests.test_no_show import collect, MEAT
from tests.conftest import BASE_ORDER, COURIER

TOMATO = 6  # stall 1
MEAT_STALL = 2


def test_seller_card_shown_only_in_own_orders(api, ok, sellers, relaxed_limits):
    stall = sellers[0]
    ok(api("PATCH", "/seller/stores/me", {"payment_card": "8600 12"}, stall)[0] == 400, "a short card number is refused")
    c, r = api("PATCH", "/seller/stores/me", {"payment_card": "8600-1234 5678 9012"}, stall)
    ok(c == 200, "the seller saves a card")
    ok(api("GET", "/seller/my-store", headers=stall)[1]["payment_card"] == "8600 1234 5678 9012", "kept in groups of four")
    ok(all("payment_card" not in s for s in api("GET", "/stores")[1]), "not in the public stall list")

    c, o = api("POST", "/orders", {
        "customer_name": "Mijoz", "customer_phone": "+998 90 455-00-01", "delivery_time_slot": "Morning (09:00-11:00)",
        "payment_method": "card", "fulfillment": "self", "items": [{"product_id": TOMATO, "store_id": 1, "quantity": 1}],
    })
    ok(c == 200 and o["payment_method"] == "card", f"the customer chose to pay by card ({c})")
    contacts = api("GET", f"/orders/{o['order_number']}")[1]["contacts"]
    ok(len(contacts) == 1 and contacts[0]["kind"] == "seller" and contacts[0]["card"] == "8600 1234 5678 9012"
       and contacts[0]["phone"], "the customer sees the seller's phone and card in the order")

    api("PATCH", "/seller/stores/me", {"payment_card": ""}, stall)
    contacts = api("GET", f"/orders/{o['order_number']}")[1]["contacts"]
    ok(contacts[0]["card"] is None and contacts[0]["phone"], "the seller removes the card: the phone stays, no card")
    ok(api("POST", "/orders", {**BASE_ORDER, "payment_method": "payme", "fulfillment": "self",
                               "items": [{"product_id": TOMATO, "store_id": 1, "quantity": 1}]})[0] == 422, "only cash or card")


def test_porter_and_taxi_cards_and_phones(api, ok, admin, sellers, make_staff, relaxed_limits):
    stall, porter, taxi = sellers[1], make_staff("porter", "Aravachi Karta"), make_staff("taxi", "Taksi Karta")
    ok(api("PATCH", "/staff/me/card", {"payment_card": "123"}, porter)[0] == 400, "a short card is refused")
    c, me = api("PATCH", "/staff/me/card", {"payment_card": "9860 0101 0202 0303"}, porter)
    ok(c == 200 and me["payment_card"] == "9860 0101 0202 0303", "the porter saves a card")
    ok(api("GET", "/staff/me", headers=porter)[1]["payment_card"] == "9860 0101 0202 0303", "the porter sees it again")
    api("PATCH", "/staff/me/card", {"payment_card": "5614 6812 3456 7890"}, taxi)

    c, order = api("POST", "/orders", {**BASE_ORDER, "customer_phone": "+998 90 455-00-02", **COURIER,
                                       "items": [{"product_id": MEAT, "store_id": MEAT_STALL, "quantity": 1}]})
    assert c == 200, order
    collect(api, porter, stall, order)
    api("PATCH", f"/porter/orders/{order['id']}/status", {"status": "handed_over"}, porter)
    api("POST", f"/taxi/orders/{order['id']}/take", {"eta_minutes": 5}, taxi)

    contacts = {c["kind"]: c for c in api("GET", f"/orders/{order['order_number']}")[1]["contacts"]}
    ok(set(contacts) == {"seller", "porter", "taxi"}, f"seller, porter and taxi are all in the order: {list(contacts)}")
    ok(contacts["porter"]["card"] == "9860 0101 0202 0303" and contacts["porter"]["phone"], "the porter's phone and card")
    ok(contacts["taxi"]["card"] == "5614 6812 3456 7890" and contacts["taxi"]["phone"], "the taxi driver's phone and card")
    ok(not any("payment_card" in s for s in api("GET", "/admin/staff", h=admin)[1]), "cards are not in staff lists")

    # The seller sees the porter's and the taxi driver's phone in the order
    seller_order = next(o for o in api("GET", "/seller/orders", headers=stall)[1] if o["id"] == order["id"])
    ok(seller_order["porter_phone"] and seller_order["taxi_phone"], "the seller can call the porter and the taxi driver")
