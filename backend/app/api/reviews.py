"""Real customer reviews: only delivered orders can be rated, once each."""
from typing import Dict, Tuple
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.schemas import ReviewModel, OrderModel, OrderItemModel, StoreModel, ReviewCreateSchema

router = APIRouter(prefix="/api/reviews", tags=["reviews"])


def short_name(full_name: str) -> str:
    """Show 'Aziza K.' instead of the full name for privacy."""
    parts = (full_name or "").split()
    if not parts:
        return "Xaridor"
    return parts[0] if len(parts) == 1 else f"{parts[0]} {parts[1][0]}."


async def store_ratings(db: AsyncSession) -> Dict[int, Tuple[float, int]]:
    """Average rating and number of reviews per stall."""
    rows = (await db.execute(
        select(OrderItemModel.store_id, ReviewModel.id, ReviewModel.rating)
        .join(ReviewModel, ReviewModel.order_id == OrderItemModel.order_id)
    )).all()
    per_store: Dict[int, Dict[int, int]] = {}
    for store_id, review_id, rating in rows:
        per_store.setdefault(store_id, {})[review_id] = rating
    return {sid: (round(sum(r.values()) / len(r), 1), len(r)) for sid, r in per_store.items()}


def apply_rating(store_schema, ratings):
    avg, count = ratings.get(store_schema.id, (0.0, 0))
    store_schema.rating = avg
    store_schema.reviews_count = count
    return store_schema


@router.get("")
async def list_reviews(limit: int = 10, db: AsyncSession = Depends(get_db)):
    reviews = (await db.execute(select(ReviewModel).order_by(ReviewModel.id.desc()))).scalars().all()
    distribution = {str(i): 0 for i in range(1, 6)}
    for r in reviews:
        distribution[str(r.rating)] += 1

    latest = reviews[:max(1, min(limit, 30))]
    stalls = {}
    if latest:
        rows = (await db.execute(
            select(OrderItemModel.order_id, StoreModel.stall_number)
            .join(StoreModel, StoreModel.id == OrderItemModel.store_id)
            .where(OrderItemModel.order_id.in_([r.order_id for r in latest]))
        )).all()
        for order_id, stall in rows:
            stalls.setdefault(order_id, [])
            if stall not in stalls[order_id]:
                stalls[order_id].append(stall)

    return {
        "average": round(sum(r.rating for r in reviews) / len(reviews), 1) if reviews else 0,
        "count": len(reviews),
        "distribution": distribution,
        "latest": [
            {
                "name": r.customer_name,
                "rating": r.rating,
                "comment": r.comment,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "stalls": stalls.get(r.order_id, []),
            }
            for r in latest
        ],
    }


@router.post("/{order_number}")
async def create_review(order_number: str, data: ReviewCreateSchema, db: AsyncSession = Depends(get_db)):
    order = (await db.execute(
        select(OrderModel).where(OrderModel.order_number == order_number.replace("#", "").strip().upper())
    )).scalars().first()
    if not order:
        raise HTTPException(status_code=404, detail="Buyurtma topilmadi / Заказ не найден")
    if order.status != "delivered":
        raise HTTPException(status_code=409, detail="Baho faqat yetkazilgan buyurtmaga qo'yiladi / Оценить можно только доставленный заказ")
    if (await db.execute(select(ReviewModel).where(ReviewModel.order_id == order.id))).scalars().first():
        raise HTTPException(status_code=409, detail="Siz bu buyurtmaga baho bergansiz / Вы уже оценили этот заказ")

    db.add(ReviewModel(
        order_id=order.id,
        rating=data.rating,
        comment=(data.comment or "").strip() or None,
        customer_name=short_name(order.customer_name),
    ))
    await db.commit()
    return {"success": True, "rating": data.rating}
