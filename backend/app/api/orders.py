import random
from datetime import datetime
import re
from fastapi import APIRouter, Depends, HTTPException, Body, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from app.database import get_db
from app.api.porter import check_pin
from app.api.tg_auth import telegram_user
from app.bot.notify import notify_new_order, notify_status
from app.models.schemas import OrderModel, OrderItemModel, ProductModel, StoreModel, OrderCreateSchema, OrderSchema

router = APIRouter(prefix="/api/orders", tags=["orders"])

@router.post("", response_model=OrderSchema)
async def create_order(
    data: OrderCreateSchema,
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    if not data.items:
        raise HTTPException(status_code=400, detail="Buyurtmada mahsulotlar yo'q / Корзина пуста")
    if len(re.sub(r"\D", "", data.customer_phone)) < 9:
        raise HTTPException(status_code=400, detail="Telefon raqamini to'liq kiriting / Введите номер телефона полностью")

    # The bazaar works 06:00–20:00 Tashkent time (UTC+5)
    now = datetime.utcnow()
    tashkent_hour = (now.hour + 5) % 24 + now.minute / 60
    slot = data.delivery_time_slot
    if (slot.startswith("Express") and not 6 <= tashkent_hour < 19) or (slot.startswith("Evening") and tashkent_hour >= 19):
        raise HTTPException(status_code=409, detail="Bozor yopiq, boshqa vaqtni tanlang / Базар закрыт, выберите другое время доставки")

    # Only trust the Telegram account that Telegram itself signed (used for status messages)
    tg_user = telegram_user(x_telegram_init_data)

    rand_suffix = random.SystemRandom().randint(100000, 999999)
    order_number = f"YB-{datetime.now().strftime('%d%m')}-{rand_suffix}"

    total_amount = 0.0
    order_items_to_create = []

    for item in data.items:
        prod_res = await db.execute(select(ProductModel).where(ProductModel.id == item.product_id))
        prod = prod_res.scalars().first()
        if not prod:
            raise HTTPException(status_code=404, detail=f"Mahsulot ID {item.product_id} topilmadi")
        store = await db.get(StoreModel, prod.store_id)
        if not prod.is_available:
            raise HTTPException(status_code=409, detail=f"«{prod.name_uz}» hozir yo'q / сейчас нет в наличии")
        if not store or not store.is_open:
            raise HTTPException(status_code=409, detail=f"«{store.name_uz if store else prod.name_uz}» rastasi yopiq / раста закрыта")

        item_total = prod.price * item.quantity
        total_amount += item_total

        order_items_to_create.append({
            "product_id": prod.id,
            "store_id": prod.store_id,
            "product_name": prod.name_uz,
            "price": prod.price,
            "quantity": item.quantity,
            "unit": prod.unit,
            "total_price": item_total,
            "is_picked": False
        })

    delivery_fee = 15000.0

    new_order = OrderModel(
        order_number=order_number,
        customer_name=data.customer_name,
        customer_phone=data.customer_phone,
        customer_tg_id=str(tg_user["id"]) if tg_user else None,
        customer_tg_username=(tg_user or {}).get("username"),
        delivery_address=data.delivery_address,
        delivery_district=data.delivery_district,
        landmark=data.landmark,
        delivery_lat=data.delivery_lat,
        delivery_lng=data.delivery_lng,
        delivery_time_slot=data.delivery_time_slot,
        payment_method=data.payment_method,
        # Click/Payme are not connected to a merchant account yet, so nothing confirms the payment
        payment_status="pending",
        status="pending",
        total_amount=total_amount + delivery_fee,
        delivery_fee=delivery_fee,
        notes=data.notes
    )
    db.add(new_order)
    await db.flush()

    for item_data in order_items_to_create:
        item_obj = OrderItemModel(order_id=new_order.id, **item_data)
        db.add(item_obj)

    store_ids = set([i["store_id"] for i in order_items_to_create])
    for s_id in store_ids:
        store_res = await db.execute(select(StoreModel).where(StoreModel.id == s_id))
        store = store_res.scalars().first()
        if store:
            store.total_orders += 1

    await db.commit()

    # Query with selectinload to eager-load items relationship for serialization
    full_order_res = await db.execute(
        select(OrderModel).where(OrderModel.id == new_order.id).options(selectinload(OrderModel.items))
    )
    full_order = full_order_res.scalars().first()
    notify_new_order(full_order.id)
    return full_order

@router.get("/{order_number_or_id}", response_model=OrderSchema)
async def get_order(order_number_or_id: str, db: AsyncSession = Depends(get_db)):
    clean_num = order_number_or_id.replace("#", "").strip()
    # Only the full order number works, so nobody can browse other people's orders by id
    query = select(OrderModel).where(OrderModel.order_number == clean_num.upper()).options(selectinload(OrderModel.items))

    result = await db.execute(query)
    order = result.scalars().first()

    if not order:
        raise HTTPException(status_code=404, detail="Buyurtma topilmadi / Заказ не найден")
    return order

@router.patch("/{order_id}/status", dependencies=[Depends(check_pin)])
async def update_order_status(
    order_id: int,
    status: str = Body(..., embed=True),
    db: AsyncSession = Depends(get_db)
):
    valid_statuses = ["pending", "accepted", "picking", "handed_over", "on_the_way", "delivered", "cancelled"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Noto'g'ri status")

    res = await db.execute(select(OrderModel).where(OrderModel.id == order_id))
    order = res.scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Buyurtma topilmadi")

    order.status = status
    await db.commit()
    await db.refresh(order)
    notify_status(order.id)

    return {"success": True, "status": order.status, "message": "Buyurtma holati yangilandi"}

@router.patch("/items/{item_id}/toggle-picked", dependencies=[Depends(check_pin)])
async def toggle_item_picked(item_id: int, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(OrderItemModel).where(OrderItemModel.id == item_id))
    item = res.scalars().first()
    if not item:
        raise HTTPException(status_code=404, detail="Item topilmadi")

    item.is_picked = not item.is_picked
    await db.commit()
    await db.refresh(item)

    return {"success": True, "is_picked": item.is_picked}


@router.post("/{order_number}/cancel", response_model=OrderSchema)
async def cancel_order(order_number: str, db: AsyncSession = Depends(get_db)):
    """The customer can cancel until an aravachi has taken the order."""
    res = await db.execute(
        select(OrderModel).where(OrderModel.order_number == order_number.replace("#", "").strip().upper()).options(selectinload(OrderModel.items))
    )
    order = res.scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Buyurtma topilmadi / Заказ не найден")
    if order.status not in ["pending", "accepted"] or order.porter_phone:
        raise HTTPException(status_code=409, detail="Aravachi buyurtmani yig'ishni boshladi, bekor qilib bo'lmaydi / Аравачи уже собирает заказ, отменить нельзя")

    order.status = "cancelled"
    await db.commit()
    notify_status(order.id)
    return order
