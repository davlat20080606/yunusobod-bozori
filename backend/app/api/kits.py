"""QR sheets for stalls (Shuhrat, 2026-11-26).

Before going to the bazaar the team prints a batch of blank sheets. At a stall, the bozorkom, the founder or the
partner registers the seller on their phone, scans the sheet (or types its BZR code) and hands it over. The stall
then waits for the bozorkom's approval like any application. After that:
  * the owner scans the sheet and is let in by the phone written at registration (no waiting);
  * a helper whose phone was written at registration is let in the same way;
  * a new helper either types the sheet's 4-digit activation code (in at once, the owner is told and can remove
    them) or asks the owner with one tap.
A lost sheet is revoked; the stall gets a new one without registering again.
"""
import re
import secrets
import uuid
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import current_field_team, normalize_phone
from app.database import get_db
from app.models.schemas import CategoryModel, StoreModel, StoreHelperPhoneModel, VendorKitModel

router = APIRouter(prefix="/api/admin/kits", tags=["kits"])

MAX_BATCH = 200
MAX_HELPERS = 5


def _new_pin() -> str:
    return f"{secrets.randbelow(10000):04d}"


def kit_public(kit: VendorKitModel, store: Optional[StoreModel] = None, with_secret: bool = False) -> dict:
    data = {
        "id": kit.id, "code": kit.code, "status": kit.status, "store_id": kit.store_id,
        "store": f"{store.name_uz} · {store.stall_number}" if store else None,
        "created_at": kit.created_at.isoformat() if kit.created_at else None,
        "bound_at": kit.bound_at.isoformat() if kit.bound_at else None,
    }
    if with_secret:  # only for printing: the QR token and the activation code
        data.update(token=kit.token, pin=kit.pin)
    return data


async def find_kit(db: AsyncSession, text: str) -> Optional[VendorKitModel]:
    """A scanned QR (t.me/…?start=kit_<token>), the bare token, or the printed code (BZR-0042, bzr42, 42)."""
    text = (text or "").strip()
    m = re.search(r"kit_([A-Za-z0-9_-]{16,40})", text)
    if m:
        return (await db.execute(select(VendorKitModel).where(VendorKitModel.token == m.group(1)))).scalars().first()
    digits = re.fullmatch(r"(?i)\s*(?:bzr)?[\s-]*0*(\d{1,6})\s*", text)
    if digits:
        code = f"BZR-{int(digits.group(1)):04d}"
        return (await db.execute(select(VendorKitModel).where(VendorKitModel.code == code))).scalars().first()
    if re.fullmatch(r"[A-Za-z0-9_-]{16,40}", text):
        return (await db.execute(select(VendorKitModel).where(VendorKitModel.token == text))).scalars().first()
    return None


async def bind(db: AsyncSession, kit: Optional[VendorKitModel], store: StoreModel):
    if not kit:
        raise HTTPException(status_code=404, detail="Varaq topilmadi / Лист не найден")
    if kit.status == "revoked":
        raise HTTPException(status_code=409, detail="Bu varaq bekor qilingan / Этот лист отменён")
    if kit.status == "bound" and kit.store_id != store.id:
        raise HTTPException(status_code=409, detail="Bu varaq boshqa rastaga biriktirilgan / Лист уже привязан к другой расте")
    kit.status, kit.store_id, kit.bound_at = "bound", store.id, kit.bound_at or datetime.utcnow()


async def helper_phone_allowed(db: AsyncSession, store_id: int, phone: str) -> bool:
    wanted = normalize_phone(phone)
    if len(wanted) < 9:
        return False
    found = (await db.execute(select(StoreHelperPhoneModel.id).where(
        StoreHelperPhoneModel.store_id == store_id, StoreHelperPhoneModel.phone == wanted))).first()
    return bool(found)


class BatchSchema(BaseModel):
    count: int = Field(..., ge=1, le=MAX_BATCH)


