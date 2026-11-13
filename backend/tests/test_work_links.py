"""One link per job: t.me/<bot>?start=porter opens only the aravachi cabinet, start=work shows all four jobs."""
import asyncio


class U:
    def __init__(s, uid): s.id = uid; s.first_name = "Ishchi"; s.username = None


class Msg:
    def __init__(s, text): s.from_user = U(5550001); s.text = text; s.replies = []
    async def answer(s, text, reply_markup=None, **kw): s.replies.append((text, reply_markup))


def buttons(msg):
    return [(b.text, b.web_app.url) for row in msg.replies[-1][1].inline_keyboard for b in row]


def test_work_links(ok, monkeypatch):
    from app.bot import bot as botmod
    monkeypatch.setattr(botmod.settings, "WEBAPP_URL", "https://bozorbot.uz")
    for role, tab in (("porter", "tab=porter"), ("taxi", "tab=taxi"), ("pattachi", "tab=pattachi"), ("seller", "tab=seller")):
        m = Msg(f"/start {role}")
        asyncio.run(botmod.send_work_entry(m, role))
        b = buttons(m)
        ok(len(b) == 1 and b[0][1] == f"https://bozorbot.uz?{tab}", f"{role}: one button straight to {tab}")
    m = Msg("/start work")
    asyncio.run(botmod.send_work_entry(m, "work"))
    ok([u.split("?")[1] for _, u in buttons(m)] == ["tab=seller", "tab=porter", "tab=taxi", "tab=pattachi"], "work: all four jobs, no shop")
    ok("Bozor xodimlari" in m.replies[-1][0], "the message says it is for the bazaar's workers")
