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
from app.services.events import order_changed

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
        "no_show": ("😔 <b>Sizni kuta olmadik</b>", "Buyurtma rastalarga qaytariladi. Xato bo'lsa, ilovada «Men shu yerdaman» ni bosing"),
        "returned": ("↩️ <b>Buyurtma olinmadi</b>", "Mahsulotlar rastalarga qaytarildi"),
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
        "no_show": ("😔 <b>Не дождались вас</b>", "Заказ вернут на расты. Если это ошибка, нажмите в приложении «Я здесь»"),
        "returned": ("↩️ <b>Заказ не забрали</b>", "Товары вернули на расты"),
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
        "no_show": ("😔 <b>We could not wait any longer</b>", "The order goes back to the stalls. If this is a mistake, tap «I'm here» in the app"),
        "returned": ("↩️ <b>Order not collected</b>", "The goods went back to the stalls"),
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


ADJUST_TEXTS = {
    "uz": {
        "weight": "⚖️ <b>Tarozida {qty}</b> chiqdi: {name}\nNarx: {old} → <b>{new} so'm</b>",
        "weight_ask": "⚖️ <b>{name}: {qty}</b> chiqdi (buyurtma {ordered}).\nNarx: {old} → <b>{new} so'm</b>. Ilovada roziligingizni bering.",
        "missing": "❌ <b>{name}</b> tugab qoldi — buyurtmadan olib tashlandi, {old} so'm hisobdan chiqdi. Qolgan mahsulotlar yo'lda.",
        "back": "✅ <b>{name}</b> topildi — buyurtmaga qaytdi.",
        "decision": "👍 Javobingiz qabul qilindi: {name}",
        "total": "Yangi jami: <b>{total} so'm</b>",
        "button": "📦 Buyurtma",
    },
    "ru": {
        "weight": "⚖️ <b>На весах {qty}</b>: {name}\nЦена: {old} → <b>{new} сум</b>",
        "weight_ask": "⚖️ <b>{name}: {qty}</b> (заказано {ordered}).\nЦена: {old} → <b>{new} сум</b>. Подтвердите в приложении.",
        "missing": "❌ <b>{name}</b> — нет в наличии, убрали из заказа: −{old} сум. Остальное уже в пути.",
        "back": "✅ <b>{name}</b> — снова в заказе.",
        "decision": "👍 Ваш ответ принят: {name}",
        "total": "Новая сумма: <b>{total} сум</b>",
        "button": "📦 Заказ",
    },
    "en": {
        "weight": "⚖️ <b>The scale shows {qty}</b>: {name}\nPrice: {old} → <b>{new} UZS</b>",
        "weight_ask": "⚖️ <b>{name}: {qty}</b> (ordered {ordered}).\nPrice: {old} → <b>{new} UZS</b>. Please confirm in the app.",
        "missing": "❌ <b>{name}</b> ran out — removed from the order, {old} UZS taken off. The rest is on its way.",
        "back": "✅ <b>{name}</b> is back in the order.",
        "decision": "👍 Got your answer: {name}",
        "total": "New total: <b>{total} UZS</b>",
        "button": "📦 Order",
    },
}


async def _adjustment(order_id: int, item_id: int, kind: str):
    """Tell the customer right away when the scale or an empty stall changes their order."""
    from app.services.promos import unit_in
    from app.models.schemas import OrderItemModel
    async with async_session_factory() as db:
        order = (await db.execute(
            select(OrderModel).where(OrderModel.id == order_id).options(selectinload(OrderModel.items).selectinload(OrderItemModel.product))
        )).scalars().first()
        if not order or not order.customer_tg_id:
            return
        item = next((i for i in order.items if i.id == item_id), None)
        customer = (await db.execute(select(CustomerModel).where(CustomerModel.tg_id == order.customer_tg_id))).scalars().first()
    if not item:
        return
    lang = customer.lang if customer and customer.lang in ADJUST_TEXTS else "uz"
    texts = ADJUST_TEXTS[lang]
    name = escape(getattr(item, f"product_name_{lang}", None) or item.product_name) if lang != "uz" else escape(item.product_name)
    unit = unit_in(lang, item.unit) if lang != "uz" else item.unit
    fmt = lambda n: f"{n:,.0f}".replace(",", " ")
    key = "weight_ask" if kind == "weight" and item.weight_status == "pending" else kind
    body = texts[key].format(
        name=name, qty=f"{(item.actual_quantity or item.quantity):g} {unit}", ordered=f"{item.quantity:g} {unit}",
        old=fmt(item.price * item.quantity), new=fmt(item.price * (item.actual_quantity or item.quantity)),
    )
    text = f"#{order.order_number}\n{body}\n{texts['total'].format(total=fmt(order.total_amount))}"
    await _send(order.customer_tg_id, text, _webapp_button(texts["button"], f"tab=orders&order={order.order_number}&lang={lang}"))


