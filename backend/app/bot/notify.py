"""Telegram messages about orders: customer status updates, new-order alerts for porters and sellers."""
import asyncio
import re
import logging
from datetime import datetime, timedelta
from html import escape

from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import async_session_factory
from app.models.schemas import OrderModel, StoreModel, StaffModel, CustomerModel
from app.services.config_store import HANDOFF_POINTS
from app.bot.bot import get_bot

logger = logging.getLogger(__name__)

# Customer messages in the language they picked in the bot: (title, subtitle)
CUSTOMER_TEXTS = {
    "uz": {
        "pending": ("🧾 <b>Buyurtma qabul qilindi</b>", "Bo'sh aravachini qidiryapmiz"),
        "pending_self": ("🧾 <b>Buyurtma qabul qilindi</b>", "Sotuvchilar tayyorlamoqda"),
        "picking": ("🛒 <b>Bozorda yig'ilmoqda</b>", "{porter} rastalarni aylanmoqda"),
        "ready": ("🛍 <b>Buyurtma tayyor</b>", "Rastalarga kelib oling: {stalls}"),
        "at_point": ("📍 <b>Aravachi sizni kutmoqda</b>", "{point} · {porter}"),
        "handed_over": ("🤝 <b>Taksichiga topshirildi</b>", "{taxi}"),
        "handed_over_wait": ("🤝 <b>Taksichiga topshirildi</b>", "Taksichi tez orada oladi"),
        "on_the_way": ("🚗 <b>Kuryer yo'lda</b>", "Buyurtmangizni olib kelmoqda"),
        "delivered": ("🎉 <b>Yetkazildi!</b>", "Yoqimli ishtaha! Rahmat"),
        "delivered_confirm": ("🎉 <b>Yetkazildi!</b>", "Olganingizni tasdiqlang va baholang"),
        "cancelled": ("✖️ <b>Buyurtma bekor qilindi</b>", ""),
        "button": "📦 Buyurtma",
    },
    "ru": {
        "pending": ("🧾 <b>Заказ принят</b>", "Ищем свободного аравачи"),
        "pending_self": ("🧾 <b>Заказ принят</b>", "Продавцы собирают заказ"),
        "picking": ("🛒 <b>Собираем на базаре</b>", "{porter} обходит расты"),
        "ready": ("🛍 <b>Заказ готов</b>", "Заберите на растах: {stalls}"),
        "at_point": ("📍 <b>Аравачи ждёт вас</b>", "{point} · {porter}"),
        "handed_over": ("🤝 <b>Передан таксисту</b>", "{taxi}"),
        "handed_over_wait": ("🤝 <b>Передан таксисту</b>", "Таксист скоро заберёт"),
        "on_the_way": ("🚗 <b>Курьер в пути</b>", "Везём заказ к вам"),
        "delivered": ("🎉 <b>Заказ доставлен!</b>", "Приятного аппетита! Спасибо"),
        "delivered_confirm": ("🎉 <b>Заказ доставлен!</b>", "Подтвердите получение и оцените"),
        "cancelled": ("✖️ <b>Заказ отменён</b>", ""),
        "button": "📦 Заказ",
    },
    "en": {
        "pending": ("🧾 <b>Order received</b>", "Looking for a free porter"),
        "pending_self": ("🧾 <b>Order received</b>", "The sellers are packing it"),
        "picking": ("🛒 <b>Collecting at the bazaar</b>", "{porter} is visiting the stalls"),
        "ready": ("🛍 <b>Your order is ready</b>", "Collect it at: {stalls}"),
        "at_point": ("📍 <b>The porter is waiting</b>", "{point} · {porter}"),
        "handed_over": ("🤝 <b>Handed to the taxi</b>", "{taxi}"),
        "handed_over_wait": ("🤝 <b>Handed to the taxi</b>", "The taxi will pick it up soon"),
        "on_the_way": ("🚗 <b>Courier on the way</b>", "Bringing your order to you"),
        "delivered": ("🎉 <b>Delivered!</b>", "Enjoy your meal! Thank you"),
        "delivered_confirm": ("🎉 <b>Delivered!</b>", "Confirm you got it and rate it"),
        "cancelled": ("✖️ <b>Order cancelled</b>", ""),
        "button": "📦 Order",
    },
}
STALL_WORDS = {"ru": ("Раста", "место"), "en": ("Row", "Stall")}


