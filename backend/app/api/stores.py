from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from typing import List, Optional
from app.database import get_db
from app.models.schemas import StoreModel, ProductModel, StoreSchema, StoreWithProductsSchema, CategoryModel, CategorySchema

router = APIRouter(prefix="/api/stores", tags=["stores"])

@router.get("", response_model=List[StoreSchema])
async def get_stores(category: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    query = select(StoreModel)
    if category:
        query = query.where(StoreModel.category_slug == category)
    
    result = await db.execute(query)
    stores = result.scalars().all()

    # Count products per store
    response = []
    for s in stores:
        count_res = await db.execute(
            select(func.count(ProductModel.id)).where(ProductModel.store_id == s.id, ProductModel.is_available == True)
        )
        prod_count = count_res.scalar() or 0
        s_dict = StoreSchema.from_orm(s)
        s_dict.products_count = prod_count
        response.append(s_dict)
    
    return response

@router.get("/categories", response_model=List[CategorySchema])
async def get_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(CategoryModel))
    return result.scalars().all()

@router.get("/{slug}", response_model=StoreWithProductsSchema)
async def get_store_by_slug(slug: str, db: AsyncSession = Depends(get_db)):
    query = select(StoreModel).where(StoreModel.slug == slug)
    result = await db.execute(query)
    store = result.scalars().first()
    if not store:
        raise HTTPException(status_code=404, detail="Do'kon topilmadi / Магазин не найден")
    
    prod_query = select(ProductModel).where(ProductModel.store_id == store.id)
    prod_result = await db.execute(prod_query)
    products = prod_result.scalars().all()

    store_data = StoreWithProductsSchema.from_orm(store)
    store_data.products = products
    store_data.products_count = len(products)
    return store_data
