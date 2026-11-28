"""📒 Nasiya daftari for the stall's team (see app/services/debts.py for the rules). Only this stall's debts, ever."""
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.auth import current_store, current_owner_store
from app.database import get_db
from app.models.schemas import DebtModel, DebtEventModel, OrderItemModel, StoreModel
from app.services import debts as ledger
from app.services.customer_guard import rate_limit

router = APIRouter(prefix="/api/seller/debts", tags=["debts"])

MAX_AMOUNT = 100_000_000
# Closed debts stay in the list this long (the history of each is kept forever)
CLOSED_DAYS = 60


class DebtCreate(BaseModel):
    customer_name: str = Field(..., min_length=1, max_length=100)
    customer_phone: Optional[str] = Field(None, max_length=30)
    amount: int = Field(..., ge=1000, le=MAX_AMOUNT)
    note: Optional[str] = Field(None, max_length=200)
    due_date: date
    order_id: Optional[int] = None


async def own_debt(debt_id: int, store: StoreModel, db: AsyncSession) -> DebtModel:
    debt = await db.get(DebtModel, debt_id)
    if not debt or debt.store_id != store.id:
        raise HTTPException(status_code=404, detail="Yozuv topilmadi / Запись не найдена")
    return debt


def must_be_open(debt: DebtModel):
    if debt.status != "open":
        raise HTTPException(status_code=409, detail="Bu nasiya allaqachon yopilgan / Эта насия уже закрыта")


@router.get("")
async def list_debts(store: StoreModel = Depends(current_store), db: AsyncSession = Depends(get_db)):
    today = ledger.today_tashkent()
    since = datetime.utcnow() - timedelta(days=CLOSED_DAYS)
    rows = (await db.execute(select(DebtModel).where(
        DebtModel.store_id == store.id,
        (DebtModel.status == "open") | (DebtModel.closed_at >= since),
    ).order_by(DebtModel.due_date, DebtModel.id))).scalars().all()
    items = [ledger.as_dict(d, today) for d in rows]
    open_items = [d for d in items if d["status"] == "open"]
    return {
        "today": today.isoformat(),
        "summary": {
            "open_count": len(open_items),
            "open_total": sum(d["left"] for d in open_items),
            "due_today": sum(1 for d in open_items if d["days_late"] == 0),
            "overdue": sum(1 for d in open_items if d["days_late"] > 0),
            "overdue_total": sum(d["left"] for d in open_items if d["days_late"] > 0),
            "paid_claims": sum(1 for d in open_items if d["paid_claim"]),
        },
        "debts": items,
    }


@router.get("/{debt_id}")
async def debt_detail(debt_id: int, store: StoreModel = Depends(current_store), db: AsyncSession = Depends(get_db)):
    debt = await own_debt(debt_id, store, db)
    events = (await db.execute(select(DebtEventModel).where(DebtEventModel.debt_id == debt.id)
                               .order_by(DebtEventModel.id))).scalars().all()
    return ledger.as_dict(debt, events=events)


@router.post("")
async def create_debt(data: DebtCreate, store: StoreModel = Depends(current_store), db: AsyncSession = Depends(get_db)):
    rate_limit(f"debt-new:{store.id}", 60, 3600)
    try:
        phone = ledger.clean_phone(data.customer_phone)
    except ValueError:
        raise HTTPException(status_code=400, detail="Telefon raqamini to'liq kiriting / Введите номер полностью")
    today = ledger.today_tashkent()
    if data.due_date < today or data.due_date > today + timedelta(days=366):
        raise HTTPException(status_code=400, detail="Muddatni tekshiring / Проверьте срок")
    open_count = (await db.execute(select(func.count()).select_from(DebtModel).where(
        DebtModel.store_id == store.id, DebtModel.status == "open"))).scalar() or 0
    if open_count >= ledger.MAX_OPEN_PER_STALL:
        raise HTTPException(status_code=409, detail="Ochiq nasiyalar juda ko'p / Слишком много открытых насий")

    if data.order_id is not None:
        # Only an order with this stall's goods, and only once
        mine = (await db.execute(select(func.count()).select_from(OrderItemModel).where(
            OrderItemModel.order_id == data.order_id, OrderItemModel.store_id == store.id))).scalar()
        if not mine:
            raise HTTPException(status_code=404, detail="Buyurtma topilmadi / Заказ не найден")
        twice = (await db.execute(select(DebtModel.id).where(
            DebtModel.store_id == store.id, DebtModel.order_id == data.order_id, DebtModel.status != "cancelled"))).first()
        if twice:
            raise HTTPException(status_code=409, detail="Bu buyurtma daftarda bor / Этот заказ уже в тетради")

    buyer = await ledger.find_buyer(db, phone)
    if buyer:
        waiting = (await db.execute(select(func.count()).select_from(DebtModel).where(
            DebtModel.store_id == store.id, DebtModel.customer_tg_id == buyer.tg_id,
            DebtModel.confirm == "waiting", DebtModel.status == "open"))).scalar() or 0
        if waiting >= ledger.MAX_WAITING_PER_BUYER:
            raise HTTPException(status_code=429, detail=(
                "Bu mijoz avvalgi yozuvlarga hali javob bermadi / Покупатель ещё не ответил на прошлые записи"))

    debt = DebtModel(
        store_id=store.id, customer_name=data.customer_name.strip(), customer_phone=phone,
        customer_tg_id=buyer.tg_id if buyer else None, amount=data.amount, paid=0,
        note=(data.note or "").strip() or None, due_date=data.due_date, status="open",
        confirm="waiting" if buyer else "none", order_id=data.order_id,
    )
    db.add(debt)
    await db.flush()
    ledger.log(db, debt, "created", amount=data.amount, note=debt.note)
    # 👥 whoever gets goods on credit is one of the stall's customers (Shuhrat, 2026-11-28)
    from app.api.clients import remember
    await remember(db, store.id, debt.customer_name, phone, "nasiya", buyer.tg_id if buyer else None)
    await db.commit()
    await db.refresh(debt)
    if buyer:
        ledger.notify_confirm_request(debt.id)
    return ledger.as_dict(debt)