def stall_in(lang: str, stall: str) -> str:
    """"Rasta 14, Joy №2" in the customer's language."""
    words = STALL_WORDS.get(lang)
    if not words:
        return stall
    return re.sub(r"\bJoy\b", words[1], re.sub(r"\bRasta\b", words[0], stall))


def point_name(point_id, lang: str = None) -> str:
    """One language for a customer, "uz / ru" for bazaar workers."""
    point = next((p for p in HANDOFF_POINTS if p["id"] == point_id), None)
    if not point:
        return ""
    return point.get(f"name_{lang}") or point["name_uz"] if lang else f"{point['name_uz']} / {point['name_ru']}"


def _webapp_button(text: str, query: str) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text=text, web_app=WebAppInfo(url=f"{settings.WEBAPP_URL}?{query}"))
    ]])


async def _send(chat_id, text: str, keyboard=None):
    bot = get_bot()
    if not bot or not chat_id or not settings.WEBAPP_URL.startswith("https://"):
        return
    try:
        await bot.send_message(chat_id=int(chat_id), text=text, parse_mode="HTML", reply_markup=keyboard)
    except Exception as e:
        # Person blocked the bot or never opened it: nothing to do
        logger.info(f"Notify {chat_id} skipped: {e}")


async def _customer_status(order_id: int):
    async with async_session_factory() as db:
        order = (await db.execute(
            select(OrderModel).where(OrderModel.id == order_id).options(selectinload(OrderModel.items))
        )).scalars().first()
        if not order or not order.customer_tg_id:
            return
        stall_rows = (await db.execute(
            select(StoreModel.stall_number).where(StoreModel.id.in_({i.store_id for i in order.items}))
        )).scalars().all()
        customer = (await db.execute(select(CustomerModel).where(CustomerModel.tg_id == order.customer_tg_id))).scalars().first()
        lang = customer.lang if customer and customer.lang in CUSTOMER_TEXTS else "uz"
        texts = CUSTOMER_TEXTS[lang]
        key = order.status
        if key == "pending" and order.fulfillment == "self":
            key = "pending_self"
        if key == "handed_over" and not order.taxi_name:
            key = "handed_over_wait"
        if key == "delivered" and not order.customer_confirmed_at:
            key = "delivered_confirm"
        if key not in texts:
            return
        title, sub = texts[key]
        if order.status == "on_the_way" and order.taxi_name:
            sub = f"🚕 {escape(order.taxi_name)}"
        stalls = escape(", ".join(stall_in(lang, s) for s in stall_rows))
        point = escape(point_name(order.handoff_point, lang))
        porter = escape(order.porter_name or {"ru": "Аравачи", "en": "Porter"}.get(lang, "Aravachi"))
        sub = sub.format(porter=porter, taxi=escape(order.taxi_name or ""), stalls=stalls, point=point)
        text = f"{title}\n#{order.order_number}" + (f"\n{sub}" if sub else "")
        await _send(order.customer_tg_id, text, _webapp_button(texts["button"], f"tab=orders&order={order.order_number}&lang={lang}"))


async def _new_order(order_id: int):
    async with async_session_factory() as db:
        order = (await db.execute(
            select(OrderModel).where(OrderModel.id == order_id).options(selectinload(OrderModel.items), selectinload(OrderModel.bonuses))
        )).scalars().first()
        if not order:
            return
        stores = {}
        for item in order.items:
            stores.setdefault(item.store_id, []).append(item)
        store_rows = (await db.execute(select(StoreModel).where(StoreModel.id.in_(list(stores))))).scalars().all()
        porters = (await db.execute(
            select(StaffModel).where(StaffModel.role == "porter", StaffModel.status == "approved", StaffModel.tg_id.isnot(None))
        )).scalars().all()

    stalls = ", ".join(escape(s.stall_number) for s in store_rows)
    gifts = {}
    for b in order.bonuses:
        if b.kind == "gift":
            gifts.setdefault(b.store_id, []).append(b.text)
    self_pickup = order.fulfillment == "self"
    where = point_name(order.handoff_point) if order.fulfillment == "point" else f"{order.delivery_district or ''}, {order.delivery_address}"
    porter_text = (
        f"🔔 <b>Yangi buyurtma · Новый заказ</b> #{order.order_number}\n"
        f"🏪 {stalls}\n"
        f"📦 {len(order.items)} · 💰 {order.total_amount:,.0f} UZS\n"
        f"📍 {escape(where)}"
    )
    keyboard = _webapp_button("🛒 Olish / Взять заказ", "tab=porter")
    if not self_pickup:
        await asyncio.gather(*[_send(p.tg_id, porter_text, keyboard) for p in porters])

    for store in store_rows:
        if not store.telegram_chat_id:
            continue
        # "to'plam (сет)" -> "to'plam": the part in brackets is a leftover Russian word
        lines = "\n".join(f"• {escape(i.product_name)} — {i.quantity:g} {escape(re.sub(r'\s*\(.*?\)', '', i.unit or ''))}" for i in stores[store.id])
        lines += "".join(f"\n🎁 {escape(g)}" for g in gifts.get(store.id, []))
        who = ("🙋 Xaridor o'zi keladi — tayyorlab qo'ying / Покупатель придёт сам — подготовьте товар" if self_pickup
               else "📦 Aravachi keladi — tayyorlab qo'ying / Аравачи скоро придёт — подготовьте товар")
        seller_text = (
            f"🔔 <b>Yangi buyurtma · Новый заказ</b> #{order.order_number}\n"
            f"🏪 {escape(store.stall_number)}\n\n{lines}\n\n{who}"
        )
        await _send(store.telegram_chat_id, seller_text, _webapp_button("🏪 Kabinet / Кабинет", "tab=seller_cabinet"))


