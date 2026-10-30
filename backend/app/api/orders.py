import random
from datetime import datetime
import re
from fastapi import APIRouter, Depends, HTTPException, Body, Header, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from typing import List, Optional
from app.database import get_db
from app.api.auth import current_admin, client_ip
from app.services.customer_guard import phone_key, check_not_blocked, check_order_limits, rate_limit
from app.services.config_store import get_setting, distance_km, HANDOFF_POINT_IDS
from app.services.promos import compute_quote
from app.services.adjust import recalc
from app.bot.notify import notify_adjustment
from app.api.tg_auth import telegram_user
from app.services.order_log import act_as, log_event
from app.bot.notify import notify_new_order, notify_status
from app.models.schemas import (
    OrderModel, OrderItemModel, StoreModel, OrderCreateSchema, OrderSchema, ReviewModel, CustomerModel,
    OrderBonusModel, QuoteSchema
)

router = APIRouter(prefix="/api/orders", tags=["orders"])


def load_order(where):
    return select(OrderModel).where(where).options(
        selectinload(OrderModel.items).selectinload(OrderItemModel.product), selectinload(OrderModel.bonuses)
    )


@router.post("/quote")
async def quote_order(data: QuoteSchema, request: Request, db: AsyncSession = Depends(get_db)):
    """Price before ordering: discounts, gifts, free taxi and what is missing for the next offer."""
    rate_limit(f"quote:{client_ip(request)}", 120, 60)
    quote = await compute_quote(db, data.items, data.fulfillment)
    quote.pop("lines")
    return quote


