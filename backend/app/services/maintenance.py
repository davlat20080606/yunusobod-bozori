"""Housekeeping that keeps old orders from hanging around forever."""
import asyncio
import logging
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.database import async_session_factory
from app.services import stock, no_show
from app.models.schemas import OrderModel
from app.bot.notify import notify_status, notify_cold_chain, send_morning_stock, notify_wait_reminder, notify_no_show, notify_return_late
from app.services.config_store import get_setting, set_setting
import app.services.order_log  # noqa: F401  (status changes made here are logged as "system")

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


async def settle_stock() -> int:
    """Whatever an endpoint did not settle (auto-cancel, delivered, ticked by the aravachi)."""
    async with async_session_factory() as db:
        done = await stock.settle_all(db)
        await db.commit()
    return done


MORNING_WINDOW_HOURS = 3


async def morning_stock(now: datetime = None) -> bool:
    """Once a day at the set hour; a server that starts later in the day does not send it."""
    tashkent = (now or datetime.utcnow()) + timedelta(hours=5)
    today = tashkent.date().isoformat()
    async with async_session_factory() as db:
        hour = int(await get_setting(db, "morning_stock_hour"))
        if not hour <= tashkent.hour < hour + MORNING_WINDOW_HOURS or await get_setting(db, "morning_stock_sent") == today:
            return False
        # Marked first: a crash while sending must not make every stall get it twice
        await set_setting(db, "morning_stock_sent", today)
    await send_morning_stock()
    return True


async def no_show_timers(now: datetime = None) -> dict:
    """Remind the customer who is being waited for; close self-pickup orders nobody came for;
    warn when goods sit outside their stall too long after a no-show."""
    now = now or datetime.utcnow()
    reminded, closed, late = [], [], []
    async with async_session_factory() as db:
        remind_min = int(await get_setting(db, "no_show_remind_min"))
        after_min = int(await get_setting(db, "no_show_after_min"))
        self_min = int(await get_setting(db, "self_no_show_min"))
        alert_min = int(await get_setting(db, "return_alert_min"))
        res = await db.execute(
            select(OrderModel).where((OrderModel.waiting_since.is_not(None)) | (OrderModel.status == "no_show"))
            .where(OrderModel.status.in_(["ready", "at_point", "on_the_way", "no_show"]))
            .options(selectinload(OrderModel.items))
        )
        for order in res.scalars().all():
            if no_show.is_waiting(order):
                waited = (now - order.waiting_since).total_seconds() / 60
                give_up = self_min if order.fulfillment == "self" else after_min
                # Self pickup: nobody stands waiting, so remind halfway instead of after a few minutes
                remind_at = self_min / 2 if order.fulfillment == "self" else remind_min
                if order.fulfillment == "self" and waited >= self_min and not any(i.seller_handed for i in order.items):
                    await no_show.mark_no_show(db, order, now=now, check_time=False)
                    closed.append(order.id)
                elif waited >= remind_at and not order.wait_reminded:
                    order.wait_reminded = True
                    reminded.append((order.id, max(1, int(give_up - waited + 0.999))))
            elif order.status == "no_show" and order.no_show_at and not order.return_alert_sent:
                minutes = (now - order.no_show_at).total_seconds() / 60
                if minutes >= alert_min:
                    order.return_alert_sent = True
                    late.append((order.id, int(minutes)))
        await db.commit()
    for order_id, left in reminded:
        notify_wait_reminder(order_id, left)
    for order_id in closed:
        notify_no_show(order_id)
    for order_id, minutes in late:
        notify_return_late(order_id, minutes)
    return {"reminded": len(reminded), "closed": len(closed), "late": len(late)}


async def run_forever():
    while True:
        try:
            await cancel_stale_orders()
            await check_cold_chain()
            await settle_stock()
            await no_show_timers()
            await morning_stock()
        except Exception as e:
            logger.warning(f"Stale order check failed: {e}")
        await asyncio.sleep(CHECK_EVERY_SECONDS)
