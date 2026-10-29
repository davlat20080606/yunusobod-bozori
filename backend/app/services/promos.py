"""Order price: items, stall offers and the carrying/taxi fees.

Delivery bonuses from several stalls never go to waste (the cascade agreed with the bazaar):
  1st stall's bonus pays the taxi (leg 2),
  the next one pays the aravachi (leg 1) and any rest becomes a product discount,
  every further bonus is a product discount.
With self pickup there are no fees, so the bonus is a product discount right away.
Each stall gives exactly its bonus value, whatever it ends up paying for.
"""
from typing import List
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.schemas import ProductModel, StoreModel, PromoModel
from app.services.config_store import get_setting


# Units as stored on products, shown in the customer's language
UNITS = {
    "ru": {"kg": "кг", "dona": "шт.", "bog'lam": "пучок", "to'plam (сет)": "набор", "to'plam": "набор", "litr": "л"},
    "en": {"kg": "kg", "dona": "pcs", "bog'lam": "bunch", "to'plam (сет)": "set", "to'plam": "set", "litr": "l"},
}


def unit_in(lang: str, unit: str) -> str:
    return UNITS.get(lang, {}).get(unit or "", unit or "")


def delivery_value(promo: PromoModel, taxi_fee: float) -> float:
    # "free_taxi" offers made before delivery bonuses had a value are worth one taxi ride
    return float(promo.amount or (taxi_fee if promo.kind == "free_taxi" else 0))


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

    porter_fee = float(await get_setting(db, "porter_fee")) if fulfillment in ("point", "courier") else 0.0
    taxi_fee = float(await get_setting(db, "taxi_fee")) if fulfillment == "courier" else 0.0

    bonuses, hints = [], []
    percent_discount = 0.0
    delivery_bonuses = []  # (store_id, value)
    for store_id, subtotal in subtotals.items():
        own = [p for p in promos if p.store_id == store_id]
        reached = [p for p in own if subtotal >= p.min_amount]
        # A stall gives its best offer of each kind, never two of the same kind
        discounts = [p for p in reached if p.kind == "discount" and p.percent]
        if discounts:
            best = max(discounts, key=lambda p: p.percent)
            amount = round(subtotal * best.percent / 100)
            percent_discount += amount
            bonuses.append({"store_id": store_id, "kind": "discount", "text": f"{best.percent:g}%", "amount": amount})
        gifts = [p for p in reached if p.kind == "gift"]
        if gifts:
            best = max(gifts, key=lambda p: p.min_amount)
            gift_prod = await db.get(ProductModel, best.gift_product_id) if best.gift_product_id else None
            if gift_prod and gift_prod.store_id == store_id and gift_prod.is_available:
                qty = best.gift_qty or 1
                # The gift travels as a 0 so'm line, so the seller hands it over and the aravachi ticks it like any item
                lines.append({
                    "product_id": gift_prod.id, "store_id": store_id, "product_name": f"🎁 {gift_prod.name_uz}",
                    "price": 0.0, "quantity": qty, "unit": gift_prod.unit, "total_price": 0.0,
                })
                bonuses.append({
                    "store_id": store_id, "kind": "gift", "amount": 0.0,
                    "text": f"{gift_prod.name_uz} · {qty:g} {gift_prod.unit}",
                    "text_ru": f"{gift_prod.name_ru or gift_prod.name_uz} · {qty:g} {unit_in('ru', gift_prod.unit)}",
                    "text_en": f"{gift_prod.name_en or gift_prod.name_uz} · {qty:g} {unit_in('en', gift_prod.unit)}",
                })
            elif best.gift_text:
                bonuses.append({"store_id": store_id, "kind": "gift", "text": best.gift_text, "amount": 0.0})
        deliveries = [p for p in reached if p.kind in ("delivery", "free_taxi")]
        if deliveries:
            delivery_bonuses.append((store_id, max(delivery_value(p, taxi_fee) for p in deliveries)))
        # The nearest offer not reached yet: "add 50 000 more for a delivery bonus"
        waiting = sorted((p for p in own if subtotal < p.min_amount), key=lambda p: p.min_amount)
        if waiting:
            p = waiting[0]
            text = f"{p.percent:g}%" if p.kind == "discount" else (
                f"{delivery_value(p, taxi_fee):,.0f}" if p.kind in ("delivery", "free_taxi") else (p.gift_text or ""))
            if p.kind == "gift" and p.gift_product_id:
                gift_prod = await db.get(ProductModel, p.gift_product_id)
                text = gift_prod.name_uz if gift_prod else text
            hints.append({"store_id": store_id, "kind": "delivery" if p.kind == "free_taxi" else p.kind,
                          "need": round(p.min_amount - subtotal), "text": text})

    # Cascade: taxi first, then the aravachi, the rest is a discount. Biggest purchase pays first.
    taxi_left, porter_left = taxi_fee, porter_fee
    delivery_discount = 0.0
    for store_id, value in sorted(delivery_bonuses, key=lambda b: (-subtotals[b[0]], b[0])):
        left = value
        for kind, fee_left in (("covers_taxi", taxi_left), ("covers_porter", porter_left)):
            used = min(left, fee_left)
            if used > 0:
                bonuses.append({"store_id": store_id, "kind": kind, "text": "", "amount": used})
                left -= used
                if kind == "covers_taxi":
                    taxi_left -= used
                else:
                    porter_left -= used
        if left > 0:
            bonuses.append({"store_id": store_id, "kind": "delivery_discount", "text": "", "amount": left})
            delivery_discount += left

    for b in bonuses + hints:
        store = stores[b["store_id"]]
        b["store_name_uz"], b["store_name_ru"], b["stall_number"] = store.name_uz, store.name_ru, store.stall_number

    subtotal = sum(subtotals.values())
    discount_total = min(subtotal, percent_discount + delivery_discount)
    delivery_fee = taxi_left + porter_left
    return {
        "fulfillment": fulfillment,
        "subtotal": subtotal,
        "discount": discount_total,
        "porter_fee": porter_fee,
        "taxi_fee": taxi_fee,
        "taxi_free": fulfillment == "courier" and taxi_left == 0,
        "delivery_fee": delivery_fee,
        "total": subtotal - discount_total + delivery_fee,
        "bonuses": bonuses,
        "hints": hints,
        "lines": lines,
    }