@router.post("")
async def make_batch(data: BatchSchema, db: AsyncSession = Depends(get_db), kind: str = Depends(current_field_team)):
    """Blank sheets to print before going to the bazaar."""
    kits = []
    for _ in range(data.count):
        kit = VendorKitModel(token=secrets.token_urlsafe(18), code=f"TMP-{uuid.uuid4().hex[:12]}", pin=_new_pin(),
                             status="unbound", created_at=datetime.utcnow())
        db.add(kit)
        kits.append(kit)
    await db.flush()
    for kit in kits:
        kit.code = f"BZR-{kit.id:04d}"
    await db.commit()
    return {"kits": [kit_public(k, with_secret=True) for k in kits]}


@router.get("")
async def list_kits(status: Optional[str] = None, db: AsyncSession = Depends(get_db), kind: str = Depends(current_field_team)):
    query = select(VendorKitModel).order_by(VendorKitModel.id.desc()).limit(500)
    if status in ("unbound", "bound", "revoked"):
        query = query.where(VendorKitModel.status == status)
    kits = (await db.execute(query)).scalars().all()
    stores = {}
    ids = {k.store_id for k in kits if k.store_id}
    if ids:
        stores = {s.id: s for s in (await db.execute(select(StoreModel).where(StoreModel.id.in_(ids)))).scalars().all()}
    counts = dict((await db.execute(select(VendorKitModel.status, func.count()).group_by(VendorKitModel.status))).all())
    return {"kits": [kit_public(k, stores.get(k.store_id)) for k in kits], "counts": counts}


class PrintSchema(BaseModel):
    ids: List[int] = Field(..., min_length=1, max_length=MAX_BATCH)


@router.post("/print")
async def print_kits(data: PrintSchema, db: AsyncSession = Depends(get_db), kind: str = Depends(current_field_team)):
    """Sheets to print again (a blank sheet got wet, the printer jammed): QR token and activation code included."""
    from app.bot.bot import get_bot_username
    kits = (await db.execute(select(VendorKitModel).where(VendorKitModel.id.in_(data.ids)))).scalars().all()
    return {"bot": await get_bot_username(), "kits": [kit_public(k, with_secret=True) for k in kits if k.status != "revoked"]}


class LookupSchema(BaseModel):
    text: str = Field(..., min_length=1, max_length=300)


@router.post("/lookup")
async def lookup(data: LookupSchema, db: AsyncSession = Depends(get_db), kind: str = Depends(current_field_team)):
    """What was scanned: the field form shows «BZR-0042 · bo'sh» before binding."""
    kit = await find_kit(db, data.text)
    if not kit:
        raise HTTPException(status_code=404, detail="Varaq topilmadi / Лист не найден")
    store = await db.get(StoreModel, kit.store_id) if kit.store_id else None
    return kit_public(kit, store)


class FieldRegisterSchema(BaseModel):
    name_uz: str = Field(..., min_length=2, max_length=150)
    stall_number: str = Field(..., min_length=1, max_length=50)
    owner_name: str = Field(..., min_length=2, max_length=100)
    owner_phone: str = Field(..., max_length=50)
    category_slug: str = Field(..., max_length=50)
    helper_phones: List[str] = Field(default_factory=list, max_length=MAX_HELPERS)
    kit: str = Field(..., min_length=1, max_length=300)


async def _save_helper_phones(db: AsyncSession, store: StoreModel, phones: List[str]):
    owner = normalize_phone(store.owner_phone)
    have = set((await db.execute(select(StoreHelperPhoneModel.phone).where(
        StoreHelperPhoneModel.store_id == store.id))).scalars().all())
    for raw in phones:
        phone = normalize_phone(raw)
        if not raw.strip():
            continue
        if len(phone) < 9:
            raise HTTPException(status_code=400, detail=f"Yordamchi telefoni to'liq emas / Телефон помощника неполный: {raw}")
        if phone != owner and phone not in have:
            db.add(StoreHelperPhoneModel(store_id=store.id, phone=phone, created_at=datetime.utcnow()))
            have.add(phone)


