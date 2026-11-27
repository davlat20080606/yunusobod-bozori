"""Printed QR sheets (Shuhrat, 2026-11-26): blank sheets made before the bazaar, bound to a stall at its registration
on the team's phone; owner and pre-written helpers get in by their phone, a new helper by the sheet's code (the owner
is told and can remove them), a lost sheet is revoked."""
import asyncio

from conftest import FOUNDER_PIN
from test_stall_qr import Msg, U, buttons, accept_rules

OWNER, HELPER, WALKIN, STRANGER = 9101, 9102, 9103, 9104
OWNER_PHONE, HELPER_PHONE = "+998 91 555-10-20", "+998 91 555-30-40"


def register_customer(botmod, uid, phone, name):
    asyncio.run(botmod.save_customer(uid, lang="ru", phone=phone, name=name))
    accept_rules(uid)


def test_sheets_from_print_to_team(api, ok, admin, monkeypatch):
    from app.bot import bot as botmod, notify
    monkeypatch.setattr(botmod.settings, "WEBAPP_URL", "https://bozorbot.uz")
    sent = []
    async def fake_send(chat, text, keyboard=None): sent.append((str(chat), text, keyboard))
    monkeypatch.setattr(notify, "_send", fake_send)
    founder = {"x-admin-token": api("POST", "/admin/login", {"pin": FOUNDER_PIN})[1]["token"]}

    # 1. blank sheets, made by the founder (the field team), not only by the bozorkom
    c, r = api("POST", "/admin/kits", {"count": 3}, founder)
    ok(c == 200 and len(r["kits"]) == 3, f"the founder makes a batch of 3 sheets: {c} {r}")
    kits = r["kits"]
    ok(all(k["status"] == "unbound" and k["code"].startswith("BZR-") and len(k["pin"]) == 4 and len(k["token"]) >= 20
           for k in kits), "each sheet: blank, a BZR code, a 4-digit activation code, a long random token")
    ok(len({k["token"] for k in kits}) == 3, "every sheet has its own token")
    ok(api("POST", "/admin/kits", {"count": 500}, founder)[0] == 422, "no more than 200 sheets at once")
    ok(api("POST", "/admin/kits", {"count": 1})[0] == 401, "nobody else can make sheets")
    listed = api("GET", "/admin/kits", None, founder)[1]
    ok("token" not in str(listed["kits"]) and "pin" not in listed["kits"][0], "the list never shows tokens or codes")

    k1, k2, k3 = kits
    m = Msg(STRANGER, "Begona"); asyncio.run(botmod.kit_qr(m, k1["token"]))
    ok("не привязан" in m.replies[-1][0], "a blank sheet scanned: «not linked to a stall yet»")

    # 2. registration at the stall on the founder's phone; the sheet is bound by its scanned QR
    c, r = api("POST", "/admin/kits/lookup", {"text": f"https://t.me/TestBozorBot?start=kit_{k1['token']}"}, founder)
    ok(c == 200 and r["code"] == k1["code"] and r["status"] == "unbound", "the scanned QR is recognised")
    num = int(k1["code"].split("-")[1])
    ok(api("POST", "/admin/kits/lookup", {"text": f"bzr {num}"}, founder)[1].get("code") == k1["code"],
       "the printed code typed by hand works too")
    from conftest import ADMIN_PIN
    from test_stall_team import init_data as _init
    api("POST", "/admin/login", {"pin": ADMIN_PIN}, {"x-telegram-init-data": _init(9100, "Bozorkom")})  # applications go to them
    cat = api("GET", "/stores")[1][0]["category_slug"]
    form = {"name_uz": "Olmazor mevalari", "stall_number": "M-17", "owner_name": "Rustam", "owner_phone": OWNER_PHONE,
            "category_slug": cat, "helper_phones": [HELPER_PHONE], "kit": f"https://t.me/TestBozorBot?start=kit_{k1['token']}"}
    c, r = api("POST", "/admin/kits/register", form, founder)
    ok(c == 200 and r["status"] == "pending" and r["kit"] == k1["code"] and len(r["seller_pin"]) == 6,
       f"the founder registers the stall: it waits for the bozorkom: {c} {r}")
    sid = r["store_id"]
    import json, time
    from conftest import SENT_LOG
    for _ in range(20):  # the server sends it in the background
        texts = [json.loads(line).get("text", "") for line in open(SENT_LOG) if '"9100"' in line]
        if any("M-17" in t for t in texts):
            break
        time.sleep(0.1)
    ok(any("M-17" in t for t in texts), "the bozorkom gets the application")
    ok(api("POST", "/admin/kits/register", {**form, "owner_phone": "+998 91 555-99-99"}, founder)[0] == 409,
       "a sheet already used cannot register another stall")

    register_customer(botmod, OWNER, OWNER_PHONE, "Rustam")
    m = Msg(OWNER, "Rustam"); asyncio.run(botmod.kit_qr(m, k1["token"]))
    ok("ждёт подтверждения" in m.replies[-1][0], "before the bozorkom approves: «waiting for approval»")
    ok(api("POST", f"/admin/stores/{sid}/status", {"status": "approved"}, admin)[0] == 200, "the bozorkom approves")

    # 3. the owner: in by the phone written at registration
    m = Msg(OWNER, "Rustam"); asyncio.run(botmod.kit_qr(m, k1["token"]))
    ok("tab=seller_cabinet" in str(buttons(m)), "the owner scans the sheet: straight to the cabinet")
    from test_stall_team import init_data
    c, r = api("POST", "/seller/tg-login", None, {"x-telegram-init-data": init_data(OWNER, "Rustam")})
    ok(c == 200 and r["role"] == "owner" and r["store"]["id"] == sid, "as the owner")

    # 4. the helper written at registration: in by phone, even with the owner away
    register_customer(botmod, HELPER, HELPER_PHONE, "Aziz")
    m = Msg(HELPER, "Aziz"); asyncio.run(botmod.kit_qr(m, k1["token"]))
    ok("tab=seller_cabinet" in str(buttons(m)), "the pre-written helper scans: straight in, nobody asked")
    c, r = api("POST", "/seller/tg-login", None, {"x-telegram-init-data": init_data(HELPER, "Aziz")})
    ok(c == 200 and r["role"] == "helper", "as a helper")

    # 5. a new helper weeks later: the sheet's activation code
    register_customer(botmod, WALKIN, "+998 91 777-00-11", "Sardor")
    m = Msg(WALKIN, "Sardor"); asyncio.run(botmod.kit_qr(m, k1["token"]))
    b = buttons(m)
    ok(any(cb.startswith("kpin_") for _, cb in b) and any(cb.startswith("jreq_") for _, cb in b),
       "someone new: «enter the activation code» or «ask the owner»")
    asyncio.run(botmod.ask_kit_pin(U(WALKIN, "Sardor"), k1["id"]))
    wrong = "0000" if k1["pin"] != "0000" else "1111"
    m = Msg(WALKIN, "Sardor"); m.text = wrong
    ok(asyncio.run(botmod.check_kit_pin(m)) and "Неверный" in m.replies[-1][0], "a wrong code is refused")
    sent.clear()
    m = Msg(WALKIN, "Sardor"); m.text = k1["pin"]
    asyncio.run(botmod.check_kit_pin(m))
    ok("tab=seller_cabinet" in str(buttons(m)), "the right code: in at once")
    told = [s for s in sent if s[0] == str(OWNER)]
    ok(told and "Sardor" in told[-1][1] and f"kick_{sid}_{WALKIN}" in str(told[-1][2]),
       "the owner is told, with a «remove» button")
    ok(asyncio.run(botmod.kick_helper(STRANGER, sid, str(WALKIN))) is False, "a stranger cannot remove anyone")
    ok(asyncio.run(botmod.kick_helper(OWNER, sid, str(WALKIN))) is True, "the owner removes him")
    ok(api("POST", "/seller/tg-login", None, {"x-telegram-init-data": init_data(WALKIN, "Sardor")})[0] == 404,
       "and he is out at once")
    m = Msg(STRANGER, "Begona"); m.text = k1["pin"]
    ok(asyncio.run(botmod.check_kit_pin(m)) is False, "a code typed without scanning the sheet does nothing")

    # 6. a lost sheet: revoked, a new one bound to the same stall; the team stays
    ok(api("POST", f"/admin/kits/{k1['id']}/revoke", None, founder)[0] == 200, "the lost sheet is revoked")
    m = Msg(STRANGER, "Begona"); asyncio.run(botmod.kit_qr(m, k1["token"]))
    ok("отменён" in m.replies[-1][0], "the old sheet now says «cancelled»")
    ok(api("POST", "/seller/tg-login", None, {"x-telegram-init-data": init_data(HELPER, "Aziz")})[0] == 200,
       "people already in the team stay in")
    ok(api("POST", "/admin/kits/bind", {"kit": k2["code"], "store_id": sid}, founder)[0] == 200, "a new sheet for the stall")
    m = Msg(OWNER, "Rustam"); asyncio.run(botmod.kit_qr(m, k2["token"]))
    ok("tab=seller_cabinet" in str(buttons(m)), "the new sheet works for the owner")
    ok(api("POST", "/admin/kits/bind", {"kit": k2["code"], "store_id": 1}, founder)[0] == 409,
       "a sheet bound to one stall cannot be moved to another")

    # 7. the bozorkom's own registration needs no approval
    form2 = {**form, "name_uz": "Yunusobod go'sht", "stall_number": "G-3", "owner_phone": "+998 91 555-50-60",
             "helper_phones": [], "kit": k3["code"]}
    c, r = api("POST", "/admin/kits/register", form2, admin)
    ok(c == 200 and r["status"] == "approved", "registered by the bozorkom: approved at once")


