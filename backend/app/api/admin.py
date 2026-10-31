"""Bozorkom (bazaar administration): approves stalls and workers, sees orders, patta and settings."""
import hmac
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Body, Header, Request
from sqlalchemy import select, func, case, or_, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from app.config import settings
from app.database import get_db
from app.models.schemas import StoreModel, StaffModel, OrderModel, OrderEventModel, CustomerModel, CustomerBlockModel, PIN_PATTERN
from app.api.auth import make_admin_token, current_admin, check_not_locked, record_failure, client_ip
from app.api.tg_auth import telegram_user
from app.api.patta import day_report, tashkent_day
from app.api.staff import staff_public
from app.services.config_store import get_setting, set_setting
from app.services.customer_guard import phone_key
from app.services import stock, no_show
from app.bot.notify import notify_status, notify_store_decision, notify_staff_decision

router = APIRouter(prefix="/api/admin", tags=["admin"])
admin_only = [Depends(current_admin)]
TUNABLE_SETTINGS = ("max_open_orders", "new_customer_max_open", "new_customer_max_total", "orders_per_10_min", "morning_stock_hour",
                    "no_show_remind_min", "no_show_after_min", "self_no_show_min", "return_alert_min", "no_show_strikes")


def store_public(s: StoreModel) -> dict:
    return {
        "id": s.id, "name_uz": s.name_uz, "name_ru": s.name_ru, "name_en": s.name_en, "stall_number": s.stall_number,
        "owner_name": s.owner_name, "owner_phone": s.owner_phone, "category_slug": s.category_slug,
        "status": s.status, "is_open": s.is_open,
        "created_at": s.created_at.isoformat() if s.created_at else None,
    }


