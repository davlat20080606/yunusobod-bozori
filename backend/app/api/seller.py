import re
import uuid
import mimetypes
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Header, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.api.tg_auth import telegram_user
from app.api.auth import (
    current_store, current_owner_store, make_seller_token, make_member_token, seller_identity, normalize_phone,
    check_not_locked, record_failure
)
from app.bot.notify import notify_admin_application, notify_status
from app.services.storage import save_media
from app.services.adjust import set_weight, set_missing
from app.bot.notify import notify_adjustment
from app.models.schemas import (
    StoreModel, ProductModel, OrderModel, OrderItemModel, CategoryModel,
    ProductSchema, StoreSchema, UpdatePriceSchema, ToggleAvailabilitySchema,
    SellerLoginSchema, StoreRegisterSchema, StoreUpdateSchema, ProductCreateSchema, OrderSchema,
    MediaModel, PromoModel, PromoCreateSchema, OrderItemSchema, OrderBonusSchema,
    StoreMemberModel, StoreInviteModel
)

router = APIRouter(prefix="/api/seller", tags=["seller"])

MAX_MEDIA_BYTES = 20 * 1024 * 1024


async def own_product(product_id: int, store: StoreModel, db: AsyncSession) -> ProductModel:
    prod = await db.get(ProductModel, product_id)
    if not prod or prod.store_id != store.id:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi / Товар не найден")
    return prod


async def phone_taken(db: AsyncSession, phone: str, except_store_id: int = None) -> bool:
    wanted = normalize_phone(phone)
    res = await db.execute(select(StoreModel.id, StoreModel.owner_phone))
    return any(normalize_phone(p) == wanted and sid != except_store_id for sid, p in res.all())


@router.post("/login")
async def seller_login(
    data: SellerLoginSchema,
    request: Request,
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    phone = normalize_phone(data.phone_or_slug)
    check_not_locked(request, f"seller:{phone}")
    if len(phone) < 9:
        raise HTTPException(status_code=400, detail="Telefon raqamini to'liq kiriting / Введите номер телефона полностью")

    res = await db.execute(select(StoreModel))
    store = next((s for s in res.scalars().all() if normalize_phone(s.owner_phone) == phone), None)

    if not store or store.seller_pin != data.pin.strip():
        record_failure(request, f"seller:{phone}")
        raise HTTPException(status_code=401, detail="Telefon yoki PIN-kod noto'g'ri / Неверный телефон или PIN-код")
    if store.status == "pending":
        raise HTTPException(status_code=403, detail="Arizangiz bozorkomda ko'rib chiqilmoqda / Ваша заявка на рассмотрении у администрации")
    if store.status != "approved":
        raise HTTPException(status_code=403, detail="Rastangiz faol emas. Bozorkomga murojaat qiling / Раста не активна, обратитесь в администрацию")

    # Signing in inside Telegram turns on new-order messages for this stall
    tg_user = telegram_user(x_telegram_init_data)
    if tg_user:
        store.telegram_chat_id = str(tg_user["id"])
        # The one who knows the PIN is the owner; next time Telegram alone opens the cabinet
        await add_member(db, store.id, tg_user, "owner")
        await db.commit()
        await db.refresh(store)

    return {
        "success": True,
        "token": make_seller_token(store),
        "store": StoreSchema.from_orm(store),
        "role": "owner",
    }


async def add_member(db: AsyncSession, store_id: int, tg_user: dict, role: str) -> StoreMemberModel:
    tg_id = str(tg_user["id"])
    name = " ".join(x for x in (tg_user.get("first_name"), tg_user.get("last_name")) if x) or tg_user.get("username") or "—"
    member = (await db.execute(
        select(StoreMemberModel).where(StoreMemberModel.store_id == store_id, StoreMemberModel.tg_id == tg_id)
    )).scalars().first()
    if member:
        member.name = name[:100]
        if role == "owner":
            member.role = "owner"
    else:
        member = StoreMemberModel(store_id=store_id, tg_id=tg_id, name=name[:100], role=role)
        db.add(member)
    await db.flush()
    return member


@router.post("/register-store")
async def register_store(
    data: StoreRegisterSchema,
    x_telegram_init_data: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db)
):
    """Self-registration for magazinchi, mevachi, polizchi, go'shtchi; the bozorkom approves it."""
    if len(normalize_phone(data.owner_phone)) < 9:
        raise HTTPException(status_code=400, detail="Telefon raqamini to'liq kiriting / Введите номер телефона полностью")
    if await phone_taken(db, data.owner_phone):
        raise HTTPException(status_code=409, detail="Bu telefon raqami bilan rasta allaqachon bor / Раста с этим телефоном уже есть")
    if not (await db.execute(select(CategoryModel).where(CategoryModel.slug == data.category_slug))).scalars().first():
        raise HTTPException(status_code=400, detail="Bo'lim topilmadi / Раздел не найден")

    base_slug = re.sub(r'[^a-zA-Z0-9]+', '-', data.name_uz.lower()).strip('-') or "store"
    slug = f"{base_slug}-{uuid.uuid4().hex[:6]}"

    new_store = StoreModel(
        slug=slug,
        name_uz=data.name_uz.strip(),
        name_ru=(data.name_ru or data.name_uz).strip(),
        name_en=data.name_uz.strip(),
        stall_number=data.stall_number.strip(),
        owner_name=data.owner_name.strip(),
        owner_phone=data.owner_phone.strip(),
        seller_pin=data.pin,
        category_slug=data.category_slug,
        avatar_url="/img/p/9dbbb0f54890.jpg",
        banner_url="/img/p/ef38b94878f0.jpg",
        description_uz=data.description_uz or "Yangi saralangan mahsulotlar.",
        description_ru=data.description_ru or "Свежие отборные продукты напрямую с прилавка.",
        description_en="Fresh market produce directly from the stall.",
        is_open=True,
        status="pending",
        rating=5.0,
        total_orders=0
    )
    tg_user = telegram_user(x_telegram_init_data)
    if tg_user:
        new_store.telegram_chat_id = str(tg_user["id"])
    db.add(new_store)
    await db.commit()
    await db.refresh(new_store)
    notify_admin_application(f"🏪 {new_store.name_uz} · {new_store.stall_number} · {new_store.owner_name} ({new_store.owner_phone})")

    return {
        "success": True,
        "message": "Arizangiz bozorkomga yuborildi / Заявка отправлена в администрацию базара",
        "store": StoreSchema.from_orm(new_store)
    }


