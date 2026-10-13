import re
import uuid
import mimetypes
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.api.tg_auth import telegram_user
from app.api.auth import (
    current_store, make_seller_token, normalize_phone,
    check_not_locked, record_failure, check_admin
)
from app.models.schemas import (
    StoreModel, ProductModel, OrderModel, OrderItemModel, CategoryModel,
    ProductSchema, StoreSchema, UpdatePriceSchema, ToggleAvailabilitySchema,
    SellerLoginSchema, StoreRegisterSchema, StoreUpdateSchema, ProductCreateSchema, OrderSchema,
    MediaModel
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

    # Signing in inside Telegram turns on new-order messages for this stall
    tg_user = telegram_user(x_telegram_init_data)
    if tg_user:
        store.telegram_chat_id = str(tg_user["id"])
        await db.commit()
        await db.refresh(store)

    return {
        "success": True,
        "token": make_seller_token(store),
        "store": StoreSchema.from_orm(store)
    }


@router.post("/register-store", dependencies=[Depends(check_admin)])
async def register_store(data: StoreRegisterSchema, db: AsyncSession = Depends(get_db)):
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
        avatar_url="https://images.unsplash.com/photo-1588168333986-5078d3ae3976?w=300&auto=format&fit=crop&q=80",
        banner_url="https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=800&auto=format&fit=crop&q=80",
        description_uz=data.description_uz or "Yangi saralangan mahsulotlar.",
        description_ru=data.description_ru or "Свежие отборные продукты напрямую с прилавка.",
        description_en="Fresh market produce directly from the stall.",
        is_open=True,
        rating=5.0,
        total_orders=0
    )
    db.add(new_store)
    await db.commit()
    await db.refresh(new_store)

    return {
        "success": True,
        "message": "Do'kon muvaffaqiyatli ro'yxatdan o'tdi! / Точка успешно зарегистрирована!",
        "store": StoreSchema.from_orm(new_store)
    }


@router.patch("/stores/me")
async def update_store_profile(data: StoreUpdateSchema, store: StoreModel = Depends(current_store), db: AsyncSession = Depends(get_db)):
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

    default_image = "https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80"

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
    db.add(MediaModel(filename=unique_name, content_type=content_type, data=data))
    await db.commit()

    return {
        "success": True,
        "url": f"/uploads/{unique_name}",
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
        select(OrderModel).where(OrderModel.id.in_(order_ids)).order_by(OrderModel.id.desc()).limit(100).options(selectinload(OrderModel.items))
    )

    response = []
    for o in orders_res.scalars().all():
        o_dict = OrderSchema.from_orm(o)
        o_dict.items = [item for item in o.items if item.store_id == store.id]
        response.append(o_dict)
    return response
