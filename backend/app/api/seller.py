from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload
from typing import List, Optional
from app.database import get_db
from app.models.schemas import (
    StoreModel, ProductModel, OrderModel, OrderItemModel, CategoryModel,
    ProductSchema, StoreSchema, UpdatePriceSchema, ToggleAvailabilitySchema,
    SellerLoginSchema, StoreRegisterSchema, StoreUpdateSchema, ProductCreateSchema, OrderSchema,
    MediaModel
)

router = APIRouter(prefix="/api/seller", tags=["seller"])

@router.patch("/stores/{store_id}")
async def update_store_profile(store_id: int, data: StoreUpdateSchema, db: AsyncSession = Depends(get_db)):
    store = await db.get(StoreModel, store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    if data.name_uz is not None:
        store.name_uz = data.name_uz
    if data.name_ru is not None:
        store.name_ru = data.name_ru
    if data.owner_name is not None:
        store.owner_name = data.owner_name
    if data.owner_phone is not None:
        store.owner_phone = data.owner_phone
    if data.stall_number is not None:
        store.stall_number = data.stall_number
    if data.pin is not None:
        store.seller_pin = data.pin
    if data.description_uz is not None:
        store.description_uz = data.description_uz
    if data.description_ru is not None:
        store.description_ru = data.description_ru

    await db.commit()
    await db.refresh(store)

    return {
        "success": True,
        "message": "Ma'lumotlar muvaffaqiyatli saqlandi! / Данные успешно обновлены!",
        "store": StoreSchema.from_orm(store)
    }

@router.post("/stores/{store_id}/products")
async def create_store_product(store_id: int, data: ProductCreateSchema, db: AsyncSession = Depends(get_db)):
    # Verify store exists
    store = await db.get(StoreModel, store_id)
    if not store:
        raise HTTPException(status_code=404, detail="Store not found")

    # Find category
    category_res = await db.execute(select(CategoryModel).where(CategoryModel.slug == data.category_slug))
    category = category_res.scalars().first()
    category_id = category.id if category else 1

    default_image = "https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80"
    default_video = "https://assets.mixkit.co/videos/preview/mixkit-slicing-a-ripe-red-tomato-41712-large.mp4"

    new_product = ProductModel(
        store_id=store_id,
        category_slug=data.category_slug,
        name_uz=data.name_uz,
        name_ru=data.name_ru or data.name_uz,
        name_en=data.name_uz,
        description_uz=data.description_uz or "Yangi saralangan mahsulot.",
        description_ru=data.description_ru or "Свежий отборный продукт напрямую с прилавка.",
        description_en="Fresh market produce directly from the stall.",
        price=data.price,
        unit=data.unit,
        min_weight=data.min_weight,
        step_weight=data.step_weight,
        image_url=data.image_url or default_image,
        video_url=data.video_url or default_video,
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

import os
import shutil
import uuid
import mimetypes
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Header, UploadFile, File

UPLOAD_DIR = Path(__file__).parent.parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

MAX_MEDIA_BYTES = 20 * 1024 * 1024

@router.post("/upload-media")
async def upload_seller_media(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    data = await file.read()
    if len(data) > MAX_MEDIA_BYTES:
        raise HTTPException(status_code=413, detail="Fayl juda katta (max 20 MB) / Файл слишком большой (макс. 20 МБ)")

    file_ext = Path(file.filename or "").suffix.lower() or ".jpg"
    unique_name = f"{uuid.uuid4().hex}{file_ext}"
    content_type = file.content_type or mimetypes.guess_type(unique_name)[0] or "application/octet-stream"
    db.add(MediaModel(filename=unique_name, content_type=content_type, data=data))
    await db.commit()

    return {
        "success": True,
        "url": f"/uploads/{unique_name}",
        "filename": unique_name
    }

@router.post("/login")
async def seller_login(data: SellerLoginSchema, db: AsyncSession = Depends(get_db)):
    query = select(StoreModel).where(
        (StoreModel.owner_phone == data.phone_or_slug) |
        (StoreModel.slug == data.phone_or_slug) |
        (StoreModel.stall_number.ilike(f"%{data.phone_or_slug}%"))
    )
    result = await db.execute(query)
    store = result.scalars().first()

    if not store or store.seller_pin != data.pin:
        raise HTTPException(status_code=401, detail="Noto'g'ri telefon/login yoki PIN-kod / Неверный логин или PIN")

    return {
        "success": True,
        "token": f"seller_token_{store.id}_{store.seller_pin}",
        "store": StoreSchema.from_orm(store)
    }

@router.post("/register-store")
async def register_store(data: StoreRegisterSchema, db: AsyncSession = Depends(get_db)):
    # Generate unique slug
    import re
    base_slug = re.sub(r'[^a-zA-Z0-9]+', '-', data.name_uz.lower()).strip('-')
    if not base_slug:
        base_slug = f"store-{int(datetime.utcnow().timestamp())}"
    slug = f"{base_slug}-{data.stall_number.replace(' ', '-').lower()}"

    new_store = StoreModel(
        slug=slug,
        name_uz=data.name_uz,
        name_ru=data.name_ru or data.name_uz,
        name_en=data.name_uz,
        stall_number=data.stall_number,
        owner_name=data.owner_name,
        owner_phone=data.owner_phone,
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

@router.get("/stores/list")
async def list_available_seller_stores(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(StoreModel))
    stores = result.scalars().all()
    return [{"id": s.id, "slug": s.slug, "name_uz": s.name_uz, "stall_number": s.stall_number, "pin": s.seller_pin, "owner_phone": s.owner_phone} for s in stores]

@router.get("/my-store/{store_id}")
async def get_my_store_dashboard(store_id: int, db: AsyncSession = Depends(get_db)):
    store_res = await db.execute(select(StoreModel).where(StoreModel.id == store_id))
    store = store_res.scalars().first()
    if not store:
        raise HTTPException(status_code=404, detail="Do'kon topilmadi")

    prod_res = await db.execute(select(ProductModel).where(ProductModel.store_id == store_id))
    products = prod_res.scalars().all()

    items_res = await db.execute(
        select(OrderItemModel).where(OrderItemModel.store_id == store_id).order_by(OrderItemModel.id.desc()).limit(30)
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
    db: AsyncSession = Depends(get_db)
):
    prod_res = await db.execute(select(ProductModel).where(ProductModel.id == product_id))
    prod = prod_res.scalars().first()
    if not prod:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi")

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
    db: AsyncSession = Depends(get_db)
):
    prod_res = await db.execute(select(ProductModel).where(ProductModel.id == product_id))
    prod = prod_res.scalars().first()
    if not prod:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi")

    prod.is_available = data.is_available
    await db.commit()
    await db.refresh(prod)

    return {
        "success": True,
        "is_available": prod.is_available,
        "message": "Holat yangilandi / Статус обновлен"
    }

@router.patch("/stores/{store_id}/toggle-status")
async def toggle_store_open_status(store_id: int, db: AsyncSession = Depends(get_db)):
    store_res = await db.execute(select(StoreModel).where(StoreModel.id == store_id))
    store = store_res.scalars().first()
    if not store:
        raise HTTPException(status_code=404, detail="Do'kon topilmadi")

    store.is_open = not store.is_open
    await db.commit()
    await db.refresh(store)

    return {
        "success": True,
        "is_open": store.is_open,
        "message": "Do'kon holati yangilandi"
    }

@router.get("/orders/{store_id}")
async def get_store_orders(store_id: int, db: AsyncSession = Depends(get_db)):
    items_res = await db.execute(
        select(OrderItemModel).where(OrderItemModel.store_id == store_id).order_by(OrderItemModel.id.desc())
    )
    items = items_res.scalars().all()

    order_ids = list(set([item.order_id for item in items]))
    if not order_ids:
        return []

    orders_res = await db.execute(
        select(OrderModel).where(OrderModel.id.in_(order_ids)).order_by(OrderModel.id.desc()).options(selectinload(OrderModel.items))
    )
    orders = orders_res.scalars().all()

    response = []
    for o in orders:
        o_dict = OrderSchema.from_orm(o)
        o_dict.items = [item for item in o.items if item.store_id == store_id]
        response.append(o_dict)

    return response
