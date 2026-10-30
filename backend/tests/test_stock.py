"""Counted stock: orders hold it, the handover takes it off, a cancel or «Tugadi» gives it back."""
import asyncio
import json
import sqlite3
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

from conftest import DB_FILE, SENT_LOG

MEAT, BEEF, TOMATO = 10, 11, 6  # stall 2: 105 000 and 95 000 per kg; stall 1: 22 000 per kg


def order(api, product_id, kg, phone, store_id=2):
    return api("POST", "/orders", {
        "customer_name": "Mijoz", "customer_phone": phone, "delivery_time_slot": "Morning (09:00-11:00)",
        "payment_method": "cash", "fulfillment": "self", "items": [{"product_id": product_id, "store_id": store_id, "quantity": kg}],
    })


def product(api, seller, product_id):
    return next(p for p in api("GET", "/seller/my-store", headers=seller)[1]["products"] if p["id"] == product_id)


def set_stock(api, seller, product_id, quantity, available=True, alert=None):
    return api("POST", "/seller/stock", {"lines": [
        {"product_id": product_id, "is_available": available, "quantity": quantity, "low_stock_alert": alert}]}, seller)


def test_last_kilos_go_to_one_customer_only(api, ok, sellers, relaxed_limits):
    stall = sellers[1]
    c, _ = set_stock(api, stall, MEAT, 2)
    meat = product(api, stall, MEAT)
    ok(c == 200 and meat["track_stock"] and meat["available_quantity"] == 2, f"seller says 2 kg of lamb today: {meat['available_quantity']}")

    c, r = api("POST", "/orders/quote", {"fulfillment": "self", "items": [{"product_id": MEAT, "store_id": 2, "quantity": 3}]})
    ok(c == 409 and "faqat 2 kg qoldi" in r["detail"], f"asking for 3 kg says only 2 kg left: {r.get('detail', '')[:60]}")

    # Ten customers press «Buyurtma berish» for 1 kg at the same moment
    with ThreadPoolExecutor(10) as pool:
        results = list(pool.map(lambda i: order(api, MEAT, 1, f"+998 90 300-00-{i:02d}"), range(10)))
    placed = [r for c, r in results if c == 200]
    refused = [r for c, r in results if c == 409]
    ok(len(placed) == 2 and len(refused) == 8, f"exactly two of ten simultaneous orders get the 2 kg ({len(placed)} placed, {len(refused)} refused)")
    ok(product(api, stall, MEAT)["available_quantity"] == 0, "nothing left to order")
    ok(any(p["id"] == MEAT for p in api("GET", "/products")[1]), "the product stays in the shop (shown as sold out by the app)")

    first, second = placed
    ok(api("POST", f"/orders/{first['order_number']}/cancel")[0] == 200, "one customer cancels")
    meat = product(api, stall, MEAT)
    ok(meat["available_quantity"] == 1 and meat["stock_quantity"] == 2, f"the cancelled kilo is back for sale at once: {meat['available_quantity']}")

    ok(api("POST", f"/seller/orders/{second['id']}/handed", None, stall)[0] == 200, "the stall hands the other order over")
    meat = product(api, stall, MEAT)
    ok(meat["stock_quantity"] == 1 and meat["available_quantity"] == 1, f"1 kg left the stall, 1 kg is left: {meat['stock_quantity']}")

    db = sqlite3.connect(DB_FILE)
    moves = db.execute("SELECT kind, COUNT(*) FROM stock_moves WHERE product_id = ? GROUP BY kind", (MEAT,)).fetchall()
    ok(dict(moves) == {"morning": 1, "reserve": 2, "release": 1, "consume": 1}, f"every move is in the stock log: {dict(moves)}")