async def _cold_chain(order_id: int, minutes: int):
    """Meat must not wait at the gate in the heat: warn the aravachi and the bozorkom."""
    from app.services.config_store import get_setting
    async with async_session_factory() as db:
        order = await db.get(OrderModel, order_id)
        porter = (await db.execute(select(StaffModel).where(StaffModel.phone == order.porter_phone))).scalars().first() if order and order.porter_phone else None
        admin_tg = await get_setting(db, "admin_tg_id")
    if not order:
        return
    text = (
        f"🌡 <b>Buyurtma {minutes} daqiqadan beri darvozada · Заказ ждёт у ворот {minutes} мин</b> #{order.order_number}\n"
        f"{'🚕 ' + escape(order.taxi_name) if order.taxi_name else '🚕 Taksi hali olmadi · Такси ещё не взяло'}\n"
        f"Go'sht/sut issiqda turmasin: o'zingiz olib boring yoki rastaga qaytaring · "
        f"Не держите мясо/молочку на жаре: отвезите сами или верните на расту"
    )
    if porter and porter.tg_id:
        await _send(porter.tg_id, text, _webapp_button("🛒 Aravachi", "tab=porter"))
    if admin_tg:
        await _send(admin_tg, text, _webapp_button("🏛 Bozorkom", "tab=admin"))


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
        from app.models.schemas import StoreMemberModel
        member_rows = (await db.execute(
            select(StoreMemberModel.store_id, StoreMemberModel.tg_id).where(StoreMemberModel.store_id.in_(list(stores)))
        )).all()
    team = {}
    for store_id, tg_id in member_rows:
        team.setdefault(store_id, set()).add(tg_id)

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
        # The owner and every helper (son, apprentice, brother) hear about the order
        chats = team.get(store.id, set()) | ({store.telegram_chat_id} if store.telegram_chat_id else set())
        if not chats:
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
        await asyncio.gather(*[_send(chat, seller_text, _webapp_button("🏪 Kabinet / Кабинет", "tab=seller_cabinet")) for chat in chats])


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
    order_changed(order_id)
    _background(_customer_status(order_id))


def notify_new_order(order_id: int):
    order_changed(order_id)
    _background(_new_order(order_id))
    _background(_customer_status(order_id))


def notify_adjustment(order_id: int, item_id: int, kind: str):
    order_changed(order_id)
    _background(_adjustment(order_id, item_id, kind))


def notify_cold_chain(order_id: int, minutes: int):
    _background(_cold_chain(order_id, minutes))


def notify_taxis(order_id: int):
    _background(_taxis(order_id))


def notify_admin_application(text: str):
    _background(_admin(text))


def notify_store_decision(store_id: int):
    _background(_store_decision(store_id))


def notify_staff_decision(staff_id: int):
    _background(_staff_decision(staff_id))


async def _stall_chats(db, store_id: int) -> set:
    """Everyone who works at a stall: the owner, the helpers who scanned the QR, the stall's own chat."""
    from app.models.schemas import StoreMemberModel
    store = await db.get(StoreModel, store_id)
    chats = set((await db.execute(select(StoreMemberModel.tg_id).where(StoreMemberModel.store_id == store_id))).scalars().all())
    if store and store.telegram_chat_id:
        chats.add(store.telegram_chat_id)
    return chats


STOCK_BUTTON = "📦 Qoldiq · Остатки"