@router.post("/register")
async def field_register(data: FieldRegisterSchema, db: AsyncSession = Depends(get_db), kind: str = Depends(current_field_team)):
    """A stall registered at the bazaar on the team's phone, its printed sheet bound on the spot. The bozorkom's own
    registration is approved at once; the founder's or the partner's waits for the bozorkom like any application."""
    from app.api.seller import phone_taken
    from app.bot.notify import notify_admin_application
    if len(normalize_phone(data.owner_phone)) < 9:
        raise HTTPException(status_code=400, detail="Telefon raqamini to'liq kiriting / Введите номер телефона полностью")
    if await phone_taken(db, data.owner_phone):
        raise HTTPException(status_code=409, detail="Bu telefon raqami bilan rasta allaqachon bor / Раста с этим телефоном уже есть")
    if not (await db.execute(select(CategoryModel).where(CategoryModel.slug == data.category_slug))).scalars().first():
        raise HTTPException(status_code=400, detail="Bo'lim topilmadi / Раздел не найден")
    kit = await find_kit(db, data.kit)
    if not kit:
        raise HTTPException(status_code=404, detail="Varaq topilmadi / Лист не найден")
    if kit.status != "unbound":
        raise HTTPException(status_code=409, detail="Bu varaq allaqachon ishlatilgan / Этот лист уже использован")

    name = data.name_uz.strip()
    slug = f"{re.sub(r'[^a-zA-Z0-9]+', '-', name.lower()).strip('-') or 'store'}-{uuid.uuid4().hex[:6]}"
    seller_pin = f"{secrets.randbelow(900000) + 100000}"
    store = StoreModel(
        slug=slug, name_uz=name, name_ru=name, name_en=name,
        stall_number=data.stall_number.strip(), owner_name=data.owner_name.strip(), owner_phone=data.owner_phone.strip(),
        seller_pin=seller_pin, category_slug=data.category_slug,
        avatar_url="/img/p/9dbbb0f54890.jpg", banner_url="/img/p/ef38b94878f0.jpg",
        description_uz="Yangi saralangan mahsulotlar.", description_ru="Свежие отборные продукты напрямую с прилавка.",
        description_en="Fresh market produce directly from the stall.",
        is_open=True, status="approved" if kind == "admin" else "pending", rating=5.0, total_orders=0,
    )
    db.add(store)
    await db.flush()
    await _save_helper_phones(db, store, data.helper_phones)
    await bind(db, kit, store)
    await db.commit()
    if store.status == "pending":
        who = {"founder": "asoschi · основатель", "partner": "hamkor · партнёр"}.get(kind, kind)
        notify_admin_application(f"🏪 {store.name_uz} · {store.stall_number} · {store.owner_name} ({store.owner_phone})\n"
                                 f"📄 {kit.code} · {who}")
    return {"success": True, "store_id": store.id, "status": store.status, "kit": kit.code, "seller_pin": seller_pin}


class BindSchema(BaseModel):
    kit: str = Field(..., min_length=1, max_length=300)
    store_id: int
    helper_phones: List[str] = Field(default_factory=list, max_length=MAX_HELPERS)


@router.post("/bind")
async def bind_existing(data: BindSchema, db: AsyncSession = Depends(get_db), kind: str = Depends(current_field_team)):
    """A sheet for a stall that is already in the bot (the first ten), or a new sheet after a lost one."""
    store = await db.get(StoreModel, data.store_id)
    if not store or store.status == "archived":
        raise HTTPException(status_code=404, detail="Rasta topilmadi / Раста не найдена")
    await bind(db, await find_kit(db, data.kit), store)
    await _save_helper_phones(db, store, data.helper_phones)
    await db.commit()
    return {"success": True}


@router.post("/{kit_id}/revoke")
async def revoke(kit_id: int, db: AsyncSession = Depends(get_db), kind: str = Depends(current_field_team)):
    """A lost sheet stops working at once; people already in the stall's team stay in."""
    kit = await db.get(VendorKitModel, kit_id)
    if not kit:
        raise HTTPException(status_code=404, detail="Varaq topilmadi / Лист не найден")
    kit.status, kit.revoked_at = "revoked", datetime.utcnow()
    await db.commit()
    return {"success": True}
