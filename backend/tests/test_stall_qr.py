"""The stall's permanent QR (Shuhrat: print once, stick on the stall): its people go to the cabinet, customers to the
bot's normal start page, and someone new who works there is added after one «yes» from the owner."""
import asyncio

from test_stall_team import init_data

OWNER, HELPER, STRANGER, CUSTOMER, OWNER2 = 4004, 5005, 6006, 7007, 8008


class U:
    def __init__(s, uid, first): s.id = uid; s.first_name = first; s.last_name = None; s.username = None; s.language_code = "ru"


class FakeBot:
    async def set_chat_menu_button(s, *a, **kw): pass


class Msg:
    def __init__(s, uid, first):
        s.from_user = U(uid, first); s.replies = []; s.bot = FakeBot(); s.chat = type("C", (), {"id": uid})()
    async def answer(s, text, **kw):
        s.replies.append((text, kw.get("reply_markup")))
        return type("Sent", (), {"delete": lambda self: asyncio.sleep(0)})()
    async def answer_photo(s, photo=None, caption="", **kw): s.replies.append((caption, kw.get("reply_markup")))


def accept_rules(tg_id):
    """The platform rules are accepted once (test_terms.py checks that step itself)."""
    from app.database import async_session_factory
    from app.services import terms

    async def go():
        async with async_session_factory() as db:
            await terms.accept(db, tg_id, "ru", "bot")
    asyncio.run(go())


def buttons(m):
    return [(b.text, b.web_app.url if b.web_app else b.callback_data) for row in m.replies[-1][1].inline_keyboard for b in row]


def test_stall_qr(api, ok, admin, monkeypatch):
    from app.bot import bot as botmod, notify
    monkeypatch.setattr(botmod.settings, "WEBAPP_URL", "https://bozorbot.uz")
    sent = []
    async def fake_send(chat, text, keyboard=None): sent.append((str(chat), text, keyboard))
    monkeypatch.setattr(notify, "_send", fake_send)

    # the owner signs in once inside Telegram, so the bot knows them
    c, r = api("POST", "/seller/login", {"phone_or_slug": "+998 93 222-33-44", "pin": "2222"}, {"x-telegram-init-data": init_data(OWNER, "Karen")})
    OT = {"x-seller-token": r["token"]}
    c, q = api("GET", "/seller/stall-qr", None, OT)
    ok(c == 200 and q["link"] == f"https://t.me/TestBozorBot?start=stall_{r['store']['id']}", f"owner gets the permanent QR link {q}")
    sid = str(r["store"]["id"])
    c2, q2 = api("GET", "/seller/stall-qr", None, OT)
    ok(q2["link"] == q["link"], "the same QR every time (it is printed)")

    m = Msg(OWNER, "Karen"); asyncio.run(botmod.stall_qr(m, sid))
    ok([u for _, u in buttons(m)] == ["https://bozorbot.uz?tab=seller_cabinet&lang=ru"], "owner scans: straight to the cabinet")

    m = Msg(CUSTOMER, "Xaridor"); asyncio.run(botmod.stall_qr(m, sid))
    ok(m.replies and m.replies[0][0] == botmod.REG_TEXTS["choose_lang"] and "jreq_" not in str(m.replies),
       "a new customer scans: the bot's normal start (choose a language), nothing about the stall")
    asyncio.run(botmod.save_customer(CUSTOMER, lang="ru", phone="+998901112299", name="Xaridor"))
    accept_rules(CUSTOMER)
    m = Msg(CUSTOMER, "Xaridor"); asyncio.run(botmod.stall_qr(m, sid))
    welcome = botmod.TEXTS["ru"]["welcome"]
    ok(any(text == welcome for text, _ in m.replies), "a registered customer scans: the bot's start page (welcome + shop)")
    ok(f"jreq_{sid}" in str(buttons(m)) and "tab=seller_cabinet" not in str(m.replies), "plus a small «I work here» button, no cabinet")

    # someone new asks; only the owner can let them in
    key = asyncio.run(botmod.request_join(U(HELPER, "Aziz"), int(sid)))
    asks = [s for s in sent if s[0] == str(OWNER)]
    ok(key == "asked" and asks and "Aziz" in asks[-1][1], "the owner gets «Aziz wants to join — yes / no»")
    ok(asyncio.run(botmod.decide_join(STRANGER, int(sid), str(HELPER), True, "Aziz")) is False, "a stranger cannot approve")
    m = Msg(HELPER, "Aziz"); asyncio.run(botmod.stall_qr(m, sid))
    ok("tab=seller_cabinet" not in str(m.replies), "before the owner says yes, Aziz is still a customer")
    ok(asyncio.run(botmod.decide_join(OWNER, int(sid), str(HELPER), True, "Aziz")) is True, "the owner says yes")
    ok(any(s[0] == str(HELPER) and "добавлены" in s[1] for s in sent), "Aziz is told he was added")
    m = Msg(HELPER, "Aziz"); asyncio.run(botmod.stall_qr(m, sid))
    ok("tab=seller_cabinet" in str(buttons(m)), "now Aziz scans the same QR and goes straight to the cabinet")
    c, r = api("POST", "/seller/tg-login", None, {"x-telegram-init-data": init_data(HELPER, "Aziz")})
    ok(c == 200 and r["role"] == "helper", "and the cabinet lets him in by Telegram, no PIN")

    asyncio.run(botmod.request_join(U(STRANGER, "Begona"), int(sid)))
    ok(asyncio.run(botmod.decide_join(OWNER, int(sid), str(STRANGER), False)) is True, "the owner says no to a stranger")
    ok(api("POST", "/seller/tg-login", None, {"x-telegram-init-data": init_data(STRANGER, "Begona")})[0] == 404, "the stranger is not let in")

    m = Msg(CUSTOMER, "Xaridor"); asyncio.run(botmod.stall_qr(m, "999999"))
    ok("не найдена" in m.replies[-1][0], "a wrong stall number: «stall not found»")


