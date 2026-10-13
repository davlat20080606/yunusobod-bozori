"""Pattachi: records the daily stall fee (patta) paid by each stall."""
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.schemas import PattaPaymentModel, StoreModel, StaffModel
from app.api.auth import staff_with_role
from app.services.config_store import get_setting

router = APIRouter(prefix="/api/patta", tags=["patta"])

current_pattachi = staff_with_role("pattachi")


def tashkent_day(offset_days: int = 0) -> str:
    return (datetime.utcnow() + timedelta(hours=5, days=offset_days)).strftime("%Y-%m-%d")


async def day_report(db: AsyncSession, day: str) -> dict:
    stores = (await db.execute(select(StoreModel).where(StoreModel.status == "approved"))).scalars().all()
    payments = (await db.execute(select(PattaPaymentModel).where(PattaPaymentModel.day == day))).scalars().all()
    collectors = {}
    if payments:
        rows = (await db.execute(select(StaffModel).where(StaffModel.id.in_({p.collector_id for p in payments})))).scalars().all()
        collectors = {s.id: s.name for s in rows}
    paid = {p.store_id: p for p in payments}
    return {
        "day": day,
        "stores": [
            {
                "store_id": s.id,
                "stall_number": s.stall_number,
                "name_uz": s.name_uz,
                "name_ru": s.name_ru,
                "owner_name": s.owner_name,
                "owner_phone": s.owner_phone,
                "paid": s.id in paid,
                "amount": paid[s.id].amount if s.id in paid else None,
                "collector": collectors.get(paid[s.id].collector_id) if s.id in paid else None,
                "paid_at": paid[s.id].created_at.isoformat() if s.id in paid else None,
            }
            for s in sorted(stores, key=lambda s: s.stall_number)
        ],
        "paid_count": len(paid),
        "total": sum(p.amount for p in payments),
    }


@router.get("/today")
async def patta_today(pattachi: StaffModel = Depends(current_pattachi), db: AsyncSession = Depends(get_db)):
    report = await day_report(db, tashkent_day())
    report["default_amount"] = float(await get_setting(db, "patta_amount"))
    return report


@router.post("/{store_id}")
async def record_payment(
    store_id: int,
    amount: Optional[float] = Body(None, embed=True),
    pattachi: StaffModel = Depends(current_pattachi),
    db: AsyncSession = Depends(get_db)
):
    store = await db.get(StoreModel, store_id)
    if not store or store.status != "approved":
        raise HTTPException(status_code=404, detail="Rasta topilmadi / Раста не найдена")
    day = tashkent_day()
    exists = (await db.execute(select(PattaPaymentModel).where(PattaPaymentModel.store_id == store_id, PattaPaymentModel.day == day))).scalars().first()
    if exists:
        raise HTTPException(status_code=409, detail="Bu rasta bugun to'lagan / Раста уже оплатила сегодня")
    value = amount if amount is not None else float(await get_setting(db, "patta_amount"))
    if not 0 < value <= 10_000_000:
        raise HTTPException(status_code=400, detail="Noto'g'ri summa / Неверная сумма")

    db.add(PattaPaymentModel(store_id=store_id, day=day, amount=value, collector_id=pattachi.id))
    await db.commit()
    return {"success": True}


@router.delete("/{store_id}")
async def undo_payment(store_id: int, pattachi: StaffModel = Depends(current_pattachi), db: AsyncSession = Depends(get_db)):
    """Fix a mistake: only today's payment that this pattachi recorded."""
    payment = (await db.execute(select(PattaPaymentModel).where(
        PattaPaymentModel.store_id == store_id, PattaPaymentModel.day == tashkent_day()
    ))).scalars().first()
    if not payment:
        raise HTTPException(status_code=404, detail="To'lov topilmadi / Оплата не найдена")
    if payment.collector_id != pattachi.id:
        raise HTTPException(status_code=403, detail="Bu to'lovni boshqa pattachi yozgan / Оплату записал другой паттачи")
    await db.delete(payment)
    await db.commit()
    return {"success": True}
