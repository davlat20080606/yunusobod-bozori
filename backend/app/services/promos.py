"""Order price: items, stall offers (discount, free taxi, gift) and the carrying/taxi fees.

One order has one taxi, so a free taxi is given once even when several stalls offer it;
those stalls then share its cost equally (like Uzum/Ozon, where free delivery is per shipment
and never stacks, and the platform splits who pays for it).
"""
from typing import List
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.schemas import ProductModel, StoreModel, PromoModel
from app.services.config_store import get_setting


async def compute_quote(db: AsyncSession, items: List, fulfillment: str) -> dict:
    lines = []
    stores = {}
    subtotals = {}
    for item in items:
        prod = await db.get(ProductModel, item.product_id)
        if not prod:
            raise HTTPException(status_code=404, detail=f"Mahsulot ID {item.product_id} topilmadi")
        store = stores.get(prod.store_id) or await db.get(StoreModel, prod.store_id)
        if not prod.is_available:
            raise HTTPException(status_code=409, detail=f"«{prod.name_uz}» hozir yo'q / сейчас нет в наличии")
        if not store or not store.is_open or store.status != "approved":
            raise HTTPException(status_code=409, detail=f"«{store.name_uz if store else prod.name_uz}» rastasi yopiq / раста закрыта")
        stores[store.id] = store
        item_total = prod.price * item.quantity
        subtotals[store.id] = subtotals.get(store.id, 0.0) + item_total
        lines.append({
            "product_id": prod.id,
            "store_id": prod.store_id,
            "product_name": prod.name_uz,
            "price": prod.price,
            "quantity": item.quantity,
            "unit": prod.unit,
            "total_price": item_total,
        })

    promos = (await db.execute(
        select(PromoModel).where(PromoModel.store_id.in_(list(stores)), PromoModel.is_active.is_(True))
    )).scalars().all()

    bonuses, hints = [], []
    discount_total = 0.0
    taxi_sponsors = []
    for store_id, subtotal in subtotals.items():
        own = [p for p in promos if p.store_id == store_id]
        reached = [p for p in own if subtotal >= p.min_amount]
        # A stall gives its best discount and its biggest gift, never several of the same kind
        discounts = [p for p in reached if p.kind == "discount" and p.percent]
        if discounts:
            best = max(discounts, key=lambda p: p.percent)
            amount = round(subtotal * best.percent / 100)
            discount_total += amount
            bonuses.append({"store_id": store_id, "kind": "discount", "text": f"{best.percent:g}%", "amount": amount})
        gifts = [p for p in reached if p.kind == "gift" and p.gift_text]
        if gifts:
            best = max(gifts, key=lambda p: p.min_amount)
            bonuses.append({"store_id": store_id, "kind": "gift", "text": best.gift_text, "amount": 0.0})
        if any(p.kind == "free_taxi" for p in reached):
            taxi_sponsors.append(store_id)
        # The nearest offer not reached yet: "add 50 000 more for a free taxi"
        waiting = sorted((p for p in own if subtotal < p.min_amount), key=lambda p: p.min_amount)
        if waiting:
            p = waiting[0]
            hints.append({"store_id": store_id, "kind": p.kind, "need": round(p.min_amount - subtotal),
                          "text": f"{p.percent:g}%" if p.kind == "discount" else (p.gift_text or "")})

    porter_fee = float(await get_setting(db, "porter_fee")) if fulfillment in ("point", "courier") else 0.0
    taxi_fee = float(await get_setting(db, "taxi_fee")) if fulfillment == "courier" else 0.0
    taxi_free = fulfillment == "courier" and bool(taxi_sponsors)
    if taxi_free:
        share = round(taxi_fee / len(taxi_sponsors))
        for store_id in taxi_sponsors:
            bonuses.append({"store_id": store_id, "kind": "free_taxi",
                            "text": f"1/{len(taxi_sponsors)}" if len(taxi_sponsors) > 1 else "", "amount": share})
    # Others with a free taxi offer: once one stall pays, a second free taxi means nothing
    hints = [h for h in hints if not (h["kind"] == "free_taxi" and (taxi_free or fulfillment != "courier"))]

    for b in bonuses + hints:
        store = stores[b["store_id"]]
        b["store_name_uz"], b["store_name_ru"], b["stall_number"] = store.name_uz, store.name_ru, store.stall_number

    subtotal = sum(subtotals.values())
    delivery_fee = porter_fee + (0.0 if taxi_free else taxi_fee)
    return {
        "fulfillment": fulfillment,
        "subtotal": subtotal,
        "discount": discount_total,
        "porter_fee": porter_fee,
        "taxi_fee": taxi_fee,
        "taxi_free": taxi_free,
        # Offers that work only with a courier, so the checkout can say "choose a courier: the taxi is free"
        "taxi_offer": bool(taxi_sponsors) and fulfillment != "courier",
        "delivery_fee": delivery_fee,
        "total": subtotal - discount_total + delivery_fee,
        "bonuses": bonuses,
        "hints": hints,
        "lines": lines,
    }
