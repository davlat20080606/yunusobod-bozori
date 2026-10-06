import asyncio
import logging
from typing import Optional
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command, CommandStart
from aiogram.types import (
    InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo,
    ReplyKeyboardMarkup, KeyboardButton
)
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
            "⚡️ <i>45 daqiqada tezyurar yetkazib berish</i>"
        ),
        "open_bazaar": "🛒 Bozorni ochish (Mini App)",
        "seller_portal": "🏪 Sotuvchi Kabineti",
        "porter_portal": "🛒 Aravachi Kabineti",
        "my_orders": "📦 Zakazlarim",
        "select_lang": "Tilni tanlang / Выберите язык:",
        "bottom_btn": "🛒 Bozorni ochish (Mini App)"
    },
    "ru": {
        "welcome": (
            "🇷🇺 <b>Добро пожаловать на Юнусабадский Дехканский Базар!</b> 🍈\n\n"
            "Свежайшие отборные продукты прямо с прилавков базара: сахарные помидоры, ферганские персики, мясо, горячий тандыр-нон и сухофрукты с доставкой по Ташкенту!\n\n"
            "⚡️ <i>Экспресс-доставка за 45-60 минут</i>"
        ),
        "open_bazaar": "🛒 Открыть базар (Mini App)",
        "seller_portal": "🏪 Кабинет продавца",
        "porter_portal": "🛒 Кабинет аравачи",
        "my_orders": "📦 Мои заказы",
        "select_lang": "Выберите язык / Tilni tanlang:",
        "bottom_btn": "🛒 Открыть базар (Mini App)"
    },
    "en": {
        "welcome": (
            "🇬🇧 <b>Welcome to Yunusabad Farmers' Market!</b> 🍈\n\n"
            "Handpicked fresh produce directly from bazaar stalls: sweet tomatoes, seasonal fruits, halal meat, hot tandoor bread and dried nuts delivered to your doorstep!\n\n"
            "⚡️ <i>Fast 45-min delivery across Tashkent</i>"
        ),
        "open_bazaar": "🛒 Open Market (Mini App)",
        "seller_portal": "🏪 Seller Portal",
        "porter_portal": "🛒 Porter Portal",
        "my_orders": "📦 My Orders",
        "select_lang": "Select Language / Tilni tanlang:",
        "bottom_btn": "🛒 Open Market (Mini App)"
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
    webapp_url = settings.WEBAPP_URL.strip()
    t = TEXTS.get(lang, TEXTS["uz"])

    url_main = f"{webapp_url}?lang={lang}"
    url_seller = f"{webapp_url}?tab=seller&lang={lang}"
    url_orders = f"{webapp_url}?tab=orders&lang={lang}"
    url_porter = f"{webapp_url}?tab=porter&lang={lang}"

    inline_buttons = [
        # Main WebApp button
        [
            InlineKeyboardButton(
                text=t["open_bazaar"],
                web_app=WebAppInfo(url=url_main)
            )
        ],
        # Seller & Orders
        [
            InlineKeyboardButton(
                text=t["seller_portal"],
                web_app=WebAppInfo(url=url_seller)
            ),
            InlineKeyboardButton(
                text=t["my_orders"],
                web_app=WebAppInfo(url=url_orders)
            )
        ],
        # Aravachi (bazaar porter)
        [
            InlineKeyboardButton(
                text=t["porter_portal"],
                web_app=WebAppInfo(url=url_porter)
            )
        ],
        # Language Switcher Row
        [
            InlineKeyboardButton(text="🇺🇿 O'zbekcha", callback_data="lang_uz"),
            InlineKeyboardButton(text="🇷🇺 Русский", callback_data="lang_ru"),
            InlineKeyboardButton(text="🇬🇧 English", callback_data="lang_en")
        ]
    ]

    return InlineKeyboardMarkup(inline_keyboard=inline_buttons)

def setup_dispatcher() -> Dispatcher:
    global dp
    dp = Dispatcher()

    @dp.message(CommandStart())
    async def cmd_start(message: types.Message):
        user_lang = "ru" if (message.from_user.language_code and "ru" in message.from_user.language_code) else "uz"
        t = TEXTS[user_lang]
        keyboard = build_keyboard(user_lang)

        reply_keyboard = ReplyKeyboardMarkup(
            keyboard=[
                [
                    KeyboardButton(
                        text=t["bottom_btn"],
                        web_app=WebAppInfo(url=f"{settings.WEBAPP_URL}?lang={user_lang}")
                    )
                ]
            ],
            resize_keyboard=True
        )

        try:
            await message.answer_photo(
                photo=BOZOR_BANNER_URL,
                caption=t["welcome"],
                reply_markup=keyboard,
                parse_mode="HTML"
            )
        except Exception:
            await message.answer(
                text=t["welcome"],
                reply_markup=keyboard,
                parse_mode="HTML"
            )

        await message.answer(
            f"👇 {t['bottom_btn']}",
            reply_markup=reply_keyboard
        )

    # Interactive Language Switch Callbacks
    @dp.callback_query(F.data.in_(["lang_uz", "lang_ru", "lang_en"]))
    async def handle_lang_switch(query: types.CallbackQuery):
        selected_lang = query.data.split("_")[1]
        t = TEXTS[selected_lang]
        keyboard = build_keyboard(selected_lang)

        try:
            if query.message.photo:
                await query.message.edit_caption(
                    caption=t["welcome"],
                    reply_markup=keyboard,
                    parse_mode="HTML"
                )
            else:
                await query.message.edit_text(
                    text=t["welcome"],
                    reply_markup=keyboard,
                    parse_mode="HTML"
                )
        except Exception as e:
            logger.info(f"Notice during lang edit: {e}")

        await query.answer(f"✅ Til o'zgartirildi / Язык изменен: {selected_lang.upper()}")

    return dp

async def send_seller_order_notification(order_data: dict, store_name: str):
    b = get_bot()
    if not b:
        return

    address = f"{order_data.get('delivery_district', 'Yunusobod')}, {order_data.get('delivery_address', '')}"
    encoded_addr = address.replace(' ', '+')
    # Yandex Maps / Yandex Go routing URL
    yandex_route_url = f"https://yandex.uz/maps/?rtext=41.3655,69.2885~{encoded_addr}&rtt=auto"

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

