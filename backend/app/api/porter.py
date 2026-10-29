import re
import uuid
import mimetypes
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Body, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.schemas import OrderModel, OrderItemModel, StoreModel, StaffModel
from app.api.auth import staff_with_role
from app.bot.notify import notify_status, notify_taxis, notify_adjustment
from app.services.adjust import set_weight, set_missing, check_code
from app.services.storage import save_media

router = APIRouter(prefix="/api/porter", tags=["porter"])

# Statuses an aravachi (bazaar porter) works with
OPEN_STATUSES = ["pending", "accepted"]
ACTIVE_STATUSES = ["picking", "at_point", "handed_over", "on_the_way"]
PORTER_NEXT_STATUSES = ["picking", "at_point", "handed_over", "on_the_way", "delivered"]

current_porter = staff_with_role("porter")


async def serialize_order(order: OrderModel, db: AsyncSession) -> dict:
    """Order with its items grouped into a route by bazaar stall (rasta)."""
    store_ids = {i.store_id for i in order.items}
    stores = {}
    if store_ids:
        res = await db.execute(select(StoreModel).where(StoreModel.id.in_(store_ids)))
        stores = {s.id: s for s in res.scalars().all()}

    stops = {}
    for item in order.items:
        store = stores.get(item.store_id)
        stop = stops.setdefault(item.store_id, {
            "store_id": item.store_id,
            "store_name_uz": store.name_uz if store else "",
            "store_name_ru": store.name_ru if store else "",
            "store_name_en": store.name_en if store else "",
            "stall_number": store.stall_number if store else "",
            "owner_name": store.owner_name if store else "",
            "owner_phone": store.owner_phone if store else "",
            "items": [],
        })
        stop["items"].append({
            "id": item.id,
            "product_name": item.product_name,
            "product_name_ru": item.product_name_ru,
            "product_name_en": item.product_name_en,
            "quantity": item.quantity,
            "unit": item.unit,
            "total_price": item.total_price,
            "is_picked": item.is_picked,
            "price": item.price,
            "actual_quantity": item.actual_quantity,
            "item_status": item.item_status or "ok",
            "weight_status": item.weight_status,
            "weight_photo_url": item.weight_photo_url,
            "seller_ready": bool(item.seller_ready),
            "seller_handed": bool(item.seller_handed),
        })

    def stall_sort_key(stop):
        match = re.search(r"\d+", stop["stall_number"] or "")
        return int(match.group()) if match else 9999

    return {
        "id": order.id,
        "order_number": order.order_number,
        "status": order.status,
        "customer_name": order.customer_name,
        "customer_phone": order.customer_phone,
        "delivery_address": order.delivery_address,
        "delivery_district": order.delivery_district,
        "landmark": order.landmark,
        "delivery_lat": order.delivery_lat,
        "delivery_lng": order.delivery_lng,
        "delivery_time_slot": order.delivery_time_slot,
        "payment_method": order.payment_method,
        "total_amount": order.total_amount,
        "notes": order.notes,
        "porter_name": order.porter_name,
        "porter_phone": order.porter_phone,
        "taxi_name": order.taxi_name,
        "taxi_phone": order.taxi_phone,
        "fulfillment": order.fulfillment or "courier",
        "handed_over_at": order.handed_over_at.isoformat() if order.handed_over_at else None,
        "taxi_eta_at": order.taxi_eta_at.isoformat() if order.taxi_eta_at else None,
        # The code itself stays with the customer; workers only learn that one is needed
        "needs_code": bool(order.handoff_code),
        "handoff_point": order.handoff_point,
        # Gifts must travel with the order, so the aravachi collects them too
        "gifts": [
            {"text": b.text, "text_ru": b.text_ru, "text_en": b.text_en,
             "stall_number": stores[b.store_id].stall_number if b.store_id in stores else ""}
            for b in order.bonuses if b.kind == "gift"
        ],
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "items_count": len(order.items),
        "picked_count": sum(1 for i in order.items if i.is_picked),
        "stops": sorted(stops.values(), key=stall_sort_key),
    }


