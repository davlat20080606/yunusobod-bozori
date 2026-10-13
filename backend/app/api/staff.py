"""One registration template for bazaar workers: aravachi, taksichi, pattachi."""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.api.auth import make_staff_token, normalize_phone, check_not_locked, record_failure, staff_with_role
from app.api.tg_auth import telegram_user
from app.models.schemas import StaffModel, StaffRegisterSchema, StaffLoginSchema
from app.bot.notify import notify_admin_application

router = APIRouter(prefix="/api/staff", tags=["staff"])

ROLE_NAMES = {"porter": "Aravachi", "taxi": "Taksichi", "pattachi": "Pattachi"}


def staff_public(s: StaffModel) -> dict:
    return {"id": s.id, "role": s.role, "name": s.name, "phone": s.phone, "status": s.status, "car": s.car}


async def find_by_phone(db: AsyncSession, phone: str) -> Optional[StaffModel]:
    wanted = normalize_phone(phone)
    rows = (await db.execute(select(StaffModel))).scalars().all()
    return next((s for s in rows if normalize_phone(s.phone) == wanted), None)


@router.post("/register")
async def register_staff(
    data: StaffRegisterSchema,
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    if len(normalize_phone(data.phone)) < 9:
        raise HTTPException(status_code=400, detail="Telefon raqamini to'liq kiriting / Введите номер телефона полностью")
    if await find_by_phone(db, data.phone):
        raise HTTPException(status_code=409, detail="Bu telefon raqami allaqachon ro'yxatdan o'tgan / Этот номер уже зарегистрирован")
    if data.role == "taxi" and not (data.car or "").strip():
        raise HTTPException(status_code=400, detail="Mashina va raqamini yozing / Укажите машину и номер")

    staff = StaffModel(
        role=data.role, name=data.name.strip(), phone=data.phone.strip(),
        pin=data.pin, car=(data.car or "").strip() or None, status="pending"
    )
    tg_user = telegram_user(x_telegram_init_data)
    if tg_user:
        staff.tg_id = str(tg_user["id"])
    db.add(staff)
    await db.commit()
    await db.refresh(staff)
    notify_admin_application(f"👷 {ROLE_NAMES[staff.role]}: {staff.name} ({staff.phone})")
    return {"success": True, "status": staff.status}


@router.post("/login")
async def login_staff(
    data: StaffLoginSchema,
    request: Request,
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    phone = normalize_phone(data.phone)
    check_not_locked(request, f"staff:{phone}")
    staff = await find_by_phone(db, data.phone)
    if not staff or staff.pin != data.pin.strip():
        record_failure(request, f"staff:{phone}")
        raise HTTPException(status_code=401, detail="Telefon yoki PIN-kod noto'g'ri / Неверный телефон или PIN-код")
    if staff.status == "pending":
        raise HTTPException(status_code=403, detail="Arizangiz bozorkomda ko'rib chiqilmoqda / Ваша заявка на рассмотрении у администрации")
    if staff.status != "approved":
        raise HTTPException(status_code=403, detail="Hisobingiz bloklangan. Bozorkomga murojaat qiling / Аккаунт заблокирован, обратитесь в администрацию")

    # Signing in inside Telegram lets the bot send this worker new jobs
    tg_user = telegram_user(x_telegram_init_data)
    if tg_user:
        staff.tg_id = str(tg_user["id"])
        await db.commit()
        await db.refresh(staff)

    return {"success": True, "token": make_staff_token(staff), "staff": staff_public(staff)}


@router.get("/me")
async def staff_me(staff: StaffModel = Depends(staff_with_role())):
    return staff_public(staff)
