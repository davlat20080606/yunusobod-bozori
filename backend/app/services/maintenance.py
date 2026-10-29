"""Housekeeping that keeps old orders from hanging around forever."""
import asyncio
import logging
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import async_session_factory
from app.models.schemas import OrderModel
from app.bot.notify import notify_status, notify_cold_chain

logger = logging.getLogger(__name__)

CHECK_EVERY_SECONDS = 60


def is_stale(order: OrderModel, now: datetime) -> bool:
    """Nobody took the order in time: 3 hours for Express, 24 hours for scheduled slots."""
    if order.status not in ("pending", "accepted") or order.porter_phone:
        return False
    # Self pickup has no aravachi: a seller who started packing means the order is alive
    if any(i.seller_ready or i.seller_handed for i in order.items):
        return False
    limit = timedelta(hours=3) if (order.delivery_time_slot or "").startswith("Express") else timedelta(hours=24)
    return order.created_at is not None and now - order.created_at > limit


async def cancel_stale_orders() -> int:
    now = datetime.utcnow()
    async with async_session_factory() as db:
        res = await db.execute(
            select(OrderModel).where(OrderModel.status.in_(["pending", "accepted"])).options(selectinload(OrderModel.items))
        )
        stale = [o for o in res.scalars().all() if is_stale(o, now)]
        for order in stale:
            order.status = "cancelled"
        await db.commit()
    for order in stale:
        notify_status(order.id)
    if stale:
        logger.info(f"Cancelled {len(stale)} orders nobody took in time")
    return len(stale)


COLD_CHAIN_MINUTES = 15


async def check_cold_chain() -> int:
    """An order the aravachi brought to the gate should not sit there long (meat, milk, summer heat)."""
    now = datetime.utcnow()
    async with async_session_factory() as db:
        res = await db.execute(select(OrderModel).where(OrderModel.status == "handed_over", OrderModel.cold_alert_sent.isnot(True)))
        late = [o for o in res.scalars().all() if o.handed_over_at and now - o.handed_over_at > timedelta(minutes=COLD_CHAIN_MINUTES)]
        for order in late:
            order.cold_alert_sent = True
        await db.commit()
    for order in late:
        notify_cold_chain(order.id, int((now - order.handed_over_at).total_seconds() // 60))
    return len(late)


async def run_forever():
    while True:
        try:
            await cancel_stale_orders()
            await check_cold_chain()
        except Exception as e:
            logger.warning(f"Stale order check failed: {e}")
        await asyncio.sleep(CHECK_EVERY_SECONDS)
