"""👥 Mijozlarim (Shuhrat, 2026-11-28): the stall's own customer list, filled by hand and by the nasiya notebook; a
personal invite per customer (name filled in, the stall's goods open); the stall's invite link for the counter."""
import asyncio
from datetime import date, timedelta

from test_stall_qr import Msg, buttons, accept_rules


def seller(api, phone="+998 93 222-33-44", pin="2222"):
    c, r = api("POST", "/seller/login", {"phone_or_slug": phone, "pin": pin})
    assert c == 200, r
    return {"x-seller-token": r["token"]}, r["store"]["id"]


def test_list_by_hand_and_from_nasiya(api, ok):
    ST, _ = seller(api)
    ok(api("GET", "/seller/clients", None, ST)[1]["clients"] == [], "an empty list to start with")
    c, a = api("POST", "/seller/clients", {"name": "Dilnoza opa", "phone": "90 111 22 33", "note": "har juma keladi"}, ST)
    ok(c == 200 and a["phone"] == "+998 90 111 22 33" and a["note"] == "har juma keladi", f"added by hand: {a}")
    ok(api("POST", "/seller/clients", {"name": "Boshqa", "phone": "+998901112233"}, ST)[0] == 409, "the same phone twice: refused")
    ok(api("POST", "/seller/clients", {"name": "Raqamsiz"}, ST)[0] == 200, "a customer without a phone is fine")
    ok(api("POST", "/seller/clients", {"name": "X", "phone": "90 11"}, ST)[0] in (400, 422), "a half phone is refused")
    c, e = api("PATCH", f"/seller/clients/{a['id']}", {"name": "Dilnoza opa", "phone": "90 111 22 33", "note": "go'sht oladi"}, ST)
    ok(c == 200 and e["note"] == "go'sht oladi", "the note is edited")

    due = (date.today() + timedelta(days=7)).isoformat()
    c, _ = api("POST", "/seller/debts", {"customer_name": "Rustam aka", "customer_phone": "93 555 66 77", "amount": 50000, "due_date": due}, ST)
    ok(c == 200, f"a nasiya entry is written: {c}")
    names = {x["name"]: x for x in api("GET", "/seller/clients", None, ST)[1]["clients"]}
    ok("Rustam aka" in names and names["Rustam aka"]["source"] == "nasiya", "the nasiya customer joins the list by himself")
    api("POST", "/seller/debts", {"customer_name": "Rustam", "customer_phone": "93 555 66 77", "amount": 20000, "due_date": due}, ST)
    ok(len([x for x in api("GET", "/seller/clients", None, ST)[1]["clients"] if x["phone"] == "+998 93 555 66 77"]) == 1,
       "a second entry for the same phone does not add him twice")

    other, _ = seller(api, "+998 97 333-44-55", "3333")
    ok(all(x["name"] != "Dilnoza opa" for x in api("GET", "/seller/clients", None, other)[1]["clients"]), "another stall does not see this list")
    ok(api("DELETE", f"/seller/clients/{a['id']}", None, other)[0] == 404, "and cannot delete from it")
    ok(api("DELETE", f"/seller/clients/{a['id']}", None, ST)[0] == 200, "the stall removes her from its list")
    ok(api("GET", "/seller/clients")[0] == 401, "nobody without the cabinet sees anything")


def test_personal_invite_and_stall_link(api, ok, monkeypatch):
    from app.bot import bot as botmod
    monkeypatch.setattr(botmod.settings, "WEBAPP_URL", "https://bozorbot.uz")
    ST, sid = seller(api)
    a = api("POST", "/seller/clients", {"name": "Zarina opa", "phone": "97 700 00 01"}, ST)[1]
    ok(a["in_bot"] is False, "not in the bot yet")
    c, inv = api("POST", f"/seller/clients/{a['id']}/invite", None, ST)
    ok(c == 200 and "start=cl_" in inv["link"], f"a personal invite link: {inv}")
    ok(api("POST", f"/seller/clients/{a['id']}/invite", None, ST)[1]["link"] == inv["link"], "the same invite every time")
    token = inv["link"].split("cl_")[1]

    uid = 9501
    m = Msg(uid, "Zarina"); asyncio.run(botmod.client_invite(m, token))
    ok(m.replies[0][0] == botmod.REG_TEXTS["choose_lang"], "a new person: registration starts")
    customer = asyncio.run(botmod.get_customer(uid))
    ok(customer and customer.name == "Zarina opa", "the name the seller wrote is already filled in")
    asyncio.run(botmod.save_customer(uid, lang="ru", phone="+998977000001"))
    accept_rules(uid)
    customer = asyncio.run(botmod.get_customer(uid))
    m = Msg(uid, "Zarina"); asyncio.run(botmod.continue_registration(m, customer))
    ok(f"store={sid}" in str(m.replies), "once the phone is shared, the stall's goods open")
    lst = {x["name"]: x for x in api("GET", "/seller/clients", None, ST)[1]["clients"]}
    ok(lst["Zarina opa"]["in_bot"] is True, "the list shows «✅ in the bot»")
    m = Msg(uid, "Zarina"); asyncio.run(botmod.client_invite(m, "nonsense-token"))
    ok("устарело" in m.replies[-1][0], "a wrong invite says so")

    c, shop = api("GET", "/seller/clients/shop-link", None, ST)
    ok(c == 200 and shop["link"].endswith(f"start=shop_{sid}"), f"the stall's invite link: {shop}")
    buyer = 9502
    asyncio.run(botmod.save_customer(buyer, lang="uz", phone="+998977000002", name="Anvar"))
    accept_rules(buyer)
    m = Msg(buyer, "Anvar"); asyncio.run(botmod.shop_entry(m, str(sid)))
    urls = [u for _, u in buttons(m)]
    ok(any(f"?store={sid}" in u for u in urls), f"a registered buyer: straight to this stall's goods {urls}")
    lst = {x["name"]: x for x in api("GET", "/seller/clients", None, ST)[1]["clients"]}
    ok("Anvar" in lst and lst["Anvar"]["source"] == "link", "and he joins the stall's list")
    m = Msg(buyer, "Anvar"); asyncio.run(botmod.shop_entry(m, "999999"))
    ok("не найдена" in m.replies[-1][0] or "topilmadi" in m.replies[-1][0], "a wrong stall: «stall not found»")
