"""Sign-in for sellers and bazaar administration."""
import hashlib
import hmac
import re
import time
from collections import defaultdict
from typing import Optional

from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.schemas import StoreModel

TOKEN_TTL_SECONDS = 30 * 24 * 3600

# The bot token is a secret that only lives in the server settings, never in the repository
_SECRET = hashlib.sha256(f"seller-auth:{settings.TELEGRAM_BOT_TOKEN or settings.ADMIN_SECRET_KEY}".encode()).digest()


def normalize_phone(phone: str) -> str:
    digits = re.sub(r"\D", "", phone or "")
    return digits[-9:]  # local Uzbek number without +998


def _sign(store_id: int, expires: int, pin: str) -> str:
    # The PIN is part of the signature, so changing the PIN signs out old sessions
    msg = f"{store_id}.{expires}.{pin}".encode()
    return hmac.new(_SECRET, msg, hashlib.sha256).hexdigest()[:40]


def make_seller_token(store: StoreModel) -> str:
    expires = int(time.time()) + TOKEN_TTL_SECONDS
    return f"{store.id}.{expires}.{_sign(store.id, expires, store.seller_pin)}"


async def current_store(
    x_seller_token: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
) -> StoreModel:
    unauthorized = HTTPException(status_code=401, detail="Iltimos, qaytadan kiring / Пожалуйста, войдите снова")
    try:
        store_id_s, expires_s, signature = (x_seller_token or "").split(".")
        store_id, expires = int(store_id_s), int(expires_s)
    except ValueError:
        raise unauthorized
    if expires < time.time():
        raise unauthorized
    store = await db.get(StoreModel, store_id)
    if not store or not hmac.compare_digest(signature, _sign(store.id, expires, store.seller_pin)):
        raise unauthorized
    return store


# Simple brute-force protection: 5 wrong PINs → 10 minutes pause (per phone and per device address)
_failures = defaultdict(list)
MAX_FAILURES = 5
LOCK_SECONDS = 600


def _recent(key: str):
    now = time.time()
    _failures[key] = [t for t in _failures[key] if now - t < LOCK_SECONDS]
    return _failures[key]


def client_ip(request: Request) -> str:
    # Render's proxy appends the real address as the last X-Forwarded-For entry
    forwarded = request.headers.get("x-forwarded-for", "")
    if forwarded:
        return forwarded.split(",")[-1].strip()
    return request.client.host if request.client else "?"


def check_not_locked(request: Request, *keys: str):
    ip = client_ip(request)
    for key in (f"ip:{ip}", *keys):
        if len(_recent(key)) >= MAX_FAILURES:
            raise HTTPException(status_code=429, detail="Ko'p urinish. 10 daqiqadan keyin qayta urinib ko'ring / Слишком много попыток. Попробуйте через 10 минут")


def record_failure(request: Request, *keys: str):
    ip = client_ip(request)
    for key in (f"ip:{ip}", *keys):
        _recent(key).append(time.time())


def check_admin(request: Request, x_admin_pin: Optional[str] = Header(None)):
    """Bazaar administration PIN (ADMIN_PIN in the server settings). Empty means the feature is off."""
    check_not_locked(request)
    if not settings.ADMIN_PIN:
        raise HTTPException(status_code=403, detail="Ma'muriyat PIN-kodi sozlanmagan / PIN администрации не настроен")
    if not x_admin_pin or not hmac.compare_digest(x_admin_pin.strip(), settings.ADMIN_PIN):
        record_failure(request)
        raise HTTPException(status_code=403, detail="Ma'muriyat PIN-kodi noto'g'ri / Неверный PIN администрации")
