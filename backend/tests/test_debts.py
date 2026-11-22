"""📒 Nasiya daftari (Shuhrat, 2026-11-21): the stall writes, the buyer confirms in the bot, reminders only to those who
confirmed (at most every 2–3 days, «Eslatmang» stops them), nothing is deleted, no other stall (and no bozorkom) sees it."""
import asyncio
import json
import sqlite3
from datetime import datetime, timedelta

from conftest import DB_FILE, SENT_LOG, BASE_ORDER

BUYER_TG, BUYER_PHONE = "5550001", "+998 90 555 00 01"
LATE_TG, LATE_PHONE = "5550002", "+998 90 555 00 02"


def db():
    return sqlite3.connect(DB_FILE)


def add_customer(tg_id, phone, lang="uz"):
    with db() as c:
        c.execute("INSERT INTO customers (tg_id, lang, phone, name, created_at) VALUES (?, ?, ?, ?, ?)",
                  (tg_id, lang, phone, "Karim", datetime.utcnow().isoformat(sep=" ")))


def sent_to(chat):
    return [json.loads(line)["text"] for line in open(SENT_LOG) if json.loads(line).get("chat") == chat]


def today():
    from app.services.debts import today_tashkent
    return today_tashkent()


def new(api, seller, **fields):
    body = {"customer_name": "Karim aka", "amount": 250000, "note": "2 kg go'sht",
            "due_date": (today() + timedelta(days=1)).isoformat(), **fields}
    return api("POST", "/seller/debts", body, seller)


def answer(tg, debt_id, what):
    """The buyer's button in the bot, run here. Messages to the stall are skipped: a task cut off when asyncio.run ends
    would keep the SQLite file locked for the test server."""
    from app.services import debts
    real = debts._background
    debts._background = lambda coro: coro.close()
    try:
        return asyncio.run(debts.buyer_answer(tg, debt_id, what))
    finally:
        debts._background = real


def test_write_confirm_pay_close(api, ok, sellers):
    add_customer(BUYER_TG, BUYER_PHONE)
    s1, s2 = sellers[0], sellers[1]

    c, d = new(api, s1, customer_phone="90 555 00 01")
    ok(c == 200 and d["confirm"] == "waiting" and d["in_bot"] and d["left"] == 250000,
       f"a buyer in the bot is asked to confirm ({c} {d})")
    ok(d["customer_phone"] == BUYER_PHONE, f"phone kept in one form ({d.get('customer_phone')})")
    asyncio.run(asyncio.sleep(0.5))
    ok(any("Nasiya daftariga" in t for t in sent_to(BUYER_TG)), f"the request reached the buyer {sent_to(BUYER_TG)}")

    c, walkup = new(api, s1, customer_name="Bozor xolasi", customer_phone=None)
    ok(c == 200 and walkup["confirm"] == "none" and not walkup["in_bot"], "without a phone: written, not confirmed")

    # Privacy: another stall sees nothing of it
    other = api("GET", "/seller/debts", None, s2)[1]
    ok(all(x["id"] not in (d["id"], walkup["id"]) for x in other["debts"]), "another stall does not see the debts")
    ok(api("GET", f"/seller/debts/{d['id']}", None, s2)[0] == 404, "nor open one by its number")
    ok(api("POST", f"/seller/debts/{d['id']}/pay", {"amount": 1000}, s2)[0] == 404, "nor pay it")
    ok(api("GET", "/seller/debts", None, None)[0] in (401, 403), "nobody without a stall session")

    # No reminders before the buyer confirms
    c, r = api("POST", f"/seller/debts/{d['id']}/remind", None, s1)
    ok(c == 409, f"no reminder to an unconfirmed buyer ({c})")

    ok(answer("999999", d["id"], "yes") is None, "someone else cannot confirm it")
    ok(answer(BUYER_TG, d["id"], "yes") == "confirmed", "the buyer confirms")
    ok(answer(BUYER_TG, d["id"], "no") == "confirmed", "the first answer stands")
    ok(api("GET", f"/seller/debts/{d['id']}", None, s1)[1]["confirm"] == "confirmed", "the stall sees it confirmed")

    c, r = api("POST", f"/seller/debts/{d['id']}/remind", None, s1)
    ok(c == 200 and r["reminded_on"] == today().isoformat(), f"reminder to a confirmed buyer ({c})")
    ok(api("POST", f"/seller/debts/{d['id']}/remind", None, s1)[0] == 429, "not again within 2 days")

    c, r = api("POST", f"/seller/debts/{d['id']}/pay", {"amount": 100000}, s1)
    ok(c == 200 and r["left"] == 150000 and r["status"] == "open", f"a part paid, the rest left ({r})")
    c, r = api("POST", f"/seller/debts/{d['id']}/pay", {"amount": 999999}, s1)
    ok(c == 200 and r["left"] == 0 and r["paid"] == 250000 and r["status"] == "paid", f"the rest closes it exactly ({r})")
    ok(api("POST", f"/seller/debts/{d['id']}/pay", {"amount": 1000}, s1)[0] == 409, "a closed debt takes no payment")

    detail = api("GET", f"/seller/debts/{d['id']}", None, s1)[1]
    kinds = [e["kind"] for e in detail["events"]]
    ok(kinds == ["created", "confirmed", "reminded", "payment", "payment"], f"the whole history is kept {kinds}")
    asyncio.run(asyncio.sleep(0.5))
    ok(any("yopildi" in t for t in sent_to(BUYER_TG)), "the buyer is told it is closed")

    listing = api("GET", "/seller/debts", None, s1)[1]
    ok(any(x["id"] == d["id"] and x["status"] == "paid" for x in listing["debts"]), "a closed debt stays in the list")
    ok(listing["summary"]["open_total"] == 250000, f"open total counts what is left ({listing['summary']})")