@router.post("/{debt_id}/pay")
async def pay(debt_id: int, amount: int = Body(..., embed=True, ge=1, le=MAX_AMOUNT),
              store: StoreModel = Depends(current_store), db: AsyncSession = Depends(get_db)):
    """A part or the rest; more than what is left closes it with exactly what was left."""
    debt = await own_debt(debt_id, store, db)
    must_be_open(debt)
    amount = min(amount, ledger.left(debt))
    debt.paid = (debt.paid or 0) + amount
    debt.paid_claim_at = None  # the stall wrote what it really got
    closed = ledger.left(debt) == 0
    if closed:
        debt.status = "paid"
        debt.closed_at = datetime.utcnow()
    ledger.log(db, debt, "payment", amount=amount)
    await db.commit()
    await db.refresh(debt)
    if closed:
        ledger.notify_buyer(debt.id, "closed")
    else:
        ledger.notify_buyer(debt.id, "payment", paid=ledger.money(amount))
    return ledger.as_dict(debt)


@router.post("/{debt_id}/snooze")
async def snooze(debt_id: int, days: int = Body(..., embed=True, ge=1, le=60),
                 store: StoreModel = Depends(current_store), db: AsyncSession = Depends(get_db)):
    """⏰ Muddatni surish: counted from today when the debt is already late."""
    debt = await own_debt(debt_id, store, db)
    must_be_open(debt)
    debt.due_date = max(debt.due_date, ledger.today_tashkent()) + timedelta(days=days)
    ledger.log(db, debt, "snoozed", note=debt.due_date.isoformat())
    await db.commit()
    await db.refresh(debt)
    return ledger.as_dict(debt)


@router.post("/{debt_id}/remind")
async def remind(debt_id: int, store: StoreModel = Depends(current_store), db: AsyncSession = Depends(get_db)):
    """📲 Eslatish: only a buyer who confirmed in the bot, did not turn reminders off, at most every 2 days."""
    debt = await own_debt(debt_id, store, db)
    must_be_open(debt)
    if debt.confirm != "confirmed" or not debt.customer_tg_id:
        raise HTTPException(status_code=409, detail=(
            "Mijoz botda tasdiqlamagan, eslatma yuborib bo'lmaydi / Покупатель не подтвердил в боте, напоминать нельзя"))
    if debt.reminders_off:
        raise HTTPException(status_code=409, detail="Mijoz eslatmalarni o'chirgan / Покупатель отключил напоминания")
    if debt.paid_claim_at:
        raise HTTPException(status_code=409, detail="Mijoz «to'ladim» dedi, avval javob bering / Покупатель сообщил об оплате, сначала ответьте")
    today = ledger.today_tashkent()
    if debt.reminded_on and (today - debt.reminded_on).days < ledger.MANUAL_EVERY_DAYS:
        raise HTTPException(status_code=429, detail=(
            "Eslatma yaqinda yuborilgan, 2 kunda bir marta / Напоминание уже было, не чаще раза в 2 дня"))
    debt.reminded_on = today
    ledger.log(db, debt, "reminded")
    await db.commit()
    await db.refresh(debt)
    ledger.notify_buyer(debt.id, "remind")
    return ledger.as_dict(debt)


@router.post("/{debt_id}/cancel")
async def cancel(debt_id: int, reason: str = Body(..., embed=True, min_length=2, max_length=200),
                 store: StoreModel = Depends(current_owner_store), db: AsyncSession = Depends(get_db)):
    """A mistake is cancelled with a reason, never deleted; only the stall's owner can do it."""
    debt = await own_debt(debt_id, store, db)
    must_be_open(debt)
    debt.status = "cancelled"
    debt.cancel_reason = reason.strip()
    debt.closed_at = datetime.utcnow()
    ledger.log(db, debt, "cancelled", note=debt.cancel_reason)
    await db.commit()
    await db.refresh(debt)
    ledger.notify_buyer(debt.id, "cancelled")
    return ledger.as_dict(debt)


@router.post("/{debt_id}/claim")
async def answer_claim(debt_id: int, accept: bool = Body(..., embed=True), store: StoreModel = Depends(current_store)):
    """The buyer pressed «💵 To'ladim»: «✅ Oldim» closes it, «❌ Olmadim» tells the buyer (Davlatbek's father)."""
    result = await ledger.stall_answer(debt_id, accept, store_id=store.id)
    if result is None:
        raise HTTPException(status_code=404, detail="Yozuv topilmadi / Запись не найдена")
    return result
