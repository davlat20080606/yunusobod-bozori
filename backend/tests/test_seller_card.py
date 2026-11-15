"""Davlatbek: customer and seller settle payment themselves. The seller may give a card; only that stall's customers see it."""
TOMATO = 6  # stall 1


def test_seller_card_shown_only_in_own_orders(api, ok, sellers, relaxed_limits):
    stall = sellers[0]
    ok(api("PATCH", "/seller/stores/me", {"payment_card": "8600 12"}, stall)[0] == 400, "a short card number is refused")
    c, r = api("PATCH", "/seller/stores/me", {"payment_card": "8600-1234 5678 9012"}, stall)
    ok(c == 200, "the seller saves a card")
    ok(api("GET", "/seller/my-store", headers=stall)[1]["payment_card"] == "8600 1234 5678 9012", "kept in groups of four")
    ok(all("payment_card" not in s for s in api("GET", "/stores")[1]), "not in the public stall list")

    c, o = api("POST", "/orders", {
        "customer_name": "Mijoz", "customer_phone": "+998 90 455-00-01", "delivery_time_slot": "Morning (09:00-11:00)",
        "payment_method": "cash", "fulfillment": "self", "items": [{"product_id": TOMATO, "store_id": 1, "quantity": 1}],
    })
    ok(c == 200, f"order placed ({c})")
    cards = api("GET", f"/orders/{o['order_number']}")[1]["seller_cards"]
    ok(len(cards) == 1 and cards[0]["card"] == "8600 1234 5678 9012" and cards[0]["store_id"] == 1, "the customer sees the seller's card in the order")

    api("PATCH", "/seller/stores/me", {"payment_card": ""}, stall)
    ok(api("GET", f"/orders/{o['order_number']}")[1]["seller_cards"] == [], "the seller removes the card: no card shown")
