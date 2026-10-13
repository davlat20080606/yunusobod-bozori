"""Telegram messages about orders: customer status updates, new-order alerts for porters and sellers."""
import asyncio
import logging
from datetime import datetime, timedelta
from html import escape

from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.config import settings
from app.database import async_session_factory
from app.models.schemas import OrderModel, StoreModel, PorterModel
from app.bot.bot import get_bot

logger = logging.getLogger(__name__)

CUSTOMER_TEXTS = {
    "pending": ("🧾 <b>Buyurtma qabul qilindi</b>", "🧾 <b>Заказ принят</b>", "Bo'sh aravachini qidiryapmiz", "Ищем свободного аравачи"),
    "picking": ("🛒 <b>Bozorda yig'ilmoqda</b>", "🛒 <b>Собираем на базаре</b>", "{porter} rastalarni aylanmoqda", "{porter} обходит расты"),
    "handed_over": ("🤝 <b>Kuryerga topshirildi</b>", "🤝 <b>Передан курьеру</b>", "Kuryer tez orada yo'lga chiqadi", "Курьер скоро выедет"),
    "on_the_way": ("🚗 <b>Kuryer yo'lda</b>", "🚗 <b>Курьер в пути</b>", "Buyurtmangizni olib kelmoqda", "Везём заказ к вам"),
    "delivered": ("🎉 <b>Yetkazildi!</b>", "🎉 <b>Заказ доставлен!</b>", "Yoqimli ishtaha! Rahmat", "Приятного аппетита! Спасибо"),
    "cancelled": ("✖️ <b>Buyurtma bekor qilindi</b>", "✖️ <b>Заказ отменён</b>", "", ""),
}


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
        order = await db.get(OrderModel, order_id)
        if not order or not order.customer_tg_id:
            return
        texts = CUSTOMER_TEXTS.get(order.status)
        if not texts:
            return
        title_uz, title_ru, sub_uz, sub_ru = texts
        porter = escape(order.porter_name or "Aravachi")
        sub = " / ".join(x.format(porter=porter) for x in (sub_uz, sub_ru) if x)
        text = f"{title_uz} · {title_ru.replace('<b>', '').replace('</b>', '')}\n#{order.order_number}" + (f"\n{sub}" if sub else "")
        await _send(order.customer_tg_id, text, _webapp_button("📦 Buyurtma / Заказ", f"tab=orders&order={order.order_number}"))


async def _new_order(order_id: int):
    async with async_session_factory() as db:
        order = (await db.execute(
            select(OrderModel).where(OrderModel.id == order_id).options(selectinload(OrderModel.items))
        )).scalars().first()
        if not order:
            return
        stores = {}
        for item in order.items:
            stores.setdefault(item.store_id, []).append(item)
        store_rows = (await db.execute(select(StoreModel).where(StoreModel.id.in_(list(stores))))).scalars().all()
        porters = (await db.execute(
            select(PorterModel).where(PorterModel.last_seen >= datetime.utcnow() - timedelta(days=30))
        )).scalars().all()

    stalls = ", ".join(escape(s.stall_number) for s in store_rows)
    porter_text = (
        f"🔔 <b>Yangi buyurtma · Новый заказ</b> #{order.order_number}\n"
        f"🏪 {stalls}\n"
        f"📦 {len(order.items)} · 💰 {order.total_amount:,.0f} UZS\n"
        f"📍 {escape(order.delivery_district or '')}, {escape(order.delivery_address)}"
    )
    keyboard = _webapp_button("🛒 Olish / Взять заказ", "tab=porter")
    await asyncio.gather(*[_send(p.tg_id, porter_text, keyboard) for p in porters])

    for store in store_rows:
        if not store.telegram_chat_id:
            continue
        lines = "\n".join(f"• {escape(i.product_name)} — {i.quantity:g} {escape(i.unit)}" for i in stores[store.id])
        seller_text = (
            f"🔔 <b>Yangi buyurtma · Новый заказ</b> #{order.order_number}\n"
            f"🏪 {escape(store.stall_number)}\n\n{lines}\n\n"
            f"📦 Aravachi keladi — tayyorlab qo'ying / Аравачи скоро придёт — подготовьте товар"
        )
        await _send(store.telegram_chat_id, seller_text, _webapp_button("🏪 Kabinet / Кабинет", "tab=seller_cabinet"))


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
