import asyncio
import logging
from typing import Optional
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command, CommandStart
from aiogram.types import (
    InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo,
    ReplyKeyboardRemove, MenuButtonWebApp, ReplyKeyboardMarkup, KeyboardButton
)
from html import escape
from app.config import settings

logger = logging.getLogger(__name__)

bot: Optional[Bot] = None
dp: Optional[Dispatcher] = None

# Logo/Banner photo of authentic fresh bazaar
BOZOR_BANNER_URL = "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1000&auto=format&fit=crop&q=80"

TEXTS = {
    "uz": {
        "welcome": (
            "🇺🇿 <b>Yunusobod Dehqon Bozoriga xush kelibsiz!</b> 🍈\n\n"
            "Toshkentning eng saralangan va yangi mahsulotlari: sabzavotlar, mevalar, halol go'sht, issiq tandir non va quruq mevalar to'g'ridan-to'g'ri rastalardan uyingizga!\n\n"
            "⚡️ <i>45 daqiqada tezyurar yetkazib berish</i>\n\n"
            "👇 Bozorni ochish uchun pastdagi <b>«🛒 Bozor»</b> tugmasini bosing"
        ),
    },
    "ru": {
        "welcome": (
            "🇷🇺 <b>Добро пожаловать на Юнусабадский Дехканский Базар!</b> 🍈\n\n"
            "Свежайшие отборные продукты прямо с прилавков базара: сахарные помидоры, ферганские персики, мясо, горячий тандыр-нон и сухофрукты с доставкой по Ташкенту!\n\n"
            "⚡️ <i>Экспресс-доставка за 45-60 минут</i>\n\n"
            "👇 Чтобы открыть базар, нажмите кнопку <b>«🛒 Bozor»</b> внизу"
        ),
    },
    "en": {
        "welcome": (
            "🇬🇧 <b>Welcome to Yunusabad Farmers' Market!</b> 🍈\n\n"
            "Handpicked fresh produce directly from bazaar stalls: sweet tomatoes, seasonal fruits, halal meat, hot tandoor bread and dried nuts delivered to your doorstep!\n\n"
            "⚡️ <i>Fast 45-min delivery across Tashkent</i>\n\n"
            "👇 Tap the <b>«🛒 Bozor»</b> button below to open the market"
        ),
    }
}

def get_bot() -> Optional[Bot]:
    global bot
    if bot is None and settings.TELEGRAM_BOT_TOKEN and not settings.TELEGRAM_BOT_TOKEN.startswith("7123456789"):
        try:
            bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)
        except Exception as e:
            logger.warning(f"Could not initialize Telegram Bot with provided token: {e}")
            bot = None
    return bot

def build_keyboard(lang: str = "uz"):
    """Only the language switcher: the bazaar opens from the chat's menu button, like modern Mini App bots."""
    def label(code, text):
        return f"✓ {text}" if code == lang else text

    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text=label("uz", "🇺🇿 O'zbekcha"), callback_data="lang_uz"),
        InlineKeyboardButton(text=label("ru", "🇷🇺 Русский"), callback_data="lang_ru"),
        InlineKeyboardButton(text=label("en", "🇬🇧 English"), callback_data="lang_en"),
    ]])


async def set_menu_button_for_chat(b: Bot, chat_id: int, lang: str):
    """Open the Mini App in the language this person picked."""
    if not settings.WEBAPP_URL.startswith("https://"):
        return
    try:
        await b.set_chat_menu_button(
            chat_id=chat_id,
            menu_button=MenuButtonWebApp(text="🛒 Bozor", web_app=WebAppInfo(url=f"{settings.WEBAPP_URL}?lang={lang}"))
        )
    except Exception as e:
        logger.info(f"Menu button notice: {e}")