def test_scale_weight_and_sold_out(api, ok, sellers, relaxed_limits):
    stall = sellers[1]
    set_stock(api, stall, BEEF, 5)
    c, o = order(api, BEEF, 1, "+998 90 400-00-01")
    item = o["items"][0]["id"]
    ok(api("PATCH", f"/seller/items/{item}/weight", {"actual_quantity": 1.04}, stall)[0] == 200, "the scale shows 1.04 kg")
    api("POST", f"/seller/orders/{o['id']}/handed", None, stall)
    ok(product(api, stall, BEEF)["stock_quantity"] == 3.96, "the stall's stock goes down by what the scale showed")

    c, o2 = order(api, BEEF, 2, "+998 90 400-00-02")
    ok(product(api, stall, BEEF)["available_quantity"] == 1.96, "2 kg held by a new order")
    c, r = api("POST", f"/seller/items/{o2['items'][0]['id']}/missing", {"missing": True}, stall)
    beef = product(api, stall, BEEF)
    ok(c == 200 and beef["stock_quantity"] == 0 and beef["stock_reserved"] == 0 and not beef["is_available"],
       f"«Tugadi»: nothing left at the stall, the hold is given back, hidden from the shop: {beef['stock_quantity']} / {beef['stock_reserved']}")

    tomato = product(api, sellers[0], TOMATO)
    ok(not tomato["track_stock"] and tomato["available_quantity"] is None, "products the seller does not count stay as they were")
    ok(order(api, TOMATO, 50, "+998 90 400-00-03", store_id=1)[0] == 200, "and can be ordered in any amount")


def test_low_stock_alert_and_morning_list(api, ok, sellers, relaxed_limits):
    stall = sellers[1]
    db = sqlite3.connect(DB_FILE)
    db.execute("INSERT INTO store_members (store_id, tg_id, name, role, created_at) VALUES (2, '5555', 'Aziz', 'helper', CURRENT_TIMESTAMP)")
    db.commit()
    SENT_LOG.write_text("")

    set_stock(api, stall, MEAT, 3, alert=1.5)
    order(api, MEAT, 1, "+998 90 500-00-01")
    asyncio.run(asyncio.sleep(1))
    ok("Kam qoldi" not in SENT_LOG.read_text(), "2 kg left: no alert yet")
    order(api, MEAT, 1, "+998 90 500-00-02")
    asyncio.run(asyncio.sleep(1.5))
    sent = [json.loads(line) for line in SENT_LOG.read_text().splitlines()]
    ok(any(m["chat"] == "5555" and "Kam qoldi" in m["text"] for m in sent), f"1 kg left: the stall's helper is told: {sent[-1:]}")

    # The morning question goes out once, at the set hour (07:00 Tashkent = 02:00 UTC)
    import app.bot.notify as notify
    from app.services import maintenance
    asked = []

    async def fake_send(chat, text, keyboard=None):
        asked.append((chat, text, keyboard.inline_keyboard[0][0].web_app.url))
    notify._send = fake_send
    ok(asyncio.run(maintenance.morning_stock(datetime(2026, 11, 2, 1, 30))) is False, "06:30: not yet")
    ok(asyncio.run(maintenance.morning_stock(datetime(2026, 11, 2, 2, 5))) is True, "07:05: sent")
    ok(any(chat == "5555" and "Bugun nima bor" in text and "stock=1" in url for chat, text, url in asked),
       "the helper gets «Bugun nima bor?» with a button to the stock screen")
    ok(asyncio.run(maintenance.morning_stock(datetime(2026, 11, 2, 3, 0))) is False, "not sent twice the same day")
    ok(asyncio.run(maintenance.morning_stock(datetime(2026, 11, 3, 9, 0))) is False, "a server started at 14:00 does not send it")

    c, r = api("POST", "/seller/stock", {"lines": [{"product_id": MEAT, "is_available": True, "quantity": None}]}, stall)
    ok(c == 200 and not product(api, stall, MEAT)["track_stock"], "the seller can stop counting a product")
    ok(api("POST", "/seller/stock", {"lines": [{"product_id": TOMATO, "is_available": True, "quantity": 5}]}, stall)[0] == 404,
       "another stall's product cannot be changed")