def test_dispute_stop_cancel(api, ok, sellers):
    s1 = sellers[0]
    c, d = new(api, s1, customer_phone=BUYER_PHONE, amount=80000)
    ok(answer(BUYER_TG, d["id"], "no") == "disputed", "the buyer says: no such debt")
    ok(api("GET", f"/seller/debts/{d['id']}", None, s1)[1]["confirm"] == "disputed", "the stall sees the dispute")
    ok(api("POST", f"/seller/debts/{d['id']}/remind", None, s1)[0] == 409, "a disputed debt is never reminded")

    c, d2 = new(api, s1, customer_phone=BUYER_PHONE, amount=50000)
    answer(BUYER_TG, d2["id"], "yes")
    ok(answer(BUYER_TG, d2["id"], "stop") == "stopped", "«Eslatmang»")
    ok(api("POST", f"/seller/debts/{d2['id']}/remind", None, s1)[0] == 409, "and the stall cannot remind any more")

    ok(api("POST", f"/seller/debts/{d['id']}/cancel", {"reason": ""}, s1)[0] == 422, "cancelling needs a reason")
    c, r = api("POST", f"/seller/debts/{d['id']}/cancel", {"reason": "Xato yozdim"}, s1)
    ok(c == 200 and r["status"] == "cancelled" and r["cancel_reason"] == "Xato yozdim", "cancelled, not deleted")
    ok(api("GET", f"/seller/debts/{d['id']}", None, s1)[0] == 200, "and still there with its history")
    ok(api("DELETE", f"/seller/debts/{d['id']}", None, s1)[0] in (404, 405), "there is no delete at all")