async def get_porter_order(order_id: int, db: AsyncSession) -> OrderModel:
    res = await db.execute(
        select(OrderModel).where(OrderModel.id == order_id).options(selectinload(OrderModel.items).selectinload(OrderItemModel.product), selectinload(OrderModel.bonuses))
    )
    order = res.scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Buyurtma topilmadi / Заказ не найден")
    return order


def own_order(order: OrderModel, porter: StaffModel):
    if order.porter_phone != porter.phone:
        raise HTTPException(status_code=403, detail="Bu sizning buyurtmangiz emas / Это не ваш заказ")


@router.get("/orders")
async def list_porter_orders(porter: StaffModel = Depends(current_porter), db: AsyncSession = Depends(get_db)):
    """New orders nobody has taken yet, plus the orders this porter is carrying."""
    res = await db.execute(
        select(OrderModel)
        .where(OrderModel.status.in_(OPEN_STATUSES + ACTIVE_STATUSES))
        .order_by(OrderModel.id.desc())
        .limit(100)
        .options(selectinload(OrderModel.items).selectinload(OrderItemModel.product), selectinload(OrderModel.bonuses))
    )
    orders = res.scalars().all()
    # Self-pickup orders never need an aravachi
    available = [o for o in orders if not o.porter_phone and o.status in OPEN_STATUSES and o.fulfillment != "self"]
    # The bag stays with the aravachi until the taxi says «Qabul qildim» (on_the_way), so he sees when to go to the gate
    mine = [
        o for o in orders
        if o.porter_phone == porter.phone and (o.status in ("picking", "handed_over", "at_point") or not o.taxi_phone)
    ]
    return {
        "available": [await serialize_order(o, db) for o in available],
        "mine": [await serialize_order(o, db) for o in mine],
    }


@router.post("/orders/{order_id}/take")
async def take_order(order_id: int, porter: StaffModel = Depends(current_porter), db: AsyncSession = Depends(get_db)):
    order = await get_porter_order(order_id, db)
    if order.fulfillment == "self":
        raise HTTPException(status_code=409, detail="Xaridor o'zi olib ketadi / Покупатель заберёт сам")
    if order.porter_phone and order.porter_phone != porter.phone:
        raise HTTPException(status_code=409, detail="Bu buyurtmani boshqa aravachi oldi / Заказ уже взял другой аравачи")
    if order.status not in OPEN_STATUSES + ["picking"]:
        raise HTTPException(status_code=409, detail="Buyurtma allaqachon yo'lda / Заказ уже в пути")

    order.porter_name = porter.name
    order.porter_phone = porter.phone
    order.porter_accepted_at = datetime.utcnow()
    order.status = "picking"
    await db.commit()
    notify_status(order_id)
    return await serialize_order(await get_porter_order(order_id, db), db)