REG_TEXTS = {
    "choose_lang": "🇺🇿 Tilni tanlang\n🇷🇺 Выберите язык\n🇬🇧 Choose a language",
    "ask_phone": {
        "uz": "📱 Telefon raqamingizni yuboring.\n\nPastdagi <b>«📱 Raqamni yuborish»</b> tugmasini bosing — buyurtma berganda boshqa so'ramaymiz.",
        "ru": "📱 Отправьте свой номер телефона.\n\nНажмите кнопку <b>«📱 Отправить номер»</b> внизу — при заказе больше спрашивать не будем.",
        "en": "📱 Send your phone number.\n\nTap <b>«📱 Share number»</b> below — we won't ask again when you order.",
    },
    "phone_button": {"uz": "📱 Raqamni yuborish", "ru": "📱 Отправить номер", "en": "📱 Share number"},
    "not_your_contact": {
        "uz": "Iltimos, o'zingizning raqamingizni tugma orqali yuboring 👇",
        "ru": "Пожалуйста, отправьте свой номер кнопкой 👇",
        "en": "Please share your own number with the button 👇",
    },
    "ask_name": {
        "uz": "👤 Ismingizni yozing (masalan: Aziza).",
        "ru": "👤 Напишите ваше имя (например: Азиза).",
        "en": "👤 Type your name (for example: Aziza).",
    },
    "bad_name": {
        "uz": "Ism 2 tadan 60 tagacha harf bo'lsin.",
        "ru": "Имя должно быть от 2 до 60 символов.",
        "en": "The name should be 2 to 60 characters.",
    },
    "done": {
        "uz": "✅ Rahmat, {name}! Ro'yxatdan o'tdingiz.\n📱 {phone}",
        "ru": "✅ Спасибо, {name}! Вы зарегистрированы.\n📱 {phone}",
        "en": "✅ Thank you, {name}! You are registered.\n📱 {phone}",
    },
    "help": {
        "uz": "ℹ️ <b>Yordam</b>\n\n🕕 Bozor har kuni 06:00 – 20:00 ishlaydi\n🚚 Yetkazish: bozordan {radius} km gacha, 45–60 daqiqa\n💵 To'lov: naqd, kuryerga qabul qilganda{phone_line}\n\n/profile — ism va telefonni o'zgartirish",
        "ru": "ℹ️ <b>Помощь</b>\n\n🕕 Базар работает каждый день 06:00 – 20:00\n🚚 Доставка: до {radius} км от базара, 45–60 минут\n💵 Оплата: наличными курьеру при получении{phone_line}\n\n/profile — изменить имя и телефон",
        "en": "ℹ️ <b>Help</b>\n\n🕕 The bazaar is open daily 06:00 – 20:00\n🚚 Delivery: up to {radius} km from the bazaar, 45–60 minutes\n💵 Payment: cash to the courier on delivery{phone_line}\n\n/profile — change name and phone",
    },
    "help_phone": {
        "uz": "📞 Savol yoki muammo bo'lsa: {phone}",
        "ru": "📞 Вопросы и проблемы: {phone}",
        "en": "📞 Questions or problems: {phone}",
    },
    "profile": {
        "uz": "👤 <b>Profilingiz</b>\nIsm: {name}\nTelefon: {phone}\n\nO'zgartirish uchun tugmani bosing.",
        "ru": "👤 <b>Ваш профиль</b>\nИмя: {name}\nТелефон: {phone}\n\nЧтобы изменить, нажмите кнопку.",
        "en": "👤 <b>Your profile</b>\nName: {name}\nPhone: {phone}\n\nTap a button to change.",
    },
    "change_phone": {"uz": "📱 Raqamni o'zgartirish", "ru": "📱 Изменить номер", "en": "📱 Change phone"},
    "change_name": {"uz": "👤 Ismni o'zgartirish", "ru": "👤 Изменить имя", "en": "👤 Change name"},
}


def format_phone(raw: str) -> str:
    """'998901234567' -> '+998 90 123 45 67'"""
    digits = "".join(ch for ch in raw if ch.isdigit())
    if len(digits) == 12 and digits.startswith("998"):
        return f"+998 {digits[3:5]} {digits[5:8]} {digits[8:10]} {digits[10:12]}"
    return f"+{digits}" if digits else raw


def language_keyboard(prefix: str, lang: str = None):
    def label(code, text):
        return f"✓ {text}" if code == lang else text
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text=label("uz", "🇺🇿 O'zbekcha"), callback_data=f"{prefix}_uz"),
        InlineKeyboardButton(text=label("ru", "🇷🇺 Русский"), callback_data=f"{prefix}_ru"),
        InlineKeyboardButton(text=label("en", "🇬🇧 English"), callback_data=f"{prefix}_en"),
    ]])


async def get_customer(tg_id: int):
    from app.database import async_session_factory
    from app.models.schemas import CustomerModel
    from sqlalchemy import select
    async with async_session_factory() as db:
        return (await db.execute(select(CustomerModel).where(CustomerModel.tg_id == str(tg_id)))).scalars().first()