async def _low_stock(product_id: int):
    from app.models.schemas import ProductModel
    async with async_session_factory() as db:
        prod = await db.get(ProductModel, product_id)
        if not prod or prod.available_quantity is None:
            return
        chats = await _stall_chats(db, prod.store_id)
    left = f"{prod.available_quantity:g} {escape(re.sub(r'\s*\(.*?\)', '', prod.unit or ''))}"
    text = (f"⚠️ <b>Kam qoldi · Заканчивается</b>\n{escape(prod.name_uz)} — {left}\n"
            "Ko'proq bo'lsa, qoldiqni yangilang · Если есть ещё, обновите остаток")
    keyboard = _webapp_button(STOCK_BUTTON, "tab=seller_cabinet&stock=1")
    await asyncio.gather(*[_send(chat, text, keyboard) for chat in chats])


def notify_low_stock(product_id: int):
    _background(_low_stock(product_id))


async def send_morning_stock() -> int:
    """Every morning: each open stall's team is asked what they have today (one screen, 30 seconds)."""
    async with async_session_factory() as db:
        store_ids = (await db.execute(select(StoreModel.id).where(StoreModel.status == "approved"))).scalars().all()
        chats = set()
        for store_id in store_ids:
            chats |= await _stall_chats(db, store_id)
    text = ("🌅 <b>Xayrli tong! Bugun nima bor?</b>\nMahsulotlar va taxminiy miqdorni belgilang — xaridorlar faqat borini ko'radi.\n\n"
            "🌅 <b>Доброе утро! Что есть сегодня?</b>\nОтметьте товары и примерное количество — покупатели увидят только то, что есть.")
    keyboard = _webapp_button("📝 Bugun nima bor? · Что есть сегодня?", "tab=seller_cabinet&stock=1")
    await asyncio.gather(*[_send(chat, text, keyboard) for chat in chats])
    return len(chats)


WAIT_TEXTS = {
    "uz": {"point": "⏰ <b>Sizni kutishyapti!</b>\n{point} · {porter}\n{left} daqiqadan keyin buyurtma rastalarga qaytariladi.",
           "courier": "⏰ <b>Kuryer eshik oldida kutmoqda!</b>\n{left} daqiqadan keyin buyurtma bozorga qaytariladi.",
           "self": "⏰ <b>Buyurtmangiz rastalarda tayyor</b>\nOlib keting: {stalls}. {left} daqiqadan keyin bekor bo'ladi."},
    "ru": {"point": "⏰ <b>Вас ждут!</b>\n{point} · {porter}\nЧерез {left} мин заказ вернут на расты.",
           "courier": "⏰ <b>Курьер ждёт у двери!</b>\nЧерез {left} мин заказ вернут на базар.",
           "self": "⏰ <b>Ваш заказ готов на растах</b>\nЗаберите: {stalls}. Через {left} мин он отменится."},
    "en": {"point": "⏰ <b>You are being waited for!</b>\n{point} · {porter}\nIn {left} min the order goes back to the stalls.",
           "courier": "⏰ <b>The courier is at your door!</b>\nIn {left} min the order goes back to the bazaar.",
           "self": "⏰ <b>Your order is ready at the stalls</b>\nCollect it: {stalls}. In {left} min it will be cancelled."},
}


async def _wait_reminder(order_id: int, left: int):
    async with async_session_factory() as db:
        order = (await db.execute(select(OrderModel).where(OrderModel.id == order_id).options(selectinload(OrderModel.items)))).scalars().first()
        if not order or not order.customer_tg_id:
            return
        stall_rows = (await db.execute(select(StoreModel.stall_number).where(StoreModel.id.in_({i.store_id for i in order.items})))).scalars().all()
        customer = (await db.execute(select(CustomerModel).where(CustomerModel.tg_id == order.customer_tg_id))).scalars().first()
    lang = customer.lang if customer and customer.lang in WAIT_TEXTS else "uz"
    text = WAIT_TEXTS[lang][order.fulfillment or "courier"].format(
        point=escape(point_name(order.handoff_point, lang)), porter=escape(order.porter_name or ""),
        stalls=escape(", ".join(stall_in(lang, s) for s in stall_rows)), left=left)
    await _send(order.customer_tg_id, f"{text}\n#{order.order_number}",
                _webapp_button(CUSTOMER_TEXTS[lang]["button"], f"tab=orders&order={order.order_number}&lang={lang}"))


