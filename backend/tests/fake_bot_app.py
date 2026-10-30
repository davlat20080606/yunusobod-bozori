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


botmod.get_bot_username = fake_username
notify._send = fake_send
botmod.get_bot = lambda: None

from app.main import app  # noqa: E402,F401
