"""👥 Mijozlarim: a stall's own customers (Shuhrat, 2026-11-28).

1. The seller's list of regulars: name, phone, note; the nasiya notebook adds whoever gets goods on credit.
2. A personal invite per customer: a QR on the seller's screen; the customer scans it, taps «Start» (Telegram
   requires that one tap), the name is already filled in, and the stall's shop opens.
3. The stall's invite link / QR for the counter: buyers land straight in this stall's products and join its list.
Only the stall (owner and helpers) sees its list; the bozorkom does not.
"""
import secrets
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import current_store, normalize_phone
from app.database import get_db
from app.models.schemas import CustomerModel, StallClientModel, StoreModel

router = APIRouter(prefix="/api/seller/clients", tags=["clients"])

MAX_CLIENTS = 2000


def _phone(raw: Optional[str]) -> Optional[str]:
    if not raw or not raw.strip():
        return None
    digits = normalize_phone(raw)
    if len(digits) != 9:
        raise HTTPException(status_code=400, detail="Telefon raqamini to'liq kiriting / Введите номер телефона полностью")
    return digits


def _pretty(phone: Optional[str]) -> Optional[str]:
    return f"+998 {phone[0:2]} {phone[2:5]} {phone[5:7]} {phone[7:9]}" if phone else None


async def remember(db: AsyncSession, store_id: int, name: str, phone: Optional[str], source: str,
                   tg_id: Optional[str] = None) -> StallClientModel:
    """Add a customer to the stall's list once (by phone, else by Telegram account); a known one keeps its name."""
    phone = normalize_phone(phone) if phone else None
    if phone and len(phone) != 9:
        phone = None
    found = None
    if phone:
        found = (await db.execute(select(StallClientModel).where(
            StallClientModel.store_id == store_id, StallClientModel.phone == phone))).scalars().first()
    if not found and tg_id:
        found = (await db.execute(select(StallClientModel).where(
            StallClientModel.store_id == store_id, StallClientModel.tg_id == str(tg_id)))).scalars().first()
    if found:
        if tg_id and not found.tg_id:
            found.tg_id = str(tg_id)
        if phone and not found.phone:
            found.phone = phone
        return found
    client = StallClientModel(store_id=store_id, name=(name or "—").strip()[:100], phone=phone,
                              tg_id=str(tg_id) if tg_id else None, source=source, created_at=datetime.utcnow())
    db.add(client)
    await db.flush()
    return client


async def _in_bot(db: AsyncSession, clients) -> set:
    """Which of these customers already use the bot: linked by an invite, or registered with this phone."""
    phones = {c.phone for c in clients if c.phone and not c.tg_id}
    known = set()
    if phones:
        rows = (await db.execute(select(CustomerModel.phone).where(CustomerModel.phone.isnot(None)))).scalars().all()
        registered = {normalize_phone(p) for p in rows}
        known = phones & registered
    return {c.id for c in clients if c.tg_id or (c.phone and c.phone in known)}


def _public(c: StallClientModel, in_bot: bool) -> dict:
    return {"id": c.id, "name": c.name, "phone": _pretty(c.phone), "note": c.note or "", "source": c.source,
            "in_bot": in_bot, "created_at": c.created_at.isoformat() if c.created_at else None}


@router.get("")
async def list_clients(store: StoreModel = Depends(current_store), db: AsyncSession = Depends(get_db)):
    clients = (await db.execute(select(StallClientModel).where(StallClientModel.store_id == store.id)
                                .order_by(StallClientModel.name))).scalars().all()
    in_bot = await _in_bot(db, clients)
    return {"clients": [_public(c, c.id in in_bot) for c in clients]}


class ClientSchema(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    phone: Optional[str] = Field(None, max_length=30)
    note: Optional[str] = Field(None, max_length=200)


@router.post("")
async def add_client(data: ClientSchema, store: StoreModel = Depends(current_store), db: AsyncSession = Depends(get_db)):
    phone = _phone(data.phone)
    if phone and (await db.execute(select(StallClientModel.id).where(
            StallClientModel.store_id == store.id, StallClientModel.phone == phone))).first():
        raise HTTPException(status_code=409, detail="Bu raqamli mijoz ro'yxatda bor / Покупатель с этим номером уже в списке")
    count = len((await db.execute(select(StallClientModel.id).where(StallClientModel.store_id == store.id))).all())
    if count >= MAX_CLIENTS:
        raise HTTPException(status_code=409, detail="Ro'yxat to'lgan / Список заполнен")
    client = StallClientModel(store_id=store.id, name=data.name.strip(), phone=phone, note=(data.note or "").strip() or None,
                              source="manual", created_at=datetime.utcnow())
    db.add(client)
    await db.commit()
    await db.refresh(client)
    return _public(client, bool((await _in_bot(db, [client]))))


async def _mine(db: AsyncSession, store: StoreModel, client_id: int) -> StallClientModel:
    client = await db.get(StallClientModel, client_id)
    if not client or client.store_id != store.id:
        raise HTTPException(status_code=404, detail="Mijoz topilmadi / Покупатель не найден")
    return client


@router.patch("/{client_id}")
async def edit_client(client_id: int, data: ClientSchema, store: StoreModel = Depends(current_store), db: AsyncSession = Depends(get_db)):
    client = await _mine(db, store, client_id)
    phone = _phone(data.phone)
    if phone and phone != client.phone and (await db.execute(select(StallClientModel.id).where(
            StallClientModel.store_id == store.id, StallClientModel.phone == phone))).first():
        raise HTTPException(status_code=409, detail="Bu raqamli mijoz ro'yxatda bor / Покупатель с этим номером уже в списке")
    client.name, client.phone, client.note = data.name.strip(), phone, (data.note or "").strip() or None
    await db.commit()
    return _public(client, bool(await _in_bot(db, [client])))


@router.delete("/{client_id}")
async def delete_client(client_id: int, store: StoreModel = Depends(current_store), db: AsyncSession = Depends(get_db)):
    """Only off the stall's list: the person's nasiya entries and their bot account stay as they are."""
    client = await _mine(db, store, client_id)
    await db.delete(client)
    await db.commit()
    return {"success": True}


async def _bot_username() -> str:
    from app.bot.bot import get_bot_username
    username = await get_bot_username()
    if not username:
        raise HTTPException(status_code=503, detail="Bot hozir ishlamayapti / Бот сейчас недоступен")
    return username


@router.post("/{client_id}/invite")
async def invite_client(client_id: int, store: StoreModel = Depends(current_store), db: AsyncSession = Depends(get_db)):
    """The customer's personal QR: scanned on the seller's screen, the bot opens with the name already filled in."""
    client = await _mine(db, store, client_id)
    if not client.invite_token:
        client.invite_token = secrets.token_urlsafe(12)
        await db.commit()
    return {"link": f"https://t.me/{await _bot_username()}?start=cl_{client.invite_token}"}


@router.get("/shop-link")
async def shop_link(store: StoreModel = Depends(current_store)):
    """The stall's invite for buyers (fine on the counter, unlike the staff sheet): straight to this stall's goods."""
    return {"link": f"https://t.me/{await _bot_username()}?start=shop_{store.id}"}
