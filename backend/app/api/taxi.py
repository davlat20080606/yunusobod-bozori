"""Taksichi: takes the collected order from the aravachi at the bazaar gate and drives it to the customer."""
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.schemas import OrderModel, OrderItemModel, StaffModel
from app.api.auth import staff_with_role
from app.api.porter import serialize_order, get_porter_order
from app.bot.notify import notify_status
from app.services.adjust import check_code

router = APIRouter(prefix="/api/taxi", tags=["taxi"])

current_taxi = staff_with_role("taxi")


def own_order(order: OrderModel, taxi: StaffModel):
    if order.taxi_phone != taxi.phone:
        raise HTTPException(status_code=403, detail="Bu sizning buyurtmangiz emas / Это не ваш заказ")


@router.get("/orders")
async def list_taxi_orders(taxi: StaffModel = Depends(current_taxi), db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        select(OrderModel)
        .where(OrderModel.status.in_(["handed_over", "on_the_way"]))
        .order_by(OrderModel.id.desc())
        .limit(100)
        .options(selectinload(OrderModel.items).selectinload(OrderItemModel.product), selectinload(OrderModel.bonuses))
    )
    orders = res.scalars().all()
    available = [o for o in orders if o.status == "handed_over" and not o.taxi_phone]
    mine = [o for o in orders if o.taxi_phone == taxi.phone]
    return {
        "available": [await serialize_order(o, db) for o in available],
        "mine": [await serialize_order(o, db) for o in mine],
    }


@router.post("/orders/{order_id}/take")
async def take_order(
    order_id: int,
    eta_minutes: int = Body(10, embed=True, ge=1, le=90),
    taxi: StaffModel = Depends(current_taxi),
    db: AsyncSession = Depends(get_db)
):
    order = await get_porter_order(order_id, db)
    if order.taxi_phone and order.taxi_phone != taxi.phone:
        raise HTTPException(status_code=409, detail="Bu buyurtmani boshqa taksichi oldi / Заказ уже взял другой таксист")
    if order.status != "handed_over":
        raise HTTPException(status_code=409, detail="Buyurtma hali tayyor emas / Заказ ещё не готов")

    order.taxi_name = f"{taxi.name}" + (f" · {taxi.car}" if taxi.car else "")
    order.taxi_phone = taxi.phone
    # No GPS here: the driver says when he will be at the gate, the aravachi comes out just in time
    order.taxi_eta_at = datetime.utcnow() + timedelta(minutes=eta_minutes)
    await db.commit()
    notify_status(order_id)
    return await serialize_order(await get_porter_order(order_id, db), db)


@router.patch("/orders/{order_id}/status")
async def set_taxi_status(
    order_id: int,
    status: str = Body(..., embed=True),
    code: Optional[str] = Body(None, embed=True),
    taxi: StaffModel = Depends(current_taxi),
    db: AsyncSession = Depends(get_db)
):
    if status not in ("on_the_way", "delivered"):
        raise HTTPException(status_code=400, detail="Noto'g'ri status")
    order = await get_porter_order(order_id, db)
    own_order(order, taxi)
    if status == "delivered":
        check_code(order, code)
    order.status = status
    await db.commit()
    notify_status(order_id)
    return await serialize_order(await get_porter_order(order_id, db), db)
