"""Server errors reach the Bozorkom's Telegram at once, instead of waiting for a customer to complain.

The same error is sent at most once in 10 minutes: one broken thing must not flood the chat.
"""
import asyncio
import logging
import time

THROTTLE_SECONDS = 600
_last_sent = {}


class AdminAlertHandler(logging.Handler):
    def __init__(self):
        super().__init__(level=logging.ERROR)

    def emit(self, record: logging.LogRecord):
        try:
            # Messages about sending messages must not trigger more messages
            if record.name.startswith(("app.bot", "aiogram")):
                return
            summary = record.getMessage().splitlines()[0][:300] if record.getMessage() else record.name
            if record.exc_info and record.exc_info[1] is not None:
                summary = f"{summary}\n{type(record.exc_info[1]).__name__}: {str(record.exc_info[1])[:300]}"
            key = (record.name, summary[:120])
            now = time.monotonic()
            if now - _last_sent.get(key, -THROTTLE_SECONDS) < THROTTLE_SECONDS:
                return
            _last_sent[key] = now
            from app.bot.notify import send_error_alert
            asyncio.get_running_loop().create_task(send_error_alert(record.name, summary))
        except Exception:
            pass  # an alert must never break the request that failed


def install():
    handler = AdminAlertHandler()
    for name in ("", "uvicorn", "uvicorn.error"):
        logger = logging.getLogger(name)
        if not any(isinstance(h, AdminAlertHandler) for h in logger.handlers):
            logger.addHandler(handler)