def test_checks_and_limits(api, ok, sellers, relaxed_limits):
    s1, s3 = sellers[0], sellers[2]
    ok(new(api, s1, amount=500)[0] == 422, "under 1 000 so'm is a typo")
    ok(new(api, s1, due_date=(today() - timedelta(days=1)).isoformat())[0] == 400, "a due date in the past")
    ok(new(api, s1, customer_phone="12345")[0] == 400, "half a phone number")
    ok(new(api, s1, customer_name="")[0] == 422, "a name is needed")

    # One stall cannot flood one person with requests
    with db() as c:
        c.execute("UPDATE debts SET confirm = 'confirmed' WHERE customer_tg_id = ? AND confirm = 'waiting'", (BUYER_TG,))
    codes = [new(api, s1, customer_phone=BUYER_PHONE, amount=10000)[0] for _ in range(4)]
    ok(codes == [200, 200, 200, 429], f"at most 3 unanswered requests to one buyer {codes}")

    # From an order: only an order with this stall's goods, only once
    c, o = api("POST", "/orders", {**BASE_ORDER, "customer_phone": "+998 90 730-00-01", "fulfillment": "self",
                                   "items": [{"product_id": 6, "store_id": 1, "quantity": 1}]})
    ok(c == 200, f"order ({c})")
    ok(new(api, s1, order_id=o["id"], customer_phone=None)[0] == 200, "written from the order")
    ok(new(api, s1, order_id=o["id"], customer_phone=None)[0] == 409, "the same order only once")
    ok(new(api, s3, order_id=o["id"], customer_phone=None)[0] == 404, "another stall cannot use this order")


def test_morning_and_late_joiner(api, ok, sellers, monkeypatch):
    from app.services import debts
    s1 = sellers[0]
    sent = []

    async def record(chat, text, keyboard=None):
        sent.append((str(chat), text))
    monkeypatch.setattr(debts, "_send", record)

    # Earlier tests left this buyer with unanswered requests (at most 3): answer them
    with db() as conn:
        conn.execute("UPDATE debts SET confirm = 'confirmed' WHERE customer_tg_id = ? AND confirm = 'waiting'", (BUYER_TG,))
    # Confirmed and due today; another not due yet
    c, due = new(api, s1, customer_phone=BUYER_PHONE, amount=120000, due_date=today().isoformat())
    c, later = new(api, s1, customer_phone=BUYER_PHONE, amount=70000, due_date=(today() + timedelta(days=5)).isoformat())
    with db() as conn:
        conn.execute("UPDATE debts SET confirm = 'confirmed', reminders_off = 0 WHERE id IN (?, ?)", (due["id"], later["id"]))
        conn.execute("UPDATE stores SET telegram_chat_id = '7770001' WHERE id = 1")

    result = asyncio.run(debts.morning())
    ok(result["reminders"] >= 1, f"the buyer is reminded on the due day {result}")
    texts = [t for chat, t in sent if chat == BUYER_TG]
    ok(any("120 000" in t for t in texts) and not any("70 000" in t for t in texts), f"only the debt that is due {texts}")
    stall = [t for chat, t in sent if chat == "7770001"]
    ok(stall and "Nasiya daftari" in stall[0] and "Karim aka" in stall[0], f"the stall gets its morning list {stall}")

    sent.clear()
    asyncio.run(debts.morning())
    ok(not [t for chat, t in sent if chat == BUYER_TG and "120 000" in t], "not reminded again the next run")
    # Three days later it comes again, still late
    asyncio.run(debts.morning(datetime.utcnow() + timedelta(days=3)))
    ok([t for chat, t in sent if chat == BUYER_TG and "120 000" in t], "every 3 days while it is late")

    # A buyer who joins the bot after the stall wrote them down
    c, d = new(api, s1, customer_name="Late", customer_phone=LATE_PHONE)
    ok(d["confirm"] == "none", "not in the bot yet: nothing sent")
    add_customer(LATE_TG, LATE_PHONE)
    ok(asyncio.run(debts.link_new_buyer(LATE_TG, LATE_PHONE)) == 1, "on joining the request is sent")
    ok(api("GET", f"/seller/debts/{d['id']}", None, s1)[1]["confirm"] == "waiting", "and it waits for the answer")
    ok(any(chat == LATE_TG and "Nasiya" in t for chat, t in sent), "the late joiner got the request")


