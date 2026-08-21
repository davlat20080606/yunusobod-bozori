from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db
from app.models.schemas import StoreModel, ProductModel, OrderModel

router = APIRouter(prefix="/api/stats", tags=["stats"])

@router.get("/summary")
async def get_market_summary(db: AsyncSession = Depends(get_db)):
    stores_count = (await db.execute(select(func.count(StoreModel.id)))).scalar() or 0
    products_count = (await db.execute(select(func.count(ProductModel.id)))).scalar() or 0
    orders_count = (await db.execute(select(func.count(OrderModel.id)))).scalar() or 0
    
    total_revenue_res = await db.execute(select(func.sum(OrderModel.total_amount)))
    total_revenue = total_revenue_res.scalar() or 0.0

    return {
        "bazaar_name": "Yunusobod Dehqon Bozori",
        "active_stores": stores_count,
        "total_products": products_count,
        "total_orders": orders_count,
        "total_gmv_uzs": total_revenue,
        "market_status": "Ochiq / Работает (06:00 - 20:00)"
    }
