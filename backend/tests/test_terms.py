"""Platform rules (Davlatbek's father and Shuhrat): everyone sees «DIQQAT!» once and taps «Roziman»; the bot remembers
who accepted which version and when. Payment and quality are between the users themselves."""
import asyncio
import re
from pathlib import Path

from test_stall_qr import Msg, U
from test_stall_team import init_data

NEW, OLD = 9101, 9102


class Query:
    def __init__(s, uid, data):
        s.from_user = U(uid, "Ali"); s.data = data; s.message = Msg(uid, "Ali"); s.answers = []
        async def edit(**kw): pass
        s.message.edit_reply_markup = edit
    async def answer(s, text=None, **kw): s.answers.append(text)


def test_rules_asked_once_in_bot(api, ok, monkeypatch):
    from app.bot import bot as botmod
    from app.services import terms
    monkeypatch.setattr(botmod.settings, "WEBAPP_URL", "https://bozorbot.uz")
    handlers = {}

    # A new person: language, then the rules, and only then the phone
    customer = asyncio.run(botmod.save_customer(NEW, lang="uz"))
    m = Msg(NEW, "Ali"); asyncio.run(botmod.continue_registration(m, customer))
    text, kb = m.replies[-1]
    ok("DIQQAT" in text and "nasiya" in text and "javobgarlik" in text.lower(), "after the language: «DIQQAT!» with payment and responsibility")
    labels = [b.text for row in kb.inline_keyboard for b in row]
    ok(terms.AGREE["uz"] in labels and any("tab=terms" in (b.web_app.url if b.web_app else "") for row in kb.inline_keyboard for b in row),
       "buttons: «Roziman» and the full rules")

    # Someone registered before the rules existed is asked too, once
    asyncio.run(botmod.save_customer(OLD, lang="ru", phone="+998901234500", name="Eski"))
    m = Msg(OLD, "Eski"); asyncio.run(botmod.start_customer(m))
    ok(m.replies and "ВНИМАНИЕ" in m.replies[-1][0], "an earlier customer gets the rules before the shop")

    # «Roziman»: saved, and the bot goes on to the phone (new) / the shop (earlier customer)
    handler = botmod.accept_terms
    q = Query(NEW, "terms_ok"); asyncio.run(handler(q))
    ok(botmod.REG_TEXTS["ask_phone"]["uz"][:20] in str(q.message.replies), "after «Roziman» the bot asks for the phone")
    q = Query(OLD, "terms_ok"); asyncio.run(handler(q))
    m = Msg(OLD, "Eski"); asyncio.run(botmod.start_customer(m))
    ok(any(t == botmod.TEXTS["ru"]["welcome"] for t, _ in m.replies), "asked once: next time straight to the shop")


def test_rules_in_app(api, ok):
    ok(api("GET", "/terms/status")[1]["accepted"] is False, "outside Telegram: not accepted")
    h = {"x-telegram-init-data": init_data(9103, "Vali")}
    ok(api("GET", "/terms/status", headers=h)[1]["accepted"] is False, "a Telegram user who has not accepted yet")
    c, r = api("POST", "/terms/accept", {"lang": "ru"}, h)
    ok(c == 200 and r["saved"] is True, "«Roziman» in the app is saved")
    ok(api("GET", "/terms/status", headers=h)[1]["accepted"] is True, "the app remembers it")
    ok(api("POST", "/terms/accept", {"lang": "ru"})[1]["saved"] is False, "no Telegram account: nothing to save on the server")


def test_versions_match():
    from app.services.terms import TERMS_VERSION
    js = (Path(__file__).resolve().parents[2] / "frontend" / "src" / "services" / "terms.js").read_text()
    assert re.search(r"TERMS_VERSION = '([^']+)'", js).group(1) == TERMS_VERSION, "bot and app must ask about the same rules"
