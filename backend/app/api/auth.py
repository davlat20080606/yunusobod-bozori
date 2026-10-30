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
from app.models.schemas import StoreModel, StaffModel
from app.services.order_log import act_as

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


def _sign_member(member_id: int, store_id: int, expires: int, pin: str) -> str:
    msg = f"member.{member_id}.{store_id}.{expires}.{pin}".encode()
    return hmac.new(_SECRET, msg, hashlib.sha256).hexdigest()[:40]


def make_member_token(member, store: StoreModel) -> str:
    """Session of one Telegram account in a stall; removing the member ends it at once."""
    expires = int(time.time()) + TOKEN_TTL_SECONDS
    return f"m{member.id}.{expires}.{_sign_member(member.id, store.id, expires, store.seller_pin)}"


async def seller_identity(x_seller_token: Optional[str], db: AsyncSession):
    """(stall, member) for a seller token; member is None for a PIN session (the owner)."""
    from app.models.schemas import StoreMemberModel
    unauthorized = HTTPException(status_code=401, detail="Iltimos, qaytadan kiring / Пожалуйста, войдите снова")
    try:
        first, expires_s, signature = (x_seller_token or "").split(".")
        expires = int(expires_s)
        member_id = int(first[1:]) if first.startswith("m") else None
        store_id = None if member_id else int(first)
    except ValueError:
        raise unauthorized
    if expires < time.time():
        raise unauthorized
    member = None
    if member_id:
        member = await db.get(StoreMemberModel, member_id)
        if not member:
            raise unauthorized
        store_id = member.store_id
    store = await db.get(StoreModel, store_id)
    if not store:
        raise unauthorized
    expected = _sign_member(member.id, store.id, expires, store.seller_pin) if member else _sign(store.id, expires, store.seller_pin)
    if not hmac.compare_digest(signature, expected):
        raise unauthorized
    act_as("seller", f"{store.id}:{member.tg_id}" if member else store.id)
    return store, member


async def current_store(
    x_seller_token: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
) -> StoreModel:
    store, _ = await seller_identity(x_seller_token, db)
    return store


async def current_owner_store(
    x_seller_token: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
) -> StoreModel:
    """Helpers sell and pack; only the owner changes the PIN, the stall profile and the team."""
    store, member = await seller_identity(x_seller_token, db)
    if member and member.role != "owner":
        raise HTTPException(status_code=403, detail="Buni faqat rasta egasi qila oladi / Это может только владелец расты")
    return store


# Brute-force protection. Mobile operators put many people behind one address, so the strict
# limit is per account (phone); the per-address limit is much higher and only stops mass guessing.
_failures = defaultdict(list)
MAX_FAILURES_PER_ACCOUNT = 5
MAX_FAILURES_PER_ADDRESS = 40
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
    too_many = HTTPException(status_code=429, detail="Ko'p urinish. 10 daqiqadan keyin qayta urinib ko'ring / Слишком много попыток. Попробуйте через 10 минут")
    if len(_recent(f"ip:{client_ip(request)}")) >= MAX_FAILURES_PER_ADDRESS:
        raise too_many
    for key in keys:
        if len(_recent(key)) >= MAX_FAILURES_PER_ACCOUNT:
            raise too_many


def record_failure(request: Request, *keys: str):
    for key in (f"ip:{client_ip(request)}", *keys):
        _recent(key).append(time.time())


def _sign_kind(kind: str, obj_id: int, expires: int, secret_part: str) -> str:
    msg = f"{kind}.{obj_id}.{expires}.{secret_part}".encode()
    return hmac.new(_SECRET, msg, hashlib.sha256).hexdigest()[:40]


def make_staff_token(staff: StaffModel) -> str:
    expires = int(time.time()) + TOKEN_TTL_SECONDS
    return f"{staff.id}.{expires}.{_sign_kind('staff', staff.id, expires, staff.pin)}"


def staff_with_role(*roles: str):
    """Dependency: the signed-in, approved worker with one of these roles."""
    async def dependency(x_staff_token: Optional[str] = Header(None), db: AsyncSession = Depends(get_db)) -> StaffModel:
        unauthorized = HTTPException(status_code=401, detail="Iltimos, qaytadan kiring / Пожалуйста, войдите снова")
        try:
            staff_id_s, expires_s, signature = (x_staff_token or "").split(".")
            staff_id, expires = int(staff_id_s), int(expires_s)
        except ValueError:
            raise unauthorized
        if expires < time.time():
            raise unauthorized
        staff = await db.get(StaffModel, staff_id)
        if not staff or not hmac.compare_digest(signature, _sign_kind("staff", staff.id, expires, staff.pin)):
            raise unauthorized
        if staff.status != "approved":
            raise HTTPException(status_code=403, detail="Hisobingiz faol emas / Ваш аккаунт не активен")
        if roles and staff.role not in roles:
            raise HTTPException(status_code=403, detail="Bu bo'lim siz uchun emas / Этот раздел не для вас")
        act_as(staff.role, staff.id)
        return staff
    return dependency


def make_admin_token() -> str:
    expires = int(time.time()) + TOKEN_TTL_SECONDS
    return f"admin.{expires}.{_sign_kind('admin', 0, expires, settings.ADMIN_PIN)}"


async def current_admin(x_admin_token: Optional[str] = Header(None)):
    """Bozorkom session; changing ADMIN_PIN signs everyone out."""
    unauthorized = HTTPException(status_code=401, detail="Iltimos, qaytadan kiring / Пожалуйста, войдите снова")
    if not settings.ADMIN_PIN:
        raise unauthorized
    try:
        kind, expires_s, signature = (x_admin_token or "").split(".")
        expires = int(expires_s)
    except ValueError:
        raise unauthorized
    if kind != "admin" or expires < time.time() or not hmac.compare_digest(signature, _sign_kind("admin", 0, expires, settings.ADMIN_PIN)):
        raise unauthorized
    act_as("admin")
    return True