@router.post("", response_model=OrderSchema)
async def create_order(
    data: OrderCreateSchema,
    request: Request,
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    if not data.items:
        raise HTTPException(status_code=400, detail="Buyurtmada mahsulotlar yo'q / Корзина пуста")

    # Inside Telegram the name and phone come from the bot registration, not from the form
    tg_user = telegram_user(x_telegram_init_data)
    customer = None
    if tg_user:
        customer = (await db.execute(select(CustomerModel).where(CustomerModel.tg_id == str(tg_user["id"])))).scalars().first()
    if customer and customer.phone:
        data.customer_phone = customer.phone
        data.customer_name = customer.name or tg_user.get("first_name") or "Xaridor"
    if len(re.sub(r"\D", "", data.customer_phone or "")) < 9:
        raise HTTPException(status_code=400, detail="Telefon raqamingizni yuboring / Отправьте номер телефона")
    if len((data.customer_name or "").strip()) < 2:
        raise HTTPException(status_code=400, detail="Ismingizni kiriting / Введите имя")

    tg_id = str(tg_user["id"]) if tg_user else None
    key = phone_key(data.customer_phone)
    # Many people share one mobile address, so the address limit is much looser than the account one
    per_account = int(await get_setting(db, "orders_per_10_min"))
    rate_limit(f"order:{tg_id or key}", per_account, 600)
    rate_limit(f"order-ip:{client_ip(request)}", per_account * 6, 600)
    await check_not_blocked(db, tg_id, key)

    # The bazaar works 06:00–20:00 Tashkent time (UTC+5)
    now = datetime.utcnow()
    tashkent_hour = (now.hour + 5) % 24 + now.minute / 60
    slot = data.delivery_time_slot
    if (slot.startswith("Express") and not 6 <= tashkent_hour < 19) or (slot.startswith("Evening") and tashkent_hour >= 19):
        raise HTTPException(status_code=409, detail="Bozor yopiq, boshqa vaqtni tanlang / Базар закрыт, выберите другое время доставки")

    if data.fulfillment == "courier":
        # Delivery only to homes near Yunusobod Dehqon Bozori; the bozorkom can widen the radius
        radius = float(await get_setting(db, "delivery_radius_km"))
        if data.delivery_lat is None or data.delivery_lng is None or len((data.delivery_address or "").strip()) < 3:
            raise HTTPException(status_code=400, detail="Manzilni xaritada belgilang / Отметьте адрес на карте")
        if distance_km(data.delivery_lat, data.delivery_lng) > radius:
            raise HTTPException(status_code=409, detail=f"Hozircha faqat bozordan {radius:g} km ichida yetkazamiz / Пока доставляем только в радиусе {radius:g} км от базара")
    else:
        data.delivery_address = "Bozorda olib ketadi / Заберёт на базаре"
        data.delivery_lat = data.delivery_lng = None
    if data.fulfillment == "self":
        data.handoff_point = None
    elif data.handoff_point not in HANDOFF_POINT_IDS:
        raise HTTPException(status_code=400, detail="Topshirish joyini tanlang / Выберите место передачи")

    rand_suffix = random.SystemRandom().randint(100000, 999999)
    order_number = f"YB-{datetime.now().strftime('%d%m')}-{rand_suffix}"

    quote = await compute_quote(db, data.items, data.fulfillment)
    order_items_to_create = quote["lines"]
    await check_order_limits(db, tg_id, key, quote["total"])

    new_order = OrderModel(
        order_number=order_number,
        customer_name=data.customer_name,
        customer_phone=data.customer_phone,
        customer_tg_id=tg_id,
        phone_key=key,
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
        total_amount=quote["total"],
        delivery_fee=quote["delivery_fee"],
        discount_amount=quote["discount"],
        fulfillment=data.fulfillment,
        handoff_point=data.handoff_point,
        handoff_code=f"{random.SystemRandom().randint(0, 9999):04d}",
        notes=data.notes
    )
    db.add(new_order)
    await db.flush()
    act_as("customer", new_order.customer_tg_id or new_order.customer_phone)
    log_event(new_order, "created", None, new_order.status, fulfillment=new_order.fulfillment,
              total=new_order.total_amount, stores=sorted({i["store_id"] for i in order_items_to_create}))

    for item_data in order_items_to_create:
        db.add(OrderItemModel(order_id=new_order.id, is_picked=False, **item_data))
    for bonus in quote["bonuses"]:
        db.add(OrderBonusModel(order_id=new_order.id, store_id=bonus["store_id"], kind=bonus["kind"], text=bonus["text"],
                               text_ru=bonus.get("text_ru"), text_en=bonus.get("text_en"), amount=bonus["amount"]))

    store_ids = set([i["store_id"] for i in order_items_to_create])
    for s_id in store_ids:
        store_res = await db.execute(select(StoreModel).where(StoreModel.id == s_id))
        store = store_res.scalars().first()
        if store:
            store.total_orders += 1

    await db.commit()

    full_order = (await db.execute(load_order(OrderModel.id == new_order.id))).scalars().first()
    notify_new_order(full_order.id)
    return full_order

@router.get("/mine")
async def my_orders(x_telegram_init_data: Optional[str] = Header(None), db: AsyncSession = Depends(get_db)):
    """Orders of this Telegram user, so the tracker survives a closed app or another phone."""
    tg_user = telegram_user(x_telegram_init_data)
    if not tg_user:
        return []
    res = await db.execute(
        select(OrderModel.order_number).where(OrderModel.customer_tg_id == str(tg_user["id"])).order_by(OrderModel.id.desc()).limit(20)
    )
    return list(res.scalars().all())


@router.get("/{order_number_or_id}", response_model=OrderSchema)
async def get_order(order_number_or_id: str, db: AsyncSession = Depends(get_db)):
    clean_num = order_number_or_id.replace("#", "").strip()
    # Only the full order number works, so nobody can browse other people's orders by id
    query = load_order(OrderModel.order_number == clean_num.upper())

    result = await db.execute(query)
    order = result.scalars().first()

    if not order:
        raise HTTPException(status_code=404, detail="Buyurtma topilmadi / Заказ не найден")
    result = OrderSchema.from_orm(order)
    review = (await db.execute(select(ReviewModel).where(ReviewModel.order_id == order.id))).scalars().first()
    result.review_rating = review.rating if review else None
    return result

@router.patch("/{order_id}/status", dependencies=[Depends(current_admin)])
async def update_order_status(
    order_id: int,
    status: str = Body(..., embed=True),
    db: AsyncSession = Depends(get_db)
):
    valid_statuses = ["pending", "accepted", "picking", "ready", "at_point", "handed_over", "on_the_way", "delivered", "cancelled"]
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

@router.patch("/items/{item_id}/toggle-picked", dependencies=[Depends(current_admin)])
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
    res = await db.execute(load_order(OrderModel.order_number == order_number.replace("#", "").strip().upper()))
    order = res.scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Buyurtma topilmadi / Заказ не найден")
    if order.status not in ["pending", "accepted"] or order.porter_phone or any(i.seller_handed for i in order.items):
        raise HTTPException(status_code=409, detail="Aravachi buyurtmani yig'ishni boshladi, bekor qilib bo'lmaydi / Аравачи уже собирает заказ, отменить нельзя")

    act_as("customer", order.customer_tg_id or order.customer_phone)
    order.status = "cancelled"
    await db.commit()
    notify_status(order.id)
    return order


# Who may say "the customer has it" depends on where the order is
RECEIVABLE = {"self": ["pending", "accepted", "ready", "delivered"], "point": ["at_point", "delivered"], "courier": ["on_the_way", "delivered"]}


@router.post("/{order_number}/received", response_model=OrderSchema)
async def confirm_received(order_number: str, db: AsyncSession = Depends(get_db)):
    """Last step: the customer confirms they got the order, then can rate it."""
    order = (await db.execute(load_order(OrderModel.order_number == order_number.replace("#", "").strip().upper()))).scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Buyurtma topilmadi / Заказ не найден")
    if order.status not in RECEIVABLE.get(order.fulfillment or "courier", []):
        raise HTTPException(status_code=409, detail="Buyurtma hali yetib kelmadi / Заказ ещё не у вас")
    if order.fulfillment == "self" and not all(i.seller_handed for i in order.items):
        raise HTTPException(status_code=409, detail="Hamma rastalardan oling, sotuvchilar «Topshirdim» bosadi / Заберите у всех раст, продавцы нажмут «Передал»")

    was_delivered = order.status == "delivered"
    act_as("customer", order.customer_tg_id or order.customer_phone)
    order.status = "delivered"
    if not order.customer_confirmed_at:
        log_event(order, "received")
    order.customer_confirmed_at = order.customer_confirmed_at or datetime.utcnow()
    await db.commit()
    if not was_delivered:
        notify_status(order.id)
    return (await db.execute(load_order(OrderModel.id == order.id))).scalars().first()


@router.post("/{order_number}/items/{item_id}/weight-decision", response_model=OrderSchema)
async def weight_decision(order_number: str, item_id: int, approve: bool = Body(..., embed=True), db: AsyncSession = Depends(get_db)):
    """The customer agrees to a much heavier piece, or keeps the ordered weight (the seller trims it)."""
    order = (await db.execute(load_order(OrderModel.order_number == order_number.replace("#", "").strip().upper()))).scalars().first()
    item = next((i for i in order.items if i.id == item_id), None) if order else None
    if not item:
        raise HTTPException(status_code=404, detail="Buyurtma topilmadi / Заказ не найден")
    if item.weight_status != "pending":
        raise HTTPException(status_code=409, detail="Javob allaqachon berilgan / Ответ уже дан")
    act_as("customer", order.customer_tg_id or order.customer_phone)
    item.weight_status = "approved" if approve else "rejected"
    log_event(order, "weight_decision", item_id=item.id, approve=approve)
    recalc(order)
    await db.commit()
    notify_adjustment(order.id, item.id, "decision")
    return (await db.execute(load_order(OrderModel.id == order.id))).scalars().first()