def test_registered_owner_never_asked(api, ok, admin, monkeypatch):
    """Shuhrat: the stall's registered owner who scans the QR goes in without any approval, even the very first time."""
    from app.bot import bot as botmod, notify
    monkeypatch.setattr(botmod.settings, "WEBAPP_URL", "https://bozorbot.uz")
    async def fake_send(chat, text, keyboard=None): pass
    monkeypatch.setattr(notify, "_send", fake_send)
    stores = api("GET", "/stores")[1]
    st = [x for x in stores if x["owner_phone"] == "+998 90 123-45-67"] or [x for x in stores if x["id"] != 2]
    st = st[0]
    ok(api("POST", "/seller/tg-login", None, {"x-telegram-init-data": init_data(OWNER2, "Egasi")})[0] == 404, "before: the bot does not know this owner")
    # the owner registered in the bot as a customer with their own (Telegram-confirmed) phone, never opened the cabinet
    asyncio.run(botmod.save_customer(OWNER2, lang="uz", phone=st["owner_phone"], name=st["owner_name"]))
    m = Msg(OWNER2, "Egasi"); asyncio.run(botmod.stall_qr(m, str(st["id"])))
    ok("tab=seller_cabinet" in str(buttons(m)) and "jreq_" not in str(m.replies), "the owner scans the QR: straight to the cabinet, nothing asked")
    c, r = api("POST", "/seller/tg-login", None, {"x-telegram-init-data": init_data(OWNER2, "Egasi")})
    ok(c == 200 and r["role"] == "owner" and r["store"]["id"] == st["id"], "and the cabinet opens as the owner, no PIN")
    # someone with another phone is still only a customer
    asyncio.run(botmod.save_customer(OWNER2 + 1, lang="uz", phone="+998977777777", name="Boshqa"))
    m = Msg(OWNER2 + 1, "Boshqa"); asyncio.run(botmod.stall_qr(m, str(st["id"])))
    ok("tab=seller_cabinet" not in str(m.replies), "a different phone is not the owner")
