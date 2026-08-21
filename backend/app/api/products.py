from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import List, Optional
from app.database import get_db
from app.models.schemas import ProductModel, ProductSchema

router = APIRouter(prefix="/api/products", tags=["products"])

@router.get("", response_model=List[ProductSchema])
async def get_products(
    category: Optional[str] = None,
    store_id: Optional[int] = None,
    search: Optional[str] = None,
    featured_only: bool = False,
    db: AsyncSession = Depends(get_db)
):
    query = select(ProductModel).where(ProductModel.is_available == True)

    if category:
        query = query.where(ProductModel.category_slug == category)
    if store_id:
        query = query.where(ProductModel.store_id == store_id)
    if featured_only:
        query = query.where(ProductModel.is_featured == True)
    if search:
        search_pattern = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                ProductModel.name_uz.ilike(search_pattern),
                ProductModel.name_ru.ilike(search_pattern),
                ProductModel.name_en.ilike(search_pattern),
                ProductModel.description_uz.ilike(search_pattern),
                ProductModel.description_ru.ilike(search_pattern),
            )
        )

    result = await db.execute(query)
    return result.scalars().all()

@router.get("/{product_id}", response_model=ProductSchema)
async def get_product(product_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ProductModel).where(ProductModel.id == product_id))
    prod = result.scalars().first()
    if not prod:
        raise HTTPException(status_code=404, detail="Mahsulot topilmadi / Товар не найден")
    return prod