@router.patch("/stores/me")
async def update_store_profile(data: StoreUpdateSchema, store: StoreModel = Depends(current_owner_store), db: AsyncSession = Depends(get_db)):
    if data.owner_phone is not None:
        if len(normalize_phone(data.owner_phone)) < 9:
            raise HTTPException(status_code=400, detail="Telefon raqamini to'liq kiriting / Введите номер телефона полностью")
        if await phone_taken(db, data.owner_phone, except_store_id=store.id):
            raise HTTPException(status_code=409, detail="Bu telefon raqami band / Этот телефон уже занят")

    for field in ["name_uz", "name_ru", "owner_name", "owner_phone", "stall_number", "description_uz", "description_ru"]:
        value = getattr(data, field)
        if value is not None:
            setattr(store, field, value.strip())
    pin_changed = data.pin is not None and data.pin != store.seller_pin
    if data.pin is not None:
        store.seller_pin = data.pin

    await db.commit()
    await db.refresh(store)

    return {
        "success": True,
        "message": "Ma'lumotlar muvaffaqiyatli saqlandi! / Данные успешно обновлены!",
        "store": StoreSchema.from_orm(store),
        # A new PIN signs out old sessions, so hand the seller a fresh one
        "token": make_seller_token(store) if pin_changed else None
    }


@router.post("/stores/me/products")
async def create_store_product(data: ProductCreateSchema, store: StoreModel = Depends(current_store), db: AsyncSession = Depends(get_db)):
    if not (await db.execute(select(CategoryModel).where(CategoryModel.slug == data.category_slug))).scalars().first():
        raise HTTPException(status_code=400, detail="Bo'lim topilmadi / Раздел не найден")

    default_image = "/img/p/b2fb288e8c9b.jpg"

    new_product = ProductModel(
        store_id=store.id,
        category_slug=data.category_slug,
        name_uz=data.name_uz.strip(),
        name_ru=(data.name_ru or data.name_uz).strip(),
        name_en=data.name_uz.strip(),
        description_uz=data.description_uz or "Yangi saralangan mahsulot.",
        description_ru=data.description_ru or "Свежий отборный продукт напрямую с прилавка.",
        description_en="Fresh market produce directly from the stall.",
        price=data.price,
        unit=data.unit,
        min_weight=data.min_weight,
        step_weight=data.step_weight,
        image_url=data.image_url or default_image,
        video_url=data.video_url or None,
        is_available=True,
        is_featured=True,
        badge=data.badge or "fresh",
        stock_quantity=data.stock_quantity
    )
    db.add(new_product)
    await db.commit()
    await db.refresh(new_product)

    return {
        "success": True,
        "message": "Mahsulot muvaffaqiyatli qo'shildi! / Товар успешно добавлен!",
        "product": ProductSchema.from_orm(new_product)
    }