async def save_customer(tg_id: int, **fields):
    from app.database import async_session_factory
    from app.models.schemas import CustomerModel
    from sqlalchemy import select
    async with async_session_factory() as db:
        customer = (await db.execute(select(CustomerModel).where(CustomerModel.tg_id == str(tg_id)))).scalars().first()
        if not customer:
            customer = CustomerModel(tg_id=str(tg_id))
            db.add(customer)
        for key, value in fields.items():
            setattr(customer, key, value)
        await db.commit()
        await db.refresh(customer)
        return customer


async def send_welcome(message: types.Message, lang: str):
    t = TEXTS[lang]
    try:
        await message.answer_photo(photo=BOZOR_BANNER_URL, caption=t["welcome"], reply_markup=build_keyboard(lang), parse_mode="HTML")
    except Exception:
        await message.answer(text=t["welcome"], reply_markup=build_keyboard(lang), parse_mode="HTML")
    await set_menu_button_for_chat(message.bot, message.chat.id, lang)


async def ask_phone(message: types.Message, lang: str):
    keyboard = ReplyKeyboardMarkup(
        keyboard=[[KeyboardButton(text=REG_TEXTS["phone_button"][lang], request_contact=True)]],
        resize_keyboard=True, one_time_keyboard=True
    )
    await message.answer(REG_TEXTS["ask_phone"][lang], reply_markup=keyboard, parse_mode="HTML")


async def ask_name(message: types.Message, lang: str, suggestion: str = None):
    keyboard = ReplyKeyboardRemove()
    if suggestion:
        keyboard = ReplyKeyboardMarkup(keyboard=[[KeyboardButton(text=suggestion[:60])]], resize_keyboard=True, one_time_keyboard=True)
    await message.answer(REG_TEXTS["ask_name"][lang], reply_markup=keyboard)


async def continue_registration(message: types.Message, customer, tg_first_name: str = None):
    """Language → phone → name; whatever is missing is asked next."""
    lang = customer.lang or "uz"
    if not customer.phone:
        await ask_phone(message, lang)
    elif not customer.name:
        await ask_name(message, lang, tg_first_name)
    else:
        await message.answer(
            REG_TEXTS["done"][lang].format(name=escape(customer.name), phone=customer.phone),
            reply_markup=ReplyKeyboardRemove()
        )
        await send_welcome(message, lang)