def notify_wait_reminder(order_id: int, left: int):
    _background(_wait_reminder(order_id, left))


async def _workers(db, order: OrderModel) -> set:
    phones = [p for p in (order.porter_phone, order.taxi_phone) if p]
    if not phones:
        return set()
    return {s.tg_id for s in (await db.execute(select(StaffModel).where(StaffModel.phone.in_(phones)))).scalars().all() if s.tg_id}


async def _no_show(order_id: int):
    """Stalls whose goods left them get «bring it back» news; the others are told it is back on sale."""
    from app.services.config_store import get_setting
    async with async_session_factory() as db:
        order = (await db.execute(select(OrderModel).where(OrderModel.id == order_id).options(selectinload(OrderModel.items)))).scalars().first()
        if not order:
            return
        sends = []
        for store_id in {i.store_id for i in order.items}:
            lines = [i for i in order.items if i.store_id == store_id and i.item_status != "missing"]
            away = any(not i.returned for i in lines)
            text = (f"↩️ <b>Xaridor kelmadi · Покупатель не пришёл</b> #{order.order_number}\n" + (
                "Mahsulot rastaga qaytariladi. Olganingizda «Qaytib oldim» bosing · Товар вернут на расту, нажмите «Вернули»"
                if away else "Mahsulot sizda qoldi, qoldiqqa qaytdi · Товар остаётся у вас, вернулся в остаток"))
            for chat in await _stall_chats(db, store_id):
                sends.append(_send(chat, text, _webapp_button("🏪 Kabinet · Кабинет", "tab=seller_cabinet") if away else None))
        admin_tg = await get_setting(db, "admin_tg_id")
    if admin_tg:
        sends.append(_send(admin_tg, f"😔 <b>Xaridor kelmadi · Покупатель не пришёл</b> #{order.order_number}\n"
                                     f"{escape(order.customer_name)} · {escape(order.customer_phone)}"))
    await asyncio.gather(*sends)


def notify_no_show(order_id: int):
    notify_status(order_id)
    _background(_no_show(order_id))


async def _customer_here(order_id: int):
    from app.services.config_store import get_setting
    async with async_session_factory() as db:
        order = await db.get(OrderModel, order_id)
        if not order:
            return
        chats = await _workers(db, order)
        admin_tg = await get_setting(db, "admin_tg_id")
    text = (f"🙋 <b>Xaridor «Men shu yerdaman» dedi · Покупатель говорит «Я здесь»</b> #{order.order_number}\n"
            f"📞 {escape(order.customer_phone)} · {escape(order.customer_name)}")
    sends = [_send(chat, text) for chat in chats]
    if admin_tg:
        sends.append(_send(admin_tg, text, _webapp_button("🏛 Bozorkom", "tab=admin")))
    await asyncio.gather(*sends)


def notify_customer_here(order_id: int):
    order_changed(order_id)
    _background(_customer_here(order_id))


async def _return_late(order_id: int, minutes: int):
    from app.services.config_store import get_setting
    async with async_session_factory() as db:
        order = await db.get(OrderModel, order_id)
        if not order:
            return
        chats = await _workers(db, order)
        admin_tg = await get_setting(db, "admin_tg_id")
    text = (f"🌡 <b>{minutes} daqiqa: mahsulot hali rastaga qaytmadi · {minutes} мин: товар ещё не вернули на расту</b> "
            f"#{order.order_number}\nGo'sht/sut issiqda turmasin · Не держите мясо/молочку на жаре")
    sends = [_send(chat, text) for chat in chats]
    if admin_tg:
        sends.append(_send(admin_tg, text, _webapp_button("🏛 Bozorkom", "tab=admin")))
    await asyncio.gather(*sends)


def notify_return_late(order_id: int, minutes: int):
    _background(_return_late(order_id, minutes))
