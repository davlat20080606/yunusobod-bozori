"""Protection from fake orders: blocked customers, open-order limits and request rate limits.

A customer is known by Telegram account and by phone (its last 9 digits), so typing the number
differently does not make a new customer. Someone who has never received an order is "new":
one open order at a time and a smaller amount, until the first order is delivered.
"""
import re
import time
from collections import defaultdict, deque
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schemas import OrderModel, CustomerBlockModel
from app.services.config_store import get_setting

OPEN_STATUSES = ("pending", "accepted", "picking", "ready", "at_point", "handed_over", "on_the_way")


def phone_key(phone: Optional[str]) -> Optional[str]:
    digits = re.sub(r"\D", "", phone or "")
    return digits[-9:] if len(digits) >= 9 else None


def same_customer(tg_id: Optional[str], key: Optional[str]):
    conditions = []
    if tg_id:
        conditions.append(OrderModel.customer_tg_id == tg_id)
    if key:
        conditions.append(OrderModel.phone_key == key)
    return or_(*conditions)


async def check_not_blocked(db: AsyncSession, tg_id: Optional[str], key: Optional[str]):
    conditions = [CustomerBlockModel.phone_key == key] if key else []
    if tg_id:
        conditions.append(CustomerBlockModel.tg_id == tg_id)
    if conditions and (await db.execute(select(CustomerBlockModel.id).where(or_(*conditions)).limit(1))).first():
        raise HTTPException(status_code=403, detail=(
            "Buyurtma berish imkoniyati yopilgan. Savol bo'lsa, bozor ma'muriyatiga murojaat qiling / "
            "Заказы для вас закрыты. Если есть вопросы, обратитесь в администрацию базара"))


async def check_order_limits(db: AsyncSession, tg_id: Optional[str], key: Optional[str], total: float):
    who = same_customer(tg_id, key)
    open_orders = (await db.execute(
        select(func.count(OrderModel.id)).where(who, OrderModel.status.in_(OPEN_STATUSES)))).scalar()
    received_before = (await db.execute(
        select(OrderModel.id).where(who, OrderModel.status == "delivered").limit(1))).first() is not None

    max_open = int(await get_setting(db, "max_open_orders"))
    if not received_before:
        max_open = min(max_open, int(await get_setting(db, "new_customer_max_open")))
        max_total = float(await get_setting(db, "new_customer_max_total"))
        if total > max_total:
            raise HTTPException(status_code=409, detail=(
                f"Birinchi buyurtma {max_total:,.0f} so'mgacha bo'ladi. Savatni kamaytiring / "
                f"Первый заказ — до {max_total:,.0f} сум. Уменьшите корзину").replace(",", " "))
    if open_orders >= max_open:
        raise HTTPException(status_code=409, detail=(
            f"Sizda {open_orders} ta ochiq buyurtma bor. Avval ularni oling yoki bekor qiling / "
            f"У вас уже {open_orders} открытых заказа. Сначала получите или отмените их"))


# Sliding-window request counters. They live in this process's memory, which is right while the
# server runs as one process (the SSE hub needs that too); several processes would each count alone.
_hits = defaultdict(deque)


def rate_limit(key: str, limit: int, window_seconds: int):
    now = time.monotonic()
    hits = _hits[key]
    while hits and hits[0] <= now - window_seconds:
        hits.popleft()
    if len(hits) >= limit:
        raise HTTPException(status_code=429, detail=(
            "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring / Слишком много попыток. Попробуйте чуть позже"))
    hits.append(now)
    # Forget idle keys now and then, so the counters do not grow forever
    if len(_hits) > 5000:
        for k in [k for k, v in _hits.items() if not v or v[-1] <= now - 3600]:
            del _hits[k]