def setup_dispatcher() -> Dispatcher:
    global dp
    dp = Dispatcher()

    @dp.message(CommandStart())
    async def cmd_start(message: types.Message):
        customer = await get_customer(message.from_user.id)
        if not customer or not customer.lang:
            # First visit: language first, like Evos / Bellissimo
            await message.answer(REG_TEXTS["choose_lang"], reply_markup=language_keyboard("reglang"))
            return
        if not customer.phone or not customer.name:
            await continue_registration(message, customer, message.from_user.first_name)
            return
        # Clear any old reply keyboard left by earlier versions
        try:
            cleanup = await message.answer("…", reply_markup=ReplyKeyboardRemove())
            await cleanup.delete()
        except Exception:
            pass
        await send_welcome(message, customer.lang)

    @dp.message(Command("help"))
    async def cmd_help(message: types.Message):
        from app.database import async_session_factory
        from app.services.config_store import get_setting
        customer = await get_customer(message.from_user.id)
        lang = (customer.lang if customer else None) or "uz"
        async with async_session_factory() as db:
            phone = await get_setting(db, "support_phone")
            radius = await get_setting(db, "delivery_radius_km")
        phone_line = "\n\n" + REG_TEXTS["help_phone"][lang].format(phone=escape(phone)) if phone else ""
        await message.answer(REG_TEXTS["help"][lang].format(radius=radius, phone_line=phone_line), parse_mode="HTML")

    @dp.message(Command("profile", "settings"))
    async def cmd_profile(message: types.Message):
        customer = await get_customer(message.from_user.id)
        if not customer or not customer.phone or not customer.name:
            await cmd_start(message)
            return
        lang = customer.lang or "uz"
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(text=REG_TEXTS["change_phone"][lang], callback_data="profile_phone")],
            [InlineKeyboardButton(text=REG_TEXTS["change_name"][lang], callback_data="profile_name")],
        ])
        await message.answer(REG_TEXTS["profile"][lang].format(name=escape(customer.name), phone=customer.phone), reply_markup=keyboard, parse_mode="HTML")

    @dp.callback_query(F.data.in_(["reglang_uz", "reglang_ru", "reglang_en"]))
    async def handle_registration_lang(query: types.CallbackQuery):
        lang = query.data.split("_")[1]
        customer = await save_customer(query.from_user.id, lang=lang)
        try:
            await query.message.edit_reply_markup(reply_markup=language_keyboard("reglang", lang))
        except Exception:
            pass
        await query.answer()
        await continue_registration(query.message, customer, query.from_user.first_name)

    @dp.callback_query(F.data.in_(["profile_phone", "profile_name"]))
    async def handle_profile_change(query: types.CallbackQuery):
        field = "phone" if query.data == "profile_phone" else "name"
        customer = await save_customer(query.from_user.id, **{field: None})
        await query.answer()
        await continue_registration(query.message, customer, query.from_user.first_name)

    @dp.message(F.contact)
    async def handle_contact(message: types.Message):
        customer = await get_customer(message.from_user.id) or await save_customer(message.from_user.id, lang="uz")
        lang = customer.lang or "uz"
        # Only the person's own number: nobody can register someone else's phone
        if message.contact.user_id != message.from_user.id:
            await message.answer(REG_TEXTS["not_your_contact"][lang])
            await ask_phone(message, lang)
            return
        customer = await save_customer(message.from_user.id, phone=format_phone(message.contact.phone_number))
        await continue_registration(message, customer, message.from_user.first_name)

    @dp.message(F.text & ~F.text.startswith("/"))
    async def handle_text(message: types.Message):
        customer = await get_customer(message.from_user.id)
        if not customer or not customer.lang:
            await cmd_start(message)
            return
        lang = customer.lang
        if not customer.phone:
            await ask_phone(message, lang)
            return
        if not customer.name:
            name = " ".join(message.text.split())
            if not 2 <= len(name) <= 60:
                await message.answer(REG_TEXTS["bad_name"][lang])
                return
            customer = await save_customer(message.from_user.id, name=name)
            await continue_registration(message, customer)

    # Language buttons under the welcome message
    @dp.callback_query(F.data.in_(["lang_uz", "lang_ru", "lang_en"]))
    async def handle_lang_switch(query: types.CallbackQuery):
        selected_lang = query.data.split("_")[1]
        t = TEXTS[selected_lang]
        keyboard = build_keyboard(selected_lang)
        await save_customer(query.from_user.id, lang=selected_lang)

        try:
            if query.message.photo:
                await query.message.edit_caption(caption=t["welcome"], reply_markup=keyboard, parse_mode="HTML")
            else:
                await query.message.edit_text(text=t["welcome"], reply_markup=keyboard, parse_mode="HTML")
        except Exception as e:
            logger.info(f"Notice during lang edit: {e}")

        await set_menu_button_for_chat(query.bot, query.message.chat.id, selected_lang)
        await query.answer(f"✅ {selected_lang.upper()}")

    return dp

async def send_seller_order_notification(order_data: dict, store_name: str):
    b = get_bot()
    if not b:
        return

    address = f"{order_data.get('delivery_district', 'Yunusobod')}, {order_data.get('delivery_address', '')}"
    encoded_addr = address.replace(' ', '+')
    # Yandex Maps / Yandex Go routing URL
    yandex_route_url = f"https://yandex.uz/maps/?rtext=41.36467,69.29089~{encoded_addr}&rtt=auto"

    text = (
        f"🔔 <b>YANGI BUYURTMA! #{order_data.get('order_number')}</b>\n\n"
        f"🏪 Do'kon / Раста: <b>{store_name}</b>\n"
        f"👤 Xaridor: <b>{order_data.get('customer_name')}</b> ({order_data.get('customer_phone')})\n"
        f"📍 Manzil: {address}\n"
        f"🏢 Mo'ljal: {order_data.get('landmark') or '—'}\n"
        f"💰 Jami summa: <b>{order_data.get('total_amount'):,.0f} UZS</b>\n"
        f"⚡️ Vaqt: {order_data.get('delivery_time_slot')}\n\n"
        f"📦 <i>Mahsulotlarni qadoqlab tayyorlab qo'ying!</i>"
    )

    kb = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="🚕 Yandex Go (Marshrutni ochish)",
                    url=yandex_route_url
                )
            ]
        ]
    )

    try:
        # In real group or chat, send notification
        pass
    except Exception as e:
        logger.error(f"Error sending TG notification: {e}")