@router.post("/upload-media")
async def upload_seller_media(file: UploadFile = File(...), store: StoreModel = Depends(current_store), db: AsyncSession = Depends(get_db)):
    data = await file.read()
    if len(data) > MAX_MEDIA_BYTES:
        raise HTTPException(status_code=413, detail="Fayl juda katta (max 20 MB) / Файл слишком большой (макс. 20 МБ)")

    content_type = file.content_type or mimetypes.guess_type(file.filename or "")[0] or ""
    if not content_type.startswith(("image/", "video/")):
        raise HTTPException(status_code=400, detail="Faqat rasm yoki video / Только фото или видео")

    file_ext = Path(file.filename or "").suffix.lower()[:10] or ".jpg"
    unique_name = f"{uuid.uuid4().hex}{file_ext}"
    url = await save_media(db, unique_name, content_type, data)

    return {
        "success": True,
        "url": url,
        "filename": unique_name
    }


@router.get("/my-store")
async def get_my_store_dashboard(store: StoreModel = Depends(current_store), db: AsyncSession = Depends(get_db)):
    prod_res = await db.execute(select(ProductModel).where(ProductModel.store_id == store.id))
    products = prod_res.scalars().all()

    items_res = await db.execute(
        select(OrderItemModel).where(OrderItemModel.store_id == store.id).order_by(OrderItemModel.id.desc()).limit(30)
    )
    recent_items = items_res.scalars().all()

    return {
        "store": StoreSchema.from_orm(store),
        "products": [ProductSchema.from_orm(p) for p in products],
        "recent_items_count": len(recent_items)
    }


@router.patch("/products/{product_id}/price")
async def update_product_price(
    product_id: int,
    data: UpdatePriceSchema,
    store: StoreModel = Depends(current_store),
    db: AsyncSession = Depends(get_db)
):
    prod = await own_product(product_id, store, db)

    if data.old_price is not None:
        prod.old_price = data.old_price
    elif data.price != prod.price:
        prod.old_price = prod.price

    prod.price = data.price
    await db.commit()
    await db.refresh(prod)

    return {
        "success": True,
        "message": f"Narx o'zgartirildi: {prod.price:,.0f} UZS",
        "product": ProductSchema.from_orm(prod)
    }


@router.patch("/products/{product_id}/availability")
async def toggle_product_availability(
    product_id: int,
    data: ToggleAvailabilitySchema,
    store: StoreModel = Depends(current_store),
    db: AsyncSession = Depends(get_db)
):
    prod = await own_product(product_id, store, db)
    prod.is_available = data.is_available
    await db.commit()
    await db.refresh(prod)

    return {
        "success": True,
        "is_available": prod.is_available,
        "message": "Holat yangilandi / Статус обновлен"
    }


@router.patch("/stores/me/toggle-status")
async def toggle_store_open_status(store: StoreModel = Depends(current_store), db: AsyncSession = Depends(get_db)):
    store.is_open = not store.is_open
    await db.commit()
    await db.refresh(store)

    return {
        "success": True,
        "is_open": store.is_open,
        "message": "Do'kon holati yangilandi"
    }


@router.get("/orders")
async def get_store_orders(store: StoreModel = Depends(current_store), db: AsyncSession = Depends(get_db)):
    items_res = await db.execute(
        select(OrderItemModel.order_id).where(OrderItemModel.store_id == store.id)
    )
    order_ids = list({row[0] for row in items_res.all()})
    if not order_ids:
        return []

    orders_res = await db.execute(
        select(OrderModel).where(OrderModel.id.in_(order_ids)).order_by(OrderModel.id.desc()).limit(100)
        .options(selectinload(OrderModel.items).selectinload(OrderItemModel.product), selectinload(OrderModel.bonuses))
    )

    response = []
    for o in orders_res.scalars().all():
        o_dict = OrderSchema.from_orm(o)
        # A seller sees only their own part of a multi-stall order
        o_dict.items = [OrderItemSchema.from_orm(item) for item in o.items if item.store_id == store.id]
        o_dict.bonuses = [OrderBonusSchema.from_orm(b) for b in o.bonuses if b.store_id == store.id]
        response.append(o_dict)
    return response


