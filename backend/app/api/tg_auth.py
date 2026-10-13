"""Check that Mini App data really comes from Telegram (https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)."""
import hashlib
import hmac
import json
import time
from typing import Optional
from urllib.parse import parse_qsl

from app.config import settings

MAX_AGE_SECONDS = 24 * 3600


def telegram_user(init_data: Optional[str]) -> Optional[dict]:
    """Return the Telegram user from signed initData, or None if it is missing or forged."""
    if not init_data or not settings.TELEGRAM_BOT_TOKEN:
        return None
    try:
        fields = dict(parse_qsl(init_data, keep_blank_values=True))
        received_hash = fields.pop("hash", "")
        check_string = "\n".join(f"{k}={v}" for k, v in sorted(fields.items()))
        secret = hmac.new(b"WebAppData", settings.TELEGRAM_BOT_TOKEN.encode(), hashlib.sha256).digest()
        expected = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, received_hash):
            return None
        if time.time() - int(fields.get("auth_date", "0")) > MAX_AGE_SECONDS:
            return None
        user = json.loads(fields.get("user", "{}"))
        return user if user.get("id") else None
    except (ValueError, json.JSONDecodeError):
        return None
