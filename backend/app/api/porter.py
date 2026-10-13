import re
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.schemas import OrderModel, OrderItemModel, StoreModel, StaffModel
from app.api.auth import staff_with_role
from app.bot.notify import notify_status, notify_taxis

router = APIRouter(prefix="/api/porter", tags=["porter"])

# Statuses an aravachi (bazaar porter) works with
OPEN_STATUSES = ["pending", "accepted"]
ACTIVE_STATUSES = ["picking", "handed_over", "on_the_way"]
PORTER_NEXT_STATUSES = ["picking", "handed_over", "on_the_way", "delivered"]

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
            "stall_number": store.stall_number if store else "",
            "owner_name": store.owner_name if store else "",
            "owner_phone": store.owner_phone if store else "",
            "items": [],
        })
        stop["items"].append({
            "id": item.id,
            "product_name": item.product_name,
            "quantity": item.quantity,
            "unit": item.unit,
            "total_price": item.total_price,
            "is_picked": item.is_picked,
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
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "items_count": len(order.items),
        "picked_count": sum(1 for i in order.items if i.is_picked),
        "stops": sorted(stops.values(), key=stall_sort_key),
    }


async def get_porter_order(order_id: int, db: AsyncSession) -> OrderModel:
    res = await db.execute(
        select(OrderModel).where(OrderModel.id == order_id).options(selectinload(OrderModel.items))
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
        .options(selectinload(OrderModel.items))
    )
    orders = res.scalars().all()
    available = [o for o in orders if not o.porter_phone and o.status in OPEN_STATUSES]
    # Once a taxi took the order the porter's part is done
    mine = [
        o for o in orders
        if o.porter_phone == porter.phone and (o.status == "picking" or not o.taxi_phone)
    ]
    return {
        "available": [await serialize_order(o, db) for o in available],
        "mine": [await serialize_order(o, db) for o in mine],
    }


@router.post("/orders/{order_id}/take")
async def take_order(order_id: int, porter: StaffModel = Depends(current_porter), db: AsyncSession = Depends(get_db)):
    order = await get_porter_order(order_id, db)
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
    porter: StaffModel = Depends(current_porter),
    db: AsyncSession = Depends(get_db)
):
    if status not in PORTER_NEXT_STATUSES:
        raise HTTPException(status_code=400, detail="Noto'g'ri status")
    order = await get_porter_order(order_id, db)
    own_order(order, porter)
    if status in ("handed_over", "on_the_way") and not all(i.is_picked for i in order.items):
        raise HTTPException(status_code=409, detail="Avval hamma mahsulotlarni yig'ing / Сначала соберите все товары")
    if order.taxi_phone:
        raise HTTPException(status_code=409, detail="Buyurtma taksichida / Заказ уже у таксиста")

    order.status = status
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
