"""«Xaridor kelmadi»: the order reached the customer, the customer never came.

The clock starts when the customer is being waited for:
  point   — the aravachi is at the bazaar point (at_point),
  courier — the taxi (or the aravachi driving it) pressed «Yetib keldim» at the door,
  self    — every stall has packed its part (ready).
After `no_show_remind_min` the bot reminds the customer. After `no_show_after_min` the worker may
press «Xaridor kelmadi» (the server checks the time too, so it cannot be pressed early). Self-pickup
orders are marked by the server itself after `self_no_show_min`: nobody stands and waits for them.

Then the goods go back: unpacked lines are given back to the stock at once, lines that left a stall
wait for its seller to press «Qaytib oldim». When every stall has its goods the order is `returned`.
A no-show counts against the customer for 90 days; at `no_show_strikes` they cannot order any more
(until online prepayment exists) unless the Bozorkom forgives them.
"""
from datetime import datetime, timedelta
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schemas import OrderModel, ProductModel, StockMoveModel
from app.services import stock
from app.services.config_store import get_setting
from app.services.customer_guard import same_customer
from app.services.order_log import log_event

# Where the order is when the customer is being waited for
WAITING = {"point": ("at_point",), "courier": ("on_the_way",), "self": ("ready",)}
STRIKE_DAYS = 90


def start_waiting(order: OrderModel):
    if not order.waiting_since:
        order.waiting_since = datetime.utcnow()


def is_waiting(order: OrderModel) -> bool:
    return bool(order.waiting_since) and order.status in WAITING.get(order.fulfillment or "courier", ())


async def minutes_left(db: AsyncSession, order: OrderModel, now: Optional[datetime] = None) -> int:
    """How long until «Xaridor kelmadi» may be pressed (0 = now)."""
    after = int(await get_setting(db, "no_show_after_min"))
    waited = ((now or datetime.utcnow()) - order.waiting_since).total_seconds() / 60
    return max(0, int(after - waited + 0.999))


async def mark_no_show(db: AsyncSession, order: OrderModel, now: Optional[datetime] = None, check_time: bool = True):
    if not is_waiting(order):
        raise HTTPException(status_code=409, detail="Buyurtma hozir xaridorni kutmayapti / Заказ сейчас не ждёт покупателя")
    if check_time and (left := await minutes_left(db, order, now)):
        raise HTTPException(status_code=409, detail=(
            f"Yana {left} daqiqa kuting, xaridorga qo'ng'iroq qiling / Подождите ещё {left} мин, позвоните покупателю"))
    order.status = "no_show"
    order.no_show_at = now or datetime.utcnow()
    fee = 0.0
    if order.fulfillment in ("point", "courier"):
        fee += float(await get_setting(db, "porter_fee"))
    if order.fulfillment == "courier" and order.taxi_phone:
        fee += float(await get_setting(db, "taxi_fee"))
    order.no_show_fee = fee
    log_event(order, "no_show", waited_min=int(((order.no_show_at - order.waiting_since).total_seconds()) // 60), fee=fee)
    # Lines that never left their stall: back on sale now. The rest waits for «Qaytib oldim».
    for item in order.items:
        if not (item.is_picked or item.seller_handed):
            item.returned = True
    await db.flush()
    await stock.settle(db, order.id)
    await _close_if_returned(db, order)


async def _close_if_returned(db: AsyncSession, order: OrderModel):
    if order.status == "no_show" and all(i.returned or i.item_status == "missing" for i in order.items):
        order.status = "returned"
        order.returned_at = datetime.utcnow()


async def mark_returned(db: AsyncSession, order: OrderModel, store_id: int):
    """The seller has their goods back: what left the stall goes back into its stock."""
    if order.status != "no_show":
        raise HTTPException(status_code=409, detail="Qaytariladigan narsa yo'q / Нечего возвращать")
    mine = [i for i in order.items if i.store_id == store_id and not i.returned and i.item_status != "missing"]
    if not mine:
        raise HTTPException(status_code=409, detail="Allaqachon qaytarilgan / Уже возвращено")
    consumed = dict((await db.execute(
        select(StockMoveModel.product_id, func.sum(StockMoveModel.quantity_delta))
        .where(StockMoveModel.order_id == order.id, StockMoveModel.kind == "consume")
        .group_by(StockMoveModel.product_id)
    )).all())
    for item in mine:
        item.returned = True
        taken = -(consumed.pop(item.product_id, 0) or 0)
        if taken > 0:
            await db.execute(update(ProductModel).where(ProductModel.id == item.product_id, ProductModel.track_stock.is_(True))
                             .values(stock_quantity=ProductModel.stock_quantity + taken).execution_options(synchronize_session=False))
            db.add(StockMoveModel(product_id=item.product_id, order_id=order.id, kind="return", quantity_delta=taken, reserved_delta=0.0))
    log_event(order, "returned", store_id=store_id)
    await _close_if_returned(db, order)


async def undo(db: AsyncSession, order: OrderModel):
    """The customer turned up after all (or it was pressed by mistake): back to waiting."""
    # Only while the bag is still with the worker: once a stall has its goods back, it is too late
    if order.status != "no_show" or any(i.returned and (i.is_picked or i.seller_handed) for i in order.items):
        raise HTTPException(status_code=409, detail="Mahsulot rastaga qaytib bo'lgan / Товар уже вернули на расту")
    order.status = WAITING[order.fulfillment or "courier"][0]
    order.no_show_at = None
    order.no_show_fee = None
    order.waiting_since = datetime.utcnow()
    log_event(order, "no_show_undone")


async def strikes(db: AsyncSession, tg_id: Optional[str], key: Optional[str]) -> int:
    if not tg_id and not key:
        return 0
    since = datetime.utcnow() - timedelta(days=STRIKE_DAYS)
    return (await db.execute(select(func.count(OrderModel.id)).where(
        same_customer(tg_id, key), OrderModel.status.in_(["no_show", "returned"]),
        OrderModel.no_show_at >= since, OrderModel.no_show_forgiven.is_not(True),
    ))).scalar() or 0


async def check_strikes(db: AsyncSession, tg_id: Optional[str], key: Optional[str]):
    limit = int(await get_setting(db, "no_show_strikes"))
    if await strikes(db, tg_id, key) >= limit:
        raise HTTPException(status_code=403, detail=(
            f"Siz {limit} marta buyurtmani olmadingiz, shuning uchun yangi buyurtma vaqtincha yopilgan. "
            "Bozor ma'muriyatiga murojaat qiling / "
            f"Вы {limit} раза не забрали заказ, поэтому новые заказы временно закрыты. Обратитесь в администрацию базара"))