def test_registration_finishes_then_stall_opens(api, ok, admin, monkeypatch):
    """The owner scans the sheet before ever opening the bot: after sharing the phone the cabinet opens by itself."""
    from app.bot import bot as botmod, notify
    monkeypatch.setattr(botmod.settings, "WEBAPP_URL", "https://bozorbot.uz")
    async def fake_send(chat, text, keyboard=None): pass
    monkeypatch.setattr(notify, "_send", fake_send)
    kit = api("POST", "/admin/kits", {"count": 1}, admin)[1]["kits"][0]
    cat = api("GET", "/stores")[1][0]["category_slug"]
    phone = "+998 91 555-70-80"
    api("POST", "/admin/kits/register", {"name_uz": "Yangi rasta", "stall_number": "N-1", "owner_name": "Dilshod",
                                         "owner_phone": phone, "category_slug": cat, "kit": kit["code"]}, admin)
    uid = 9201
    m = Msg(uid, "Dilshod"); asyncio.run(botmod.kit_qr(m, kit["token"]))
    ok(m.replies[0][0] == botmod.REG_TEXTS["choose_lang"], "first time in the bot: registration starts")
    asyncio.run(botmod.save_customer(uid, lang="ru", phone=phone, name="Dilshod"))
    accept_rules(uid)
    customer = asyncio.run(botmod.get_customer(uid))
    m = Msg(uid, "Dilshod"); asyncio.run(botmod.continue_registration(m, customer))
    ok("tab=seller_cabinet" in str(m.replies), "when registration ends, the stall's cabinet opens without scanning again")