@router.patch("/items/{item_id}/picked")
async def set_item_picked(
    item_id: int,
    is_picked: bool = Body(..., embed=True),
    porter: StaffModel = Depends(current_porter),
    db: AsyncSession = Depends(get_db)
):
    item = await db.get(OrderItemModel, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi")
    order = await get_porter_order(item.order_id, db)
    own_order(order, porter)
    if order.status != "picking":
        raise HTTPException(status_code=409, detail="Buyurtma allaqachon topshirilgan / Заказ уже передан")

    item.is_picked = is_picked
    await db.commit()
    return {"success": True, "is_picked": item.is_picked}


@router.patch("/orders/{order_id}/status")
async def set_porter_status(
    order_id: int,
    status: str = Body(..., embed=True),
    code: Optional[str] = Body(None, embed=True),
    porter: StaffModel = Depends(current_porter),
    db: AsyncSession = Depends(get_db)
):
    if status not in PORTER_NEXT_STATUSES:
        raise HTTPException(status_code=400, detail="Noto'g'ri status")
    order = await get_porter_order(order_id, db)
    own_order(order, porter)
    if status in ("at_point", "handed_over", "on_the_way", "delivered") and not all(i.is_picked for i in order.items):
        raise HTTPException(status_code=409, detail="Avval hamma mahsulotlarni yig'ing / Сначала соберите все товары")
    # A point order ends at the bazaar point; a courier order goes on to a taxi (or the aravachi drives it)
    allowed = ["picking", "at_point", "delivered"] if order.fulfillment == "point" else ["picking", "handed_over", "on_the_way", "delivered"]
    if status not in allowed:
        raise HTTPException(status_code=409, detail="Bu buyurtma uchun mumkin emas / Для этого заказа нельзя")
    if order.taxi_phone:
        raise HTTPException(status_code=409, detail="Buyurtma taksichida / Заказ уже у таксиста")

    if status == "delivered":
        check_code(order, code)
    order.status = status
    if status == "handed_over":
        order.handed_over_at = datetime.utcnow()
    await db.commit()
    notify_status(order_id)
    if status == "handed_over":
        notify_taxis(order_id)
    return await serialize_order(await get_porter_order(order_id, db), db)


@router.post("/orders/{order_id}/release")
async def release_order(order_id: int, porter: StaffModel = Depends(current_porter), db: AsyncSession = Depends(get_db)):
    """Porter gives the order back so another aravachi can take it."""
    order = await get_porter_order(order_id, db)
    own_order(order, porter)
    if order.status != "picking":
        raise HTTPException(status_code=409, detail="Buyurtmani endi qaytarib bo'lmaydi / Заказ уже нельзя вернуть")

    order.porter_name = None
    order.porter_phone = None
    order.porter_accepted_at = None
    order.status = "accepted"
    for item in order.items:
        item.is_picked = False
    await db.commit()
    return {"success": True}


async def porter_item(item_id: int, porter: StaffModel, db: AsyncSession):
    item = await db.get(OrderItemModel, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi")
    order = await get_porter_order(item.order_id, db)
    own_order(order, porter)
    return order, next(i for i in order.items if i.id == item_id)


@router.patch("/items/{item_id}/weight")
async def porter_weight(
    item_id: int,
    actual_quantity: float = Body(..., embed=True),
    photo_url: Optional[str] = Body(None, embed=True, max_length=500),
    porter: StaffModel = Depends(current_porter),
    db: AsyncSession = Depends(get_db)
):
    """The scale showed another weight: the price follows it."""
    order, item = await porter_item(item_id, porter, db)
    set_weight(order, item, actual_quantity, photo_url)
    item.is_picked = True
    await db.commit()
    notify_adjustment(order.id, item.id, "weight")
    return await serialize_order(await get_porter_order(order.id, db), db)


@router.post("/items/{item_id}/missing")
async def porter_missing(item_id: int, missing: bool = Body(True, embed=True), porter: StaffModel = Depends(current_porter), db: AsyncSession = Depends(get_db)):
    """The stall ran out: only this line is dropped, the rest of the order goes on."""
    order, item = await porter_item(item_id, porter, db)
    set_missing(order, item, missing)
    await db.commit()
    notify_adjustment(order.id, item.id, "missing" if missing else "back")
    if order.status == "cancelled":
        notify_status(order.id)
    return await serialize_order(await get_porter_order(order.id, db), db)


@router.post("/upload-photo")
async def porter_photo(file: UploadFile = File(...), porter: StaffModel = Depends(current_porter), db: AsyncSession = Depends(get_db)):
    """Photo of the scale, so the customer sees the weight they pay for."""
    data = await file.read()
    if len(data) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Rasm juda katta (max 10 MB) / Фото слишком большое")
    content_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or ""
    if not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Faqat rasm / Только фото")
    return {"url": await save_media(db, f"scale-{uuid.uuid4().hex}.jpg", content_type, data)}