async def _taxis(order_id: int):
    async with async_session_factory() as db:
        order = await db.get(OrderModel, order_id)
        taxis = (await db.execute(
            select(StaffModel).where(StaffModel.role == "taxi", StaffModel.status == "approved", StaffModel.tg_id.isnot(None))
        )).scalars().all()
    if not order:
        return
    text = (
        f"🚕 <b>Buyurtma tayyor · Заказ готов</b> #{order.order_number}\n"
        f"🛒 {escape(order.porter_name or '')} — {escape(point_name(order.handoff_point) or 'bozor darvozasi / ворота базара')}\n"
        f"📍 {escape(order.delivery_district or '')}, {escape(order.delivery_address)}"
    )
    keyboard = _webapp_button("🚕 Olish / Взять заказ", "tab=taxi")
    await asyncio.gather(*[_send(t.tg_id, text, keyboard) for t in taxis])


async def _admin(text: str):
    from app.services.config_store import get_setting
    async with async_session_factory() as db:
        admin_tg = await get_setting(db, "admin_tg_id")
    if admin_tg:
        await _send(admin_tg, f"📝 <b>Yangi ariza · Новая заявка</b>\n{escape(text)}", _webapp_button("🏛 Bozorkom", "tab=admin"))


async def _store_decision(store_id: int):
    async with async_session_factory() as db:
        store = await db.get(StoreModel, store_id)
    if not store or not store.telegram_chat_id:
        return
    text = {
        "approved": "✅ Rastangiz tasdiqlandi! Endi xaridorlar uni ko'radi. / Ваша раста одобрена!",
        "rejected": "❌ Arizangiz rad etildi. Bozorkomga murojaat qiling. / Заявка отклонена.",
        "blocked": "⛔ Rastangiz vaqtincha yopildi. Bozorkomga murojaat qiling. / Раста заблокирована.",
    }.get(store.status)
    if text:
        await _send(store.telegram_chat_id, text)


async def _staff_decision(staff_id: int):
    async with async_session_factory() as db:
        staff = await db.get(StaffModel, staff_id)
    if not staff or not staff.tg_id:
        return
    text = {
        "approved": "✅ Hisobingiz tasdiqlandi! Endi kabinetga kira olasiz. / Аккаунт одобрен!",
        "rejected": "❌ Arizangiz rad etildi. / Заявка отклонена.",
        "blocked": "⛔ Hisobingiz bloklandi. / Аккаунт заблокирован.",
    }.get(staff.status)
    if text:
        await _send(staff.tg_id, text)


def _background(coro):
    try:
        asyncio.get_running_loop().create_task(coro)
    except RuntimeError:
        pass


def notify_status(order_id: int):
    _background(_customer_status(order_id))


def notify_new_order(order_id: int):
    _background(_new_order(order_id))
    _background(_customer_status(order_id))


def notify_taxis(order_id: int):
    _background(_taxis(order_id))


def notify_admin_application(text: str):
    _background(_admin(text))


def notify_store_decision(store_id: int):
    _background(_store_decision(store_id))


def notify_staff_decision(staff_id: int):
    _background(_staff_decision(staff_id))