async def own_order_items(order_id: int, store: StoreModel, db: AsyncSession):
    order = (await db.execute(
        select(OrderModel).where(OrderModel.id == order_id).options(selectinload(OrderModel.items))
    )).scalars().first()
    mine = [i for i in order.items if i.store_id == store.id] if order else []
    if not mine:
        raise HTTPException(status_code=404, detail="Buyurtma topilmadi / Заказ не найден")
    if order.status in ("cancelled", "delivered"):
        raise HTTPException(status_code=409, detail="Buyurtma yopilgan / Заказ закрыт")
    return order, mine


@router.post("/orders/{order_id}/ready")
async def mark_ready(order_id: int, store: StoreModel = Depends(current_store), db: AsyncSession = Depends(get_db)):
    """Seller packed their part of the order."""
    order, mine = await own_order_items(order_id, store, db)
    for item in mine:
        item.seller_ready = True
    # Self pickup: once every stall is packed the customer can come
    if order.fulfillment == "self" and all(i.seller_ready for i in order.items) and order.status in ("pending", "accepted"):
        order.status = "ready"
    await db.commit()
    notify_status(order.id)
    return {"success": True, "status": order.status}


@router.post("/orders/{order_id}/handed")
async def mark_handed(order_id: int, store: StoreModel = Depends(current_store), db: AsyncSession = Depends(get_db)):
    """Seller gave their part to the aravachi (or to the customer for self pickup)."""
    order, mine = await own_order_items(order_id, store, db)
    if order.fulfillment != "self" and not order.porter_phone:
        raise HTTPException(status_code=409, detail="Hali aravachi olmagan / Аравачи ещё не взял заказ")
    for item in mine:
        item.seller_ready = True
        item.seller_handed = True
    if order.fulfillment == "self" and all(i.seller_handed for i in order.items):
        order.status = "delivered"
    await db.commit()
    notify_status(order.id)
    return {"success": True, "status": order.status}


@router.get("/promos")
async def list_promos(store: StoreModel = Depends(current_store), db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(PromoModel).where(PromoModel.store_id == store.id).order_by(PromoModel.min_amount))
    return [promo_dict(p) for p in res.scalars().all()]


def promo_dict(p: PromoModel) -> dict:
    return {"id": p.id, "kind": p.kind, "min_amount": p.min_amount, "percent": p.percent, "amount": p.amount,
            "gift_text": p.gift_text, "gift_product_id": p.gift_product_id, "gift_qty": p.gift_qty, "is_active": p.is_active}


@router.post("/promos")
async def create_promo(data: PromoCreateSchema, store: StoreModel = Depends(current_store), db: AsyncSession = Depends(get_db)):
    if data.kind == "discount" and not data.percent:
        raise HTTPException(status_code=400, detail="Chegirma foizini kiriting / Укажите процент скидки")
    if data.kind == "delivery" and not data.amount:
        raise HTTPException(status_code=400, detail="Bonus summasini kiriting / Укажите сумму бонуса")
    gift_text = (data.gift_text or "").strip()
    if data.kind == "gift":
        if data.gift_product_id:
            gift_prod = await db.get(ProductModel, data.gift_product_id)
            if not gift_prod or gift_prod.store_id != store.id:
                raise HTTPException(status_code=404, detail="Mahsulot topilmadi / Товар не найден")
            gift_text = gift_prod.name_uz
        elif len(gift_text) < 2:
            raise HTTPException(status_code=400, detail="Sovg'a mahsulotini tanlang / Выберите товар-подарок")
    count = len((await db.execute(select(PromoModel.id).where(PromoModel.store_id == store.id))).all())
    if count >= 10:
        raise HTTPException(status_code=409, detail="Ko'pi bilan 10 ta aksiya / Не больше 10 акций")
    promo = PromoModel(
        store_id=store.id, kind=data.kind, min_amount=data.min_amount,
        percent=data.percent if data.kind == "discount" else None,
        amount=data.amount if data.kind == "delivery" else None,
        gift_text=gift_text if data.kind == "gift" else None,
        gift_product_id=data.gift_product_id if data.kind == "gift" else None,
        gift_qty=(data.gift_qty or 1) if data.kind == "gift" and data.gift_product_id else None,
    )
    db.add(promo)
    await db.commit()
    return promo_dict(promo)


@router.delete("/promos/{promo_id}")
async def delete_promo(promo_id: int, store: StoreModel = Depends(current_store), db: AsyncSession = Depends(get_db)):
    promo = await db.get(PromoModel, promo_id)
    if not promo or promo.store_id != store.id:
        raise HTTPException(status_code=404, detail="Aksiya topilmadi / Акция не найдена")
    await db.delete(promo)
    await db.commit()
    return {"success": True}


