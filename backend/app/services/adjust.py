"""Real scale weights and stalls that ran out: change one line, keep the rest of the order going.

Payment is cash on delivery, so the customer simply pays the new total. The scale weight must be
within ±5% of the order (a butcher cannot cut exactly 1.000 kg). Anything further off is refused
and the seller trims or adds on the spot: asking the customer would hold the order up while they
are not looking at their phone. Stall bonuses stay as given at checkout.
"""
from fastapi import HTTPException
from app.models.schemas import OrderModel, OrderItemModel
from app.services.order_log import log_event

WEIGHT_TOLERANCE = 0.05
OPEN_STATUSES = ("pending", "accepted", "picking", "ready", "at_point", "handed_over")


def line_total(item: OrderItemModel) -> float:
    if item.item_status == "missing":
        return 0.0
    if item.actual_quantity is not None and item.weight_status in (None, "approved"):
        return round(item.price * item.actual_quantity)
    return round(item.price * item.quantity)


def recalc(order: OrderModel):
    for item in order.items:
        item.total_price = line_total(item)
    subtotal = sum(i.total_price for i in order.items)
    discount = min(order.discount_amount or 0.0, subtotal)
    order.total_amount = subtotal - discount + (order.delivery_fee or 0.0)
    # Nothing left to bring: close the order instead of sending a porter for an empty bag
    if all(i.item_status == "missing" for i in order.items if i.price > 0):
        order.status = "cancelled"


def check_open(order: OrderModel):
    if order.status not in OPEN_STATUSES:
        raise HTTPException(status_code=409, detail="Buyurtma yopilgan / Заказ уже закрыт")


def weight_range(quantity: float):
    return round(quantity * (1 - WEIGHT_TOLERANCE), 3), round(quantity * (1 + WEIGHT_TOLERANCE), 3)


def set_weight(order: OrderModel, item: OrderItemModel, actual: float, photo_url: str = None):
    check_open(order)
    if item.item_status == "missing":
        raise HTTPException(status_code=409, detail="Bu mahsulot «yo'q» deb belgilangan / Товар отмечен как отсутствующий")
    if item.price == 0:
        raise HTTPException(status_code=409, detail="Sovg'a vazni o'zgarmaydi / Вес подарка не меняется")
    low, high = weight_range(item.quantity)
    if not low <= round(actual, 3) <= high:
        raise HTTPException(status_code=400, detail=(
            f"Vazn {low:g}–{high:g} oralig'ida bo'lsin (±5%). Kesib yoki qo'shib to'g'rilang / "
            f"Вес должен быть {low:g}–{high:g} (±5%). Отрежьте или довесьте"))
    item.actual_quantity = round(actual, 3)
    item.weight_photo_url = photo_url or item.weight_photo_url
    item.weight_status = None
    log_event(order, "weight", item_id=item.id, ordered=item.quantity, actual=item.actual_quantity)
    recalc(order)


def set_missing(order: OrderModel, item: OrderItemModel, missing: bool):
    check_open(order)
    item.item_status = "missing" if missing else "ok"
    log_event(order, "missing" if missing else "missing_undone", item_id=item.id)
    if not missing:
        item.is_picked = item.seller_ready = item.seller_handed = False
    if missing:
        # Nothing to carry: counts as done for the aravachi and the seller
        item.is_picked = True
        item.seller_ready = True
        item.seller_handed = True
    recalc(order)


def check_code(order: OrderModel, code):
    """Only the customer knows the code, so the order cannot be marked delivered to the wrong person."""
    if order.handoff_code and (code or "").strip() != order.handoff_code:
        raise HTTPException(status_code=403, detail="Kod noto'g'ri. Xaridordan 4 xonali kodni so'rang / Неверный код. Спросите у покупателя 4-значный код")
