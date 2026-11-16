"""Seller control (Shuhrat): an Express order a stall has not packed in time. First the stall gets a reminder,
then the bozorkom and the customer are told. Each step is written to the order's history, which also gives
every stall its reliability (orders vs. late) in the Bozorkom panel."""
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schemas import OrderModel, OrderItemModel, OrderEventModel

ACTIVE = ("pending", "accepted", "picking")


def unpacked_stalls(order: OrderModel) -> set:
    """Stalls with something in this order they have not packed or handed over yet (missing items do not count)."""
    return {i.store_id for i in order.items
            if i.item_status != "missing" and not (i.seller_ready or i.seller_handed or i.is_picked)}


def is_express(order: OrderModel) -> bool:
    return (order.delivery_time_slot or "").startswith("Express")


async def reliability(db: AsyncSession, days: int = 30) -> dict:
    """{store_id: {"orders": n, "late": n}} for the last `days` days."""
    since = datetime.utcnow() - timedelta(days=days)
    rows = (await db.execute(
        select(OrderItemModel.store_id, OrderItemModel.order_id)
        .join(OrderModel, OrderModel.id == OrderItemModel.order_id)
        .where(OrderModel.created_at >= since)
    )).all()
    out = {}
    for store_id, order_id in set(rows):
        out.setdefault(store_id, {"orders": 0, "late": 0})["orders"] += 1
    late = (await db.execute(
        select(OrderEventModel.order_id, OrderEventModel.data)
        .where(OrderEventModel.kind == "seller_late", OrderEventModel.created_at >= since)
    )).all()
    for order_id, data in {(o, (d or {}).get("store_id")) for o, d in late}:
        if data is not None:
            out.setdefault(data, {"orders": 0, "late": 0})["late"] += 1
    return out