async def seller_item(item_id: int, store: StoreModel, db: AsyncSession):
    item = await db.get(OrderItemModel, item_id)
    if not item or item.store_id != store.id:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi / Товар не найден")
    order = (await db.execute(
        select(OrderModel).where(OrderModel.id == item.order_id).options(selectinload(OrderModel.items))
    )).scalars().first()
    return order, next(i for i in order.items if i.id == item_id)


@router.patch("/items/{item_id}/weight")
async def seller_weight(item_id: int, actual_quantity: float = Body(..., embed=True), store: StoreModel = Depends(current_store), db: AsyncSession = Depends(get_db)):
    """The seller weighed it: the price follows the scale."""
    order, item = await seller_item(item_id, store, db)
    set_weight(order, item, actual_quantity)
    await db.commit()
    notify_adjustment(order.id, item.id, "weight")
    return {"success": True, "total_price": item.total_price, "weight_status": item.weight_status}


@router.post("/items/{item_id}/missing")
async def seller_missing(item_id: int, missing: bool = Body(True, embed=True), store: StoreModel = Depends(current_store), db: AsyncSession = Depends(get_db)):
    """"Mahsulot tugadi": drop this line only, and hide the product until the seller has it again."""
    order, item = await seller_item(item_id, store, db)
    set_missing(order, item, missing)
    if missing:
        prod = await db.get(ProductModel, item.product_id)
        if prod:
            prod.is_available = False
    await db.commit()
    notify_adjustment(order.id, item.id, "missing" if missing else "back")
    if order.status == "cancelled":
        notify_status(order.id)
    return {"success": True, "order_status": order.status}



@router.post("/tg-login")
async def seller_tg_login(x_telegram_init_data: Optional[str] = Header(None), db: AsyncSession = Depends(get_db)):
    """Inside Telegram a stall's owner or helper opens the cabinet without a PIN."""
    tg_user = telegram_user(x_telegram_init_data)
    if not tg_user:
        raise HTTPException(status_code=401, detail="Telegram orqali oching / Откройте через Telegram")
    members = (await db.execute(
        select(StoreMemberModel).where(StoreMemberModel.tg_id == str(tg_user["id"])).order_by(StoreMemberModel.id.desc())
    )).scalars().all()
    for member in members:
        store = await db.get(StoreModel, member.store_id)
        if store and store.status == "approved":
            return {"success": True, "token": make_member_token(member, store), "store": StoreSchema.from_orm(store), "role": member.role}
    raise HTTPException(status_code=404, detail="Siz hech qaysi rastaga ulanmagansiz / Вы не привязаны к расте")


@router.post("/invite")
async def create_invite(store: StoreModel = Depends(current_owner_store), db: AsyncSession = Depends(get_db)):
    """QR code for a helper: a one-time t.me link that lives 15 minutes."""
    import secrets
    from datetime import datetime, timedelta
    from app.bot.bot import get_bot_username
    username = await get_bot_username()
    if not username:
        raise HTTPException(status_code=503, detail="Bot hozir ishlamayapti / Бот сейчас недоступен")
    invite = StoreInviteModel(token=secrets.token_urlsafe(12), store_id=store.id, expires_at=datetime.utcnow() + timedelta(minutes=15))
    db.add(invite)
    await db.commit()
    return {"link": f"https://t.me/{username}?start=join_{invite.token}", "expires_at": invite.expires_at.isoformat()}


@router.get("/members")
async def list_members(x_seller_token: Optional[str] = Header(None), db: AsyncSession = Depends(get_db)):
    store, me = await seller_identity(x_seller_token, db)
    members = (await db.execute(
        select(StoreMemberModel).where(StoreMemberModel.store_id == store.id).order_by(StoreMemberModel.id)
    )).scalars().all()
    return {
        "my_role": me.role if me else "owner",
        "members": [{"id": m.id, "name": m.name, "role": m.role, "is_me": bool(me and me.id == m.id)} for m in members],
    }


@router.delete("/members/{member_id}")
async def remove_member(member_id: int, store: StoreModel = Depends(current_owner_store), db: AsyncSession = Depends(get_db)):
    """The helper is signed out at once: their session is tied to this record."""
    member = await db.get(StoreMemberModel, member_id)
    if not member or member.store_id != store.id:
        raise HTTPException(status_code=404, detail="Topilmadi / Не найдено")
    if member.role == "owner":
        raise HTTPException(status_code=409, detail="Egani o'chirib bo'lmaydi / Владельца удалить нельзя")
    await db.delete(member)
    await db.commit()
    return {"success": True}
