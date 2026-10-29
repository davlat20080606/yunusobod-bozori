"""Instant "something changed" signals over Server-Sent Events.

A signal carries no order data, only "refresh"; screens then reload through the normal
authorised API, so listening to a channel reveals nothing. One server instance on Render,
so an in-memory hub is enough. Channels:
  order:<number>  the customer's tracker      porter / taxi  worker lists
  store:<id>      a seller cabinet            admin          bozorkom
"""
import asyncio
import logging
from sqlalchemy import select
from sqlalchemy.orm import selectinload

logger = logging.getLogger(__name__)
_listeners: dict = {}  # channel -> set of asyncio.Queue


def subscribe(channels):
    queue = asyncio.Queue(maxsize=20)
    for ch in channels:
        _listeners.setdefault(ch, set()).add(queue)
    return queue


def unsubscribe(channels, queue):
    for ch in channels:
        _listeners.get(ch, set()).discard(queue)


def publish(*channels):
    for ch in channels:
        for queue in list(_listeners.get(ch, ())):
            try:
                queue.put_nowait(ch)
            except asyncio.QueueFull:
                pass  # that screen is already due to refresh


async def _publish_order(order_id: int):
    from app.database import async_session_factory
    from app.models.schemas import OrderModel
    try:
        async with async_session_factory() as db:
            order = (await db.execute(
                select(OrderModel).where(OrderModel.id == order_id).options(selectinload(OrderModel.items))
            )).scalars().first()
        if order:
            publish(f"order:{order.order_number}", "porter", "taxi", "admin",
                    *{f"store:{i.store_id}" for i in order.items})
    except Exception as e:
        logger.info(f"Event note: {e}")


def order_changed(order_id: int):
    try:
        asyncio.get_running_loop().create_task(_publish_order(order_id))
    except RuntimeError:
        pass
