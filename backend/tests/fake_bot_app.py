# Test server: the real app, but the bot never talks to Telegram (fixed name, messages go to a file)
import json
import os

import app.bot.bot as botmod
import app.bot.notify as notify


async def fake_username():
    return "TestBozorBot"


async def fake_send(chat_id, text, keyboard=None):
    with open(os.environ["SENT_LOG"], "a") as f:
        f.write(json.dumps({"chat": str(chat_id), "text": text[:80]}) + "\n")


async def fake_file(filename, data, caption):
    from app.database import async_session_factory
    from app.services.config_store import get_setting
    async with async_session_factory() as db:
        chat = await get_setting(db, "admin_tg_id")
    if not chat:
        return False
    with open(os.environ["SENT_LOG"], "a") as f:
        f.write(json.dumps({"chat": chat, "file": filename, "lines": data.decode("utf-8-sig").count("\n")}) + "\n")
    return True


botmod.get_bot_username = fake_username
notify._send = fake_send
notify.send_admin_file = fake_file
botmod.get_bot = lambda: None

from app.main import app  # noqa: E402,F401


@app.post("/api/test/driver-location")
async def fake_driver_location(tg_id: int, lat: float, lng: float):
    """Test server only: a live-location update, without Telegram. It runs the bot's own handler code."""
    from types import SimpleNamespace
    message = SimpleNamespace(from_user=SimpleNamespace(id=tg_id), location=SimpleNamespace(latitude=lat, longitude=lng))
    return {"order": await botmod.save_driver_location(message)}