@router.post("/login")
async def admin_login(
    request: Request,
    pin: str = Body(..., embed=True),
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    # The admin PIN has no phone, so limit wrong tries per address
    check_not_locked(request, f"admin:{client_ip(request)}")
    if not settings.ADMIN_PIN:
        raise HTTPException(status_code=403, detail="Ma'muriyat PIN-kodi sozlanmagan / PIN администрации не настроен")
    if not hmac.compare_digest(pin.strip(), settings.ADMIN_PIN):
        record_failure(request, f"admin:{client_ip(request)}")
        raise HTTPException(status_code=401, detail="PIN-kod noto'g'ri / Неверный PIN-код")
    # Signing in inside Telegram makes the bot send new applications to the bozorkom
    tg_user = telegram_user(x_telegram_init_data)
    if tg_user:
        await set_setting(db, "admin_tg_id", str(tg_user["id"]))
    return {"success": True, "token": make_admin_token()}


@router.get("/overview", dependencies=admin_only)
async def overview(db: AsyncSession = Depends(get_db)):
    stores = (await db.execute(select(StoreModel))).scalars().all()
    staff = (await db.execute(select(StaffModel))).scalars().all()
    since = datetime.utcnow() - timedelta(hours=24)
    orders = (await db.execute(select(OrderModel).where(OrderModel.created_at >= since))).scalars().all()
    patta = await day_report(db, tashkent_day())
    by_status = {}
    for o in orders:
        by_status[o.status] = by_status.get(o.status, 0) + 1
    return {
        "pending_stores": sum(1 for s in stores if s.status == "pending"),
        "pending_staff": sum(1 for s in staff if s.status == "pending"),
        "stores": sum(1 for s in stores if s.status == "approved"),
        "staff": {role: sum(1 for s in staff if s.role == role and s.status == "approved") for role in ("porter", "taxi", "pattachi")},
        "orders_24h": len(orders),
        "orders_by_status": by_status,
        "revenue_24h": sum(o.total_amount for o in orders if o.status != "cancelled"),
        "patta_today": {"paid": patta["paid_count"], "of": len(patta["stores"]), "total": patta["total"]},
        "delivery_radius_km": float(await get_setting(db, "delivery_radius_km")),
        "patta_amount": float(await get_setting(db, "patta_amount")),
        "support_phone": await get_setting(db, "support_phone"),
        "porter_fee": float(await get_setting(db, "porter_fee")),
        "taxi_fee": float(await get_setting(db, "taxi_fee")),
        **{key: float(await get_setting(db, key)) for key in TUNABLE_SETTINGS},
    }


@router.get("/stores", dependencies=admin_only)
async def list_stores(db: AsyncSession = Depends(get_db)):
    stores = (await db.execute(select(StoreModel).order_by(StoreModel.id.desc()))).scalars().all()
    return [store_public(s) for s in stores]


@router.post("/stores/{store_id}/status", dependencies=admin_only)
async def set_store_status(store_id: int, status: str = Body(..., embed=True), db: AsyncSession = Depends(get_db)):
    if status not in ("approved", "rejected", "blocked"):
        raise HTTPException(status_code=400, detail="Noto'g'ri status")
    store = await db.get(StoreModel, store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Rasta topilmadi")
    store.status = status
    await db.commit()
    notify_store_decision(store.id)
    return store_public(store)


@router.post("/stores/{store_id}/reset-pin", dependencies=admin_only)
async def reset_store_pin(store_id: int, pin: str = Body(..., embed=True, pattern=PIN_PATTERN), db: AsyncSession = Depends(get_db)):
    store = await db.get(StoreModel, store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Rasta topilmadi")
    store.seller_pin = pin
    await db.commit()
    return {"success": True}


@router.get("/staff", dependencies=admin_only)
async def list_staff(db: AsyncSession = Depends(get_db)):
    staff = (await db.execute(select(StaffModel).order_by(StaffModel.id.desc()))).scalars().all()
    return [{**staff_public(s), "created_at": s.created_at.isoformat() if s.created_at else None} for s in staff]


@router.post("/staff/{staff_id}/status", dependencies=admin_only)
async def set_staff_status(staff_id: int, status: str = Body(..., embed=True), db: AsyncSession = Depends(get_db)):
    if status not in ("approved", "rejected", "blocked"):
        raise HTTPException(status_code=400, detail="Noto'g'ri status")
    staff = await db.get(StaffModel, staff_id)
    if not staff:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")
    staff.status = status
    await db.commit()
    notify_staff_decision(staff.id)
    return staff_public(staff)


@router.post("/staff/{staff_id}/reset-pin", dependencies=admin_only)
async def reset_staff_pin(staff_id: int, pin: str = Body(..., embed=True, pattern=PIN_PATTERN), db: AsyncSession = Depends(get_db)):
    staff = await db.get(StaffModel, staff_id)
    if not staff:
        raise HTTPException(status_code=404, detail="Xodim topilmadi")
    staff.pin = pin
    await db.commit()
    return {"success": True}


@router.get("/orders", dependencies=admin_only)
async def list_orders(db: AsyncSession = Depends(get_db)):
    since = datetime.utcnow() - timedelta(days=3)
    res = await db.execute(
        select(OrderModel).where(OrderModel.created_at >= since).order_by(OrderModel.id.desc()).limit(200).options(selectinload(OrderModel.items))
    )
    return [
        {
            "id": o.id, "order_number": o.order_number, "status": o.status, "customer_name": o.customer_name,
            "customer_phone": o.customer_phone, "delivery_address": o.delivery_address, "total_amount": o.total_amount,
            "porter_name": o.porter_name, "taxi_name": o.taxi_name, "items_count": len(o.items),
            "fulfillment": o.fulfillment or "courier",
            "created_at": o.created_at.isoformat() if o.created_at else None,
        }
        for o in res.scalars().all()
    ]


@router.post("/orders/{order_id}/cancel", dependencies=admin_only)
async def cancel_order(order_id: int, db: AsyncSession = Depends(get_db)):
    order = await db.get(OrderModel, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Buyurtma topilmadi")
    if order.status in ("delivered", "cancelled", "returned"):
        raise HTTPException(status_code=409, detail="Buyurtma allaqachon yopilgan / Заказ уже закрыт")
    if order.status == "no_show":
        raise HTTPException(status_code=409, detail="Mahsulot rastalarga qaytarilmoqda / Товар возвращают на расты")
    order.status = "cancelled"
    await db.flush()
    await stock.settle(db, order.id)
    await db.commit()
    notify_status(order.id)
    return {"success": True}


@router.post("/orders/{order_id}/undo-no-show", dependencies=admin_only)
async def undo_no_show(order_id: int, db: AsyncSession = Depends(get_db)):
    """The customer did come (or it was pressed by mistake): the order goes back to waiting."""
    order = (await db.execute(select(OrderModel).where(OrderModel.id == order_id).options(selectinload(OrderModel.items)))).scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Buyurtma topilmadi")
    await no_show.undo(db, order)
    await db.commit()
    notify_status(order.id)
    return {"success": True, "status": order.status}


@router.post("/customers/{key}/forgive", dependencies=admin_only)
async def forgive_no_shows(key: str, db: AsyncSession = Depends(get_db)):
    """Bozorkom: this customer's no-shows no longer count (a real reason, a mix-up)."""
    res = await db.execute(update(OrderModel).where(OrderModel.phone_key == key, OrderModel.status.in_(["no_show", "returned"]))
                           .values(no_show_forgiven=True))
    await db.commit()
    return {"success": True, "forgiven": res.rowcount}


@router.get("/orders/{order_id}/events", dependencies=admin_only)
async def order_events(order_id: int, db: AsyncSession = Depends(get_db)):
    """The order's history, oldest first: what happened, who did it and when (for disputes)."""
    res = await db.execute(select(OrderEventModel).where(OrderEventModel.order_id == order_id).order_by(OrderEventModel.id))
    return [
        {"kind": e.kind, "from_status": e.from_status, "to_status": e.to_status, "actor_role": e.actor_role,
         "actor_id": e.actor_id, "data": e.data, "created_at": e.created_at.isoformat()}
        for e in res.scalars().all()
    ]


@router.get("/customers", dependencies=admin_only)
async def list_customers(q: str = "", db: AsyncSession = Depends(get_db)):
    """Customers by phone, latest first: how many orders, received, cancelled, and whether blocked."""
    query = (
        select(
            OrderModel.phone_key,
            func.count(OrderModel.id),
            func.sum(case((OrderModel.status == "delivered", 1), else_=0)),
            func.sum(case((OrderModel.status == "cancelled", 1), else_=0)),
            func.max(OrderModel.id),
            func.sum(case((OrderModel.status.in_(["no_show", "returned"]) & OrderModel.no_show_forgiven.is_not(True), 1), else_=0)),
        )
        .where(OrderModel.phone_key.is_not(None))
        .group_by(OrderModel.phone_key)
        .order_by(func.max(OrderModel.id).desc())
        .limit(200)
    )
    digits = "".join(ch for ch in q if ch.isdigit())
    if digits:
        query = query.where(OrderModel.phone_key.contains(digits[-9:]))
    elif q.strip():
        query = query.where(OrderModel.customer_name.ilike(f"%{q.strip()}%"))
    rows = (await db.execute(query)).all()
    last_orders = {o.id: o for o in (await db.execute(
        select(OrderModel).where(OrderModel.id.in_([r[4] for r in rows])))).scalars().all()}
    blocks = {b.phone_key: b for b in (await db.execute(
        select(CustomerBlockModel).where(CustomerBlockModel.phone_key.in_([r[0] for r in rows])))).scalars().all()}
    result = []
    for key, total, delivered, cancelled, last_id, no_shows in rows:
        last = last_orders[last_id]
        block = blocks.get(key)
        result.append({
            "phone_key": key, "name": last.customer_name, "phone": last.customer_phone, "tg_id": last.customer_tg_id,
            "orders": total, "delivered": delivered or 0, "cancelled": cancelled or 0, "no_shows": no_shows or 0,
            "last_order": last.order_number, "last_order_at": last.created_at.isoformat() if last.created_at else None,
            "blocked": bool(block), "block_reason": block.reason if block else None,
        })
    return result


@router.post("/customers/block", dependencies=admin_only)
async def block_customer(
    phone: str = Body(..., embed=True),
    reason: Optional[str] = Body(None, embed=True, max_length=200),
    db: AsyncSession = Depends(get_db),
):
    key = phone_key(phone)
    if not key:
        raise HTTPException(status_code=400, detail="Telefon raqami noto'g'ri / Неверный номер телефона")
    # The Telegram account goes on the list too, so a new phone number alone does not get round it
    tg_id = (await db.execute(
        select(OrderModel.customer_tg_id).where(OrderModel.phone_key == key, OrderModel.customer_tg_id.is_not(None))
        .order_by(OrderModel.id.desc()).limit(1))).scalar()
    if not tg_id:
        for customer in (await db.execute(select(CustomerModel).where(CustomerModel.phone.is_not(None)))).scalars():
            if phone_key(customer.phone) == key:
                tg_id = customer.tg_id
                break
    block = (await db.execute(select(CustomerBlockModel).where(CustomerBlockModel.phone_key == key))).scalars().first()
    if not block:
        block = CustomerBlockModel(phone_key=key)
        db.add(block)
    block.tg_id = tg_id
    block.reason = (reason or "").strip() or None
    await db.commit()
    return {"success": True, "phone_key": key, "tg_id": tg_id}


@router.delete("/customers/block/{key}", dependencies=admin_only)
async def unblock_customer(key: str, db: AsyncSession = Depends(get_db)):
    block = (await db.execute(select(CustomerBlockModel).where(CustomerBlockModel.phone_key == key))).scalars().first()
    if not block:
        raise HTTPException(status_code=404, detail="Topilmadi / Не найдено")
    await db.delete(block)
    await db.commit()
    return {"success": True}


@router.get("/patta", dependencies=admin_only)
async def patta_report(day: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    return await day_report(db, day or tashkent_day())


@router.put("/settings", dependencies=admin_only)
async def update_settings(
    delivery_radius_km: Optional[float] = Body(None, gt=0.5, le=50),
    patta_amount: Optional[float] = Body(None, gt=0, le=10_000_000),
    support_phone: Optional[str] = Body(None, max_length=30, pattern=r"^[\d\s()+-]*$"),
    porter_fee: Optional[float] = Body(None, ge=0, le=1_000_000),
    taxi_fee: Optional[float] = Body(None, ge=0, le=1_000_000),
    max_open_orders: Optional[int] = Body(None, ge=1, le=20),
    new_customer_max_open: Optional[int] = Body(None, ge=1, le=20),
    new_customer_max_total: Optional[float] = Body(None, ge=10_000, le=100_000_000),
    orders_per_10_min: Optional[int] = Body(None, ge=1, le=1000),
    morning_stock_hour: Optional[int] = Body(None, ge=4, le=12),
    no_show_remind_min: Optional[int] = Body(None, ge=1, le=120),
    no_show_after_min: Optional[int] = Body(None, ge=5, le=180),
    self_no_show_min: Optional[int] = Body(None, ge=15, le=600),
    return_alert_min: Optional[int] = Body(None, ge=10, le=600),
    no_show_strikes: Optional[int] = Body(None, ge=1, le=10),
    db: AsyncSession = Depends(get_db)
):
    if delivery_radius_km is not None:
        await set_setting(db, "delivery_radius_km", f"{delivery_radius_km:g}")
    if patta_amount is not None:
        await set_setting(db, "patta_amount", f"{patta_amount:g}")
    if support_phone is not None:
        await set_setting(db, "support_phone", support_phone.strip())
    for key, value in (("porter_fee", porter_fee), ("taxi_fee", taxi_fee), ("max_open_orders", max_open_orders),
                       ("new_customer_max_open", new_customer_max_open), ("new_customer_max_total", new_customer_max_total),
                       ("orders_per_10_min", orders_per_10_min), ("morning_stock_hour", morning_stock_hour),
                       ("no_show_remind_min", no_show_remind_min), ("no_show_after_min", no_show_after_min),
                       ("self_no_show_min", self_no_show_min), ("return_alert_min", return_alert_min),
                       ("no_show_strikes", no_show_strikes)):
        if value is not None:
            await set_setting(db, key, f"{value:g}")
    return {
        "delivery_radius_km": float(await get_setting(db, "delivery_radius_km")),
        "patta_amount": float(await get_setting(db, "patta_amount")),
        "support_phone": await get_setting(db, "support_phone"),
        "porter_fee": float(await get_setting(db, "porter_fee")),
        "taxi_fee": float(await get_setting(db, "taxi_fee")),
        **{key: float(await get_setting(db, key)) for key in TUNABLE_SETTINGS},
    }
