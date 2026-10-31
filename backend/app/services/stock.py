"""Counted stock: an order holds what it needs, the stall's handover takes it off, a cancel gives it back.

Only products the seller counts (track_stock) are touched. Holding is one conditional UPDATE, so
two customers can never both get the last kilo: the database lets only one of them through.
A line holds stock until it is settled:
  handed over (seller "Topshirdim", aravachi ticked it, or the order delivered) -> taken off the stall,
  cancelled order, "Tugadi" or a no-show -> given back (goods that left a stall: when the seller has them back).
Endpoints settle the order they change; the maintenance loop settles anything left over.
"""
from fastapi import HTTPException
from sqlalchemy import select, update, case
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schemas import ProductModel, OrderModel, OrderItemModel, StockMoveModel

EPS = 1e-9


def qty_text(q: float, unit: str) -> str:
    return f"{q:g} {unit or ''}".strip()


def check_available(prod: ProductModel, quantity: float):
    """Before the order: a clear "only 2 kg left" instead of a failed order."""
    left = prod.available_quantity
    if left is not None and quantity > left + EPS:
        raise HTTPException(status_code=409, detail=(
            f"«{prod.name_uz}»dan faqat {qty_text(left, prod.unit)} qoldi / "
            f"«{prod.name_ru or prod.name_uz}»: осталось только {qty_text(left, prod.unit)}"))


async def reserve(db: AsyncSession, order: OrderModel, items):
    """Hold stock for every counted line of a new order. Runs in the order's transaction:
    if one line cannot be held, the whole order (and what earlier lines held) is rolled back."""
    alerts = []
    for item in items:
        prod = await db.get(ProductModel, item.product_id)
        if not prod or not prod.track_stock:
            continue
        before = prod.available_quantity
        held = (await db.execute(
            update(ProductModel)
            .where(ProductModel.id == prod.id, ProductModel.track_stock.is_(True),
                   ProductModel.stock_quantity - ProductModel.stock_reserved >= item.quantity - EPS)
            .values(stock_reserved=ProductModel.stock_reserved + item.quantity)
            .execution_options(synchronize_session=False)
        )).rowcount
        if not held:
            await db.refresh(prod)
            check_available(prod, item.quantity)
            raise HTTPException(status_code=409, detail="Qoldiq o'zgardi, qayta urinib ko'ring / Остаток изменился, попробуйте ещё раз")
        item.stock_reserved_qty = item.quantity
        db.add(StockMoveModel(product_id=prod.id, order_id=order.id, kind="reserve", reserved_delta=item.quantity))
        await db.refresh(prod)
        threshold = prod.low_stock_alert if prod.low_stock_alert is not None else (prod.min_weight or 0.5) * 2
        if before is not None and before > threshold + EPS >= prod.available_quantity:
            alerts.append(prod.id)
    return alerts


def settle_kind(order: OrderModel, item: OrderItemModel):
    # A no-show releases what is still only held; goods that left a stall come back with «Qaytib oldim»
    if order.status in ("cancelled", "no_show", "returned") or item.item_status == "missing":
        return "release"
    if item.seller_handed or item.is_picked or order.status == "delivered":
        return "consume"
    return None


async def settle(db: AsyncSession, order_id: int) -> int:
    """Take off or give back what this order's lines still hold, as far as the order has got."""
    rows = (await db.execute(
        select(OrderItemModel, OrderModel)
        .join(OrderModel, OrderModel.id == OrderItemModel.order_id)
        .where(OrderItemModel.order_id == order_id, OrderItemModel.stock_reserved_qty > 0)
    )).all()
    done = 0
    for item, order in rows:
        kind = settle_kind(order, item)
        if not kind:
            continue
        held = item.stock_reserved_qty
        values = {"stock_reserved": case((ProductModel.stock_reserved - held < 0, 0.0), else_=ProductModel.stock_reserved - held)}
        used = 0.0
        if kind == "consume":
            # The scale decides: a ±5% heavier piece leaves the stall heavier
            used = item.actual_quantity if item.actual_quantity is not None else item.quantity
            values["stock_quantity"] = case((ProductModel.stock_quantity - used < 0, 0.0), else_=ProductModel.stock_quantity - used)
        await db.execute(update(ProductModel).where(ProductModel.id == item.product_id).values(**values)
                         .execution_options(synchronize_session=False))
        item.stock_reserved_qty = 0.0
        db.add(StockMoveModel(product_id=item.product_id, order_id=order_id, kind=kind,
                              quantity_delta=-used, reserved_delta=-held))
        done += 1
    return done


async def settle_all(db: AsyncSession) -> int:
    """Safety net for the maintenance loop: settle every line whose order or handover moved on."""
    order_ids = (await db.execute(
        select(OrderItemModel.order_id).join(OrderModel, OrderModel.id == OrderItemModel.order_id)
        .where(OrderItemModel.stock_reserved_qty > 0)
        .where((OrderModel.status.in_(["cancelled", "delivered", "no_show", "returned"])) | OrderItemModel.seller_handed.is_(True)
               | OrderItemModel.is_picked.is_(True) | (OrderItemModel.item_status == "missing"))
        .distinct()
    )).scalars().all()
    done = 0
    for order_id in order_ids:
        done += await settle(db, order_id)
    return done


async def sold_out(db: AsyncSession, prod: ProductModel):
    """«Tugadi»: nothing left at the stall. Open orders keep what they hold until they are settled."""
    if prod.track_stock and (prod.stock_quantity or 0) > 0:
        db.add(StockMoveModel(product_id=prod.id, kind="sold_out", quantity_delta=-(prod.stock_quantity or 0)))
        prod.stock_quantity = 0.0
    prod.is_available = False


def set_stock(db: AsyncSession, prod: ProductModel, available: bool, quantity):
    """The seller's morning list: is it here today, and how much (None = not counted)."""
    prod.is_available = available
    if quantity is None:
        prod.track_stock = False
        return
    # What is at the stall now; open orders' holds still count against it
    db.add(StockMoveModel(product_id=prod.id, kind="morning",
                          quantity_delta=quantity - ((prod.stock_quantity or 0) if prod.track_stock else 0)))
    prod.track_stock = True
    prod.stock_quantity = quantity
