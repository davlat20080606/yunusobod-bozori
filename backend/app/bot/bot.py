import asyncio
import logging
from typing import Optional
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command, CommandStart
from aiogram.types import (
    InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo,
    ReplyKeyboardRemove, MenuButtonWebApp
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


def setup_dispatcher() -> Dispatcher:
    global dp
    dp = Dispatcher()

    @dp.message(CommandStart())
    async def cmd_start(message: types.Message):
        code = message.from_user.language_code or ""
        user_lang = "ru" if "ru" in code else ("en" if code.startswith("en") else "uz")
        t = TEXTS[user_lang]

        # Remove the old big "Open bazaar" keyboard that earlier versions left at the bottom of the chat
        try:
            cleanup = await message.answer("…", reply_markup=ReplyKeyboardRemove())
            await cleanup.delete()
        except Exception:
            pass

        try:
            await message.answer_photo(
                photo=BOZOR_BANNER_URL,
                caption=t["welcome"],
                reply_markup=build_keyboard(user_lang),
                parse_mode="HTML"
            )
        except Exception:
            await message.answer(
                text=t["welcome"],
                reply_markup=build_keyboard(user_lang),
                parse_mode="HTML"
            )

        await set_menu_button_for_chat(message.bot, message.chat.id, user_lang)

    # Interactive Language Switch Callbacks
    @dp.callback_query(F.data.in_(["lang_uz", "lang_ru", "lang_en"]))
    async def handle_lang_switch(query: types.CallbackQuery):
        selected_lang = query.data.split("_")[1]
        t = TEXTS[selected_lang]
        keyboard = build_keyboard(selected_lang)

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