def test_buyer_says_paid_stall_confirms(api, ok, sellers, monkeypatch):
    """Davlatbek's father: the buyer sends «💵 To'ladim», the stall answers «Oldim» (closed) or «Olmadim»;
    until then both keep getting reminded."""
    from app.services import debts
    s1, s2 = sellers[0], sellers[1]
    with db() as conn:
        conn.execute("UPDATE debts SET confirm = 'confirmed' WHERE customer_tg_id = ? AND confirm = 'waiting'", (BUYER_TG,))
    c, d = new(api, s1, customer_phone=BUYER_PHONE, amount=90000)
    ok(answer(BUYER_TG, d["id"], "paid") is None, "«To'ladim» only after the buyer confirmed the debt")
    answer(BUYER_TG, d["id"], "yes")
    ok(answer("999999", d["id"], "paid") is None, "nobody else can say it")
    ok(answer(BUYER_TG, d["id"], "paid") == "claimed", "the buyer says «To'ladim»")
    ok(answer(BUYER_TG, d["id"], "paid") == "claim_wait", "pressing again only says «waiting for the seller»")
    r = api("GET", f"/seller/debts/{d['id']}", None, s1)[1]
    ok(r["paid_claim"] and r["status"] == "open", "the stall sees it, the debt is still open until it answers")
    ok(api("GET", "/seller/debts", None, s1)[1]["summary"]["paid_claims"] >= 1, "and the count on the notebook card")
    ok(api("POST", f"/seller/debts/{d['id']}/remind", None, s1)[0] == 409, "no reminders while the answer is pending")
    ok(not debts.due_for_auto_reminder(type("D", (), {**{k: getattr(object(), k, None) for k in ()}, "status": "open", "confirm": "confirmed",
        "reminders_off": False, "customer_tg_id": BUYER_TG, "paid_claim_at": datetime.utcnow(), "due_date": today(), "reminded_on": None})(), today()),
       "the morning reminder skips it too")

    ok(api("POST", f"/seller/debts/{d['id']}/claim", {"accept": True}, s2)[0] == 404, "another stall cannot answer")
    c, r = api("POST", f"/seller/debts/{d['id']}/claim", {"accept": False}, s1)
    ok(c == 200 and r["status"] == "open" and not r["paid_claim"], "«Olmadim»: still open, the buyer is told")
    answer(BUYER_TG, d["id"], "paid")
    c, r = api("POST", f"/seller/debts/{d['id']}/claim", {"accept": True}, s1)
    ok(c == 200 and r["status"] == "paid" and r["left"] == 0, f"«Oldim»: closed with what was left ({r})")
    kinds = [e["kind"] for e in api("GET", f"/seller/debts/{d['id']}", None, s1)[1]["events"]]
    ok(kinds[-4:] == ["claimed", "claim_rejected", "claimed", "payment"], f"each step in the history {kinds}")
    listing = api("GET", "/seller/debts", None, s1)[1]["debts"]
    ok(any(x["id"] == d["id"] and x["status"] == "paid" for x in listing), "it leaves the open list, kept under «Yopilgan»")

    # From the bot: only someone who works at that stall
    c, d2 = new(api, s1, customer_phone=BUYER_PHONE, amount=30000)
    answer(BUYER_TG, d2["id"], "yes"); answer(BUYER_TG, d2["id"], "paid")
    with db() as conn:
        conn.execute("UPDATE stores SET telegram_chat_id = '7770001' WHERE id = 1")
    monkeypatch.setattr(debts, "_background", lambda coro: coro.close())
    ok(asyncio.run(debts.stall_answer(d2["id"], True, tg_id="123")) is None, "a stranger's «Oldim» in the bot does nothing")
    r = asyncio.run(debts.stall_answer(d2["id"], True, tg_id="7770001"))
    ok(r and r["status"] == "paid", "the stall's own «Oldim» in the bot closes it")
