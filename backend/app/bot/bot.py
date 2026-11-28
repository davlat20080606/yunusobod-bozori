import asyncio
import logging
import re
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

_bot_username = None


async def get_bot_username():
    """@name of the bot, for t.me links in QR codes (asked from Telegram once)."""
    global _bot_username
    if _bot_username is None and get_bot():
        try:
            _bot_username = (await get_bot().get_me()).username
        except Exception as e:
            logger.info(f"Bot name note: {e}")
    return _bot_username


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
        "uz": "ℹ️ <b>Yordam</b>\n\n🕕 Bozor har kuni 06:00 – 20:00 ishlaydi\n🚚 Yetkazish: bozordan {radius} km gacha, 45–60 daqiqa\n💵 To'lov: naqd, karta yoki nasiya — sotuvchi bilan o'zingiz kelishasiz{phone_line}\n\n/profile — ism va telefonni o'zgartirish\n/qoidalar — foydalanish qoidalari",
        "ru": "ℹ️ <b>Помощь</b>\n\n🕕 Базар работает каждый день 06:00 – 20:00\n🚚 Доставка: до {radius} км от базара, 45–60 минут\n💵 Оплата: наличные, карта или насия — договариваетесь с продавцом сами{phone_line}\n\n/profile — изменить имя и телефон\n/qoidalar — правила использования",
        "en": "ℹ️ <b>Help</b>\n\n🕕 The bazaar is open daily 06:00 – 20:00\n🚚 Delivery: up to {radius} km from the bazaar, 45–60 minutes\n💵 Payment: cash, card or credit — agree with the seller yourself{phone_line}\n\n/profile — change name and phone\n/qoidalar — terms of use",
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


def terms_keyboard(lang: str, with_agree: bool = True):
    from app.services import terms
    rows = []
    if with_agree:
        rows.append([InlineKeyboardButton(text=terms.AGREE[lang], callback_data="terms_ok")])
    if settings.WEBAPP_URL.startswith("https://"):
        rows.append([InlineKeyboardButton(text=terms.READ_ALL[lang], web_app=WebAppInfo(url=f"{settings.WEBAPP_URL}?tab=terms&lang={lang}"))])
    return InlineKeyboardMarkup(inline_keyboard=rows) if rows else None


async def terms_accepted(tg_id) -> bool:
    # Rules switched off (settings.TERMS_ENABLED): nobody is asked
    if not settings.TERMS_ENABLED:
        return True
    from app.database import async_session_factory
    from app.services import terms
    async with async_session_factory() as db:
        return await terms.has_accepted(db, tg_id)


async def ask_terms(message: types.Message, lang: str):
    from app.services import terms
    await message.answer(terms.WARNING[lang], reply_markup=terms_keyboard(lang), parse_mode="HTML")


async def accept_terms(query: types.CallbackQuery):
    """«Roziman»: remember it, then go on with the registration (or straight to the shop)."""
    from app.database import async_session_factory
    from app.services import terms
    customer = await get_customer(query.from_user.id) or await save_customer(query.from_user.id, lang="uz")
    lang = customer.lang or "uz"
    async with async_session_factory() as db:
        await terms.accept(db, query.from_user.id, lang, "bot")
    await query.answer(terms.ACCEPTED[lang])
    try:
        await query.message.edit_reply_markup(reply_markup=terms_keyboard(lang, with_agree=False))
    except Exception:
        pass
    await continue_registration(query.message, customer, query.from_user.first_name)


async def continue_registration(message: types.Message, customer, tg_first_name: str = None):
    """Language → rules (once) → phone → name; whatever is missing is asked next."""
    lang = customer.lang or "uz"
    if not await terms_accepted(customer.tg_id):
        await ask_terms(message, lang)
        return
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
        # Came by a stall's QR or a printed sheet: open the stall now that the phone is known
        from types import SimpleNamespace
        who = message.from_user if getattr(message, "from_user", None) and not getattr(message.from_user, "is_bot", False) else SimpleNamespace(
            id=int(customer.tg_id), first_name=customer.name, last_name=None, username=None, language_code=None, is_bot=False)
        try:
            await resume_entry(message, who)
        except Exception as e:
            logger.warning(f"Stall entry after registration failed: {e}")
        # 📒 Nasiya entries stalls wrote for this phone before the buyer joined the bot now ask to be confirmed
        try:
            from app.services import debts
            await debts.link_new_buyer(customer.tg_id, customer.phone)
        except Exception as e:
            logger.warning(f"Debt link failed: {e}")


JOIN_TEXTS = {
    "ok": {
        "uz": "✅ Siz <b>{store}</b> ({stall}) rastasiga yordamchi bo'lib qo'shildingiz.\nYangi buyurtmalar sizga ham keladi.",
        "ru": "✅ Вы добавлены помощником в расту <b>{store}</b> ({stall}).\nНовые заказы будут приходить и вам.",
        "en": "✅ You were added as a helper of <b>{store}</b> ({stall}).\nNew orders will come to you too.",
    },
    "bad": {
        "uz": "❌ QR kod eskirgan yoki ishlatilgan. Rasta egasidan yangisini so'rang.",
        "ru": "❌ QR-код устарел или уже использован. Попросите у владельца расты новый.",
        "en": "❌ This QR code has expired or was already used. Ask the stall owner for a new one.",
    },
    "button": {"uz": "🏪 Kabinetni ochish", "ru": "🏪 Открыть кабинет", "en": "🏪 Open the cabinet"},
}


async def join_stall(message: types.Message, token: str):
    """Link this Telegram account to the stall whose owner showed the QR code."""
    from datetime import datetime
    from sqlalchemy import select
    from app.database import async_session_factory
    from app.models.schemas import StoreInviteModel, StoreModel
    from app.api.seller import add_member
    customer = await get_customer(message.from_user.id)
    lang = (customer.lang if customer and customer.lang else None) or {"ru": "ru", "en": "en"}.get((message.from_user.language_code or "")[:2], "uz")
    async with async_session_factory() as db:
        invite = (await db.execute(select(StoreInviteModel).where(StoreInviteModel.token == token[:40]))).scalars().first()
        store = await db.get(StoreModel, invite.store_id) if invite else None
        if not invite or invite.used_at or invite.expires_at < datetime.utcnow() or not store:
            await message.answer(JOIN_TEXTS["bad"][lang])
            return
        user = message.from_user
        await add_member(db, store.id, {"id": user.id, "first_name": user.first_name, "last_name": user.last_name, "username": user.username}, "helper")
        invite.used_at = datetime.utcnow()
        await db.commit()
        store_name = getattr(store, f"name_{lang}", None) or store.name_uz
    keyboard = None
    if settings.WEBAPP_URL.startswith("https://"):
        keyboard = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(
            text=JOIN_TEXTS["button"][lang], web_app=WebAppInfo(url=f"{settings.WEBAPP_URL}?tab=seller_cabinet&lang={lang}")
        )]])
    await message.answer(JOIN_TEXTS["ok"][lang].format(store=escape(store_name), stall=escape(store.stall_number)), reply_markup=keyboard, parse_mode="HTML")


async def start_customer(message: types.Message) -> bool:
    """The bot's normal start: registration first, then the welcome with the shop button. True once registered."""
    customer = await get_customer(message.from_user.id)
    if not customer or not customer.lang:
        # First visit: language first, like Evos / Bellissimo
        await message.answer(REG_TEXTS["choose_lang"], reply_markup=language_keyboard("reglang"))
        return False
    if not customer.phone or not customer.name or not await terms_accepted(customer.tg_id):
        await continue_registration(message, customer, message.from_user.first_name)
        return False
    # Clear any old reply keyboard left by earlier versions
    try:
        cleanup = await message.answer("…", reply_markup=ReplyKeyboardRemove())
        await cleanup.delete()
    except Exception:
        pass
    await send_welcome(message, customer.lang)
    return True


STALL_TEXTS = {
    "member": {
        "uz": "🏪 <b>{store}</b> ({stall})\nKabinetingiz tayyor — tugmani bosing.",
        "ru": "🏪 <b>{store}</b> ({stall})\nВаш кабинет готов — нажмите кнопку.",
        "en": "🏪 <b>{store}</b> ({stall})\nYour cabinet is ready — tap the button.",
    },
    "staff_hint": {"uz": "Shu rastada ishlaysizmi? 👇", "ru": "Работаете на этой расте? 👇", "en": "Do you work at this stall? 👇"},
    "work": {"uz": "👷 Men shu rastada ishlayman", "ru": "👷 Я работаю на этой расте", "en": "👷 I work at this stall"},
    "asked": {
        "uz": "✅ So'rov rasta egasiga yuborildi. U tasdiqlasa, bot sizga xabar beradi.",
        "ru": "✅ Запрос отправлен владельцу расты. Когда он подтвердит, бот вам напишет.",
        "en": "✅ Sent to the stall owner. The bot will tell you once they approve.",
    },
    "no_owner": {
        "uz": "Bu rasta egasi botga hali ulanmagan. Unga ayting: kabinetga Telegram orqali bir marta kirsin.",
        "ru": "Владелец этой расты ещё не подключён к боту. Попросите его один раз войти в кабинет через Telegram.",
        "en": "This stall's owner has not connected to the bot yet. Ask them to open the cabinet in Telegram once.",
    },
    "bad": {"uz": "❌ Rasta topilmadi.", "ru": "❌ Раста не найдена.", "en": "❌ Stall not found."},
    # The stall has no owner in the bot yet and this person's number is not the one written at registration
    # (Shuhrat, 2026-11-28): if it is the owner, the registration has the wrong number
    "phone_mismatch": {
        "uz": "📱 Telegram raqamingiz bu rastaga yozilgan raqamga mos kelmadi.\nSiz rasta egasimisiz? Sizni ro'yxatga olgan xodimga yoki bozorkomga ayting — raqamni to'g'rilaydi, keyin QR ni qayta skanerlang.\nYordamchi bo'lsangiz — pastdagi tugmalar.",
        "ru": "📱 Ваш номер в Telegram не совпал с номером, записанным для этой расты.\nВы владелец? Скажите тому, кто вас регистрировал, или бозоркому — номер исправят, затем отсканируйте QR снова.\nЕсли вы помощник — кнопки ниже.",
        "en": "📱 Your Telegram number is not the one written for this stall.\nAre you the owner? Tell whoever registered you or the bozorkom — they will fix the number; then scan the QR again.\nIf you are a helper — the buttons below.",
    },
}


async def _lang_of(user) -> str:
    customer = await get_customer(user.id)
    return (customer.lang if customer and customer.lang else None) or {"ru": "ru", "en": "en"}.get((getattr(user, "language_code", None) or "")[:2], "uz")


async def _stall_owners(db, store) -> set:
    from sqlalchemy import select
    from app.models.schemas import StoreMemberModel
    owners = set((await db.execute(select(StoreMemberModel.tg_id).where(
        StoreMemberModel.store_id == store.id, StoreMemberModel.role == "owner"))).scalars().all())
    if store.telegram_chat_id:
        owners.add(str(store.telegram_chat_id))
    return owners


KIT_TEXTS = {
    "unbound": {
        "uz": "📄 Bu varaq hali rastaga biriktirilmagan. Ro'yxatdan o'tkazgan xodimdan so'rang.",
        "ru": "📄 Этот лист ещё не привязан к расте. Спросите сотрудника, который вас регистрировал.",
        "en": "📄 This sheet is not linked to a stall yet. Ask the person who registered you.",
    },
    "revoked": {
        "uz": "❌ Bu varaq bekor qilingan. Rasta egasidan yangi varaq so'rang.",
        "ru": "❌ Этот лист отменён. Попросите у владельца расты новый.",
        "en": "❌ This sheet was cancelled. Ask the stall owner for a new one.",
    },
    "pending": {
        "uz": "⏳ Rasta bozorkom tasdig'ini kutmoqda. Tasdiqlangach, QR kodni qayta skanerlang.",
        "ru": "⏳ Раста ждёт подтверждения бозоркома. После подтверждения отсканируйте QR ещё раз.",
        "en": "⏳ The stall is waiting for the bozorkom's approval. Scan the QR again once it is approved.",
    },
    "pin_button": {"uz": "🔢 Faollashtirish kodini kiritish", "ru": "🔢 Ввести код активации", "en": "🔢 Enter the activation code"},
    "pin_ask": {
        "uz": "Varaq ichidagi 4 xonali <b>faollashtirish kodini</b> yozing:",
        "ru": "Напишите 4-значный <b>код активации</b> с листа:",
        "en": "Type the 4-digit <b>activation code</b> from the sheet:",
    },
    "pin_bad": {
        "uz": "❌ Kod noto'g'ri. Varaqdagi kodni tekshirib, qayta yozing.",
        "ru": "❌ Неверный код. Проверьте код на листе и напишите снова.",
        "en": "❌ Wrong code. Check the code on the sheet and type it again.",
    },
    "pin_limit": {
        "uz": "⏳ Juda ko'p urinish. Bir soatdan keyin yoki rasta egasidan so'rang.",
        "ru": "⏳ Слишком много попыток. Через час — или попросите владельца расты.",
        "en": "⏳ Too many tries. Try in an hour, or ask the stall owner.",
    },
}

# Who scanned a sheet before finishing registration (the stall is opened for them when the phone is shared), and
# who was asked for a sheet's activation code. Both live in this process only and expire on their own.
PENDING_ENTRY: dict = {}   # tg_id -> (kind, value, time)   kind: "kit" | "stall"
AWAIT_PIN: dict = {}       # tg_id -> (kit_id, time)
_PENDING_TTL = 1800


def _pending(store: dict, uid: str):
    item = store.get(uid)
    import time as _t
    if item and _t.time() - item[-1] < _PENDING_TTL:
        return item
    store.pop(uid, None)
    return None


async def kit_qr(message: types.Message, token: str, user=None):
    """A printed QR sheet: t.me/<bot>?start=kit_<token>. Once bound to an approved stall it works like the stall's
    QR, plus the helper phones written at registration and the sheet's activation code."""
    from sqlalchemy import select
    from app.database import async_session_factory
    from app.models.schemas import VendorKitModel, StoreModel
    user = user or message.from_user
    lang = await _lang_of(user)
    async with async_session_factory() as db:
        kit = (await db.execute(select(VendorKitModel).where(VendorKitModel.token == token[:40]))).scalars().first()
        store = await db.get(StoreModel, kit.store_id) if kit and kit.store_id else None
    if not kit:
        await message.answer(STALL_TEXTS["bad"][lang])
        return
    if kit.status == "revoked":
        await message.answer(KIT_TEXTS["revoked"][lang])
        return
    if kit.status != "bound" or not store:
        await message.answer(KIT_TEXTS["unbound"][lang])
        return
    if store.status == "pending":
        await message.answer(KIT_TEXTS["pending"][lang])
        return
    await stall_qr(message, str(store.id), user=user, kit_id=kit.id, entry=("kit", token))


async def ask_kit_pin(user, kit_id: int) -> str:
    import time as _t
    AWAIT_PIN[str(user.id)] = (kit_id, _t.time())
    return KIT_TEXTS["pin_ask"][await _lang_of(user)]


async def check_kit_pin(message: types.Message) -> bool:
    """A text answering «type the activation code». True when the message was handled here."""
    import hmac as _hmac
    from app.database import async_session_factory
    from app.models.schemas import VendorKitModel, StoreModel
    from app.api.seller import add_member
    from app.services.customer_guard import rate_limit
    from app.bot import notify
    uid = str(message.from_user.id)
    waiting = _pending(AWAIT_PIN, uid)
    text = (message.text or "").strip()
    if not waiting or not re.fullmatch(r"\d{4}", text):
        return False
    lang = await _lang_of(message.from_user)
    kit_id = waiting[0]
    try:
        rate_limit(f"kpin:{uid}", 5, 3600)
        rate_limit(f"kpinkit:{kit_id}", 10, 3600)
    except Exception:
        AWAIT_PIN.pop(uid, None)
        await message.answer(KIT_TEXTS["pin_limit"][lang])
        return True
    async with async_session_factory() as db:
        kit = await db.get(VendorKitModel, kit_id)
        store = await db.get(StoreModel, kit.store_id) if kit and kit.store_id else None
        if not kit or kit.status != "bound" or not store or store.status != "approved":
            AWAIT_PIN.pop(uid, None)
            await message.answer(KIT_TEXTS["revoked"][lang])
            return True
        if not _hmac.compare_digest(text, kit.pin):
            await message.answer(KIT_TEXTS["pin_bad"][lang])
            return True
        user = message.from_user
        await add_member(db, store.id, {"id": user.id, "first_name": user.first_name, "last_name": user.last_name,
                                        "username": user.username}, "helper")
        await db.commit()
        owners = await _stall_owners(db, store)
        store_name = getattr(store, f"name_{lang}", None) or store.name_uz
        stall = store.stall_number
        store_id = store.id
    AWAIT_PIN.pop(uid, None)
    keyboard = None
    if settings.WEBAPP_URL.startswith("https://"):
        keyboard = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(
            text=JOIN_TEXTS["button"][lang], web_app=WebAppInfo(url=f"{settings.WEBAPP_URL}?tab=seller_cabinet&lang={lang}"))]])
    await message.answer(JOIN_TEXTS["ok"][lang].format(store=escape(store_name), stall=escape(stall)),
                         reply_markup=keyboard, parse_mode="HTML")
    # The owner is only told, with one button to take it back (Shuhrat: work at the stall never waits)
    who = " ".join(x for x in (user.first_name, user.last_name) if x) or "—"
    if user.username:
        who += f" (@{user.username})"
    kick = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(
        text="❌ Chiqarib yuborish · Удалить", callback_data=f"kick_{store_id}_{uid}")]])
    for owner in owners - {uid}:
        await notify._send(owner, f"ℹ️ <b>{escape(who)}</b> varaqdagi kod bilan rastangizga yordamchi bo'lib qo'shildi.\n"
                                  f"ℹ️ <b>{escape(who)}</b> вошёл помощником в вашу расту по коду с листа.", kick)
    return True


async def kick_helper(owner_id, store_id: int, helper_id: str) -> bool:
    """The owner's «remove» under the notice: only an owner of this stall, and never an owner."""
    from sqlalchemy import delete
    from app.database import async_session_factory
    from app.models.schemas import StoreModel, StoreMemberModel
    from app.bot import notify
    async with async_session_factory() as db:
        store = await db.get(StoreModel, store_id)
        if not store or str(owner_id) not in await _stall_owners(db, store):
            return False
        from app.api.seller import forget_helper_phone
        await forget_helper_phone(db, store_id, str(helper_id))
        await db.execute(delete(StoreMemberModel).where(StoreMemberModel.store_id == store_id,
                                                        StoreMemberModel.tg_id == str(helper_id),
                                                        StoreMemberModel.role == "helper"))
        await db.commit()
        stall = store.stall_number
    await notify._send(helper_id, f"❌ Rasta egasi sizni {escape(stall)} rastasidan chiqardi · Владелец удалил вас из расты {escape(stall)}")
    return True


async def resume_entry(message: types.Message, user) -> bool:
    """Registration just finished for someone who came by a stall's QR or sheet: open it for them now."""
    item = _pending(PENDING_ENTRY, str(user.id))
    if not item:
        return False
    PENDING_ENTRY.pop(str(user.id), None)
    kind, value, _ = item
    if kind == "kit":
        await kit_qr(message, value, user)
    else:
        await stall_qr(message, value, user=user)
    return True


async def stall_qr(message: types.Message, store_id: str, user=None, kit_id: int = None, entry: tuple = None):
    """The stall's permanent QR (printed and stuck on the stall), or a printed sheet bound to the stall: its people
    go to the cabinet, everyone else to the bot's start page. Someone new who works there asks the owner once, or,
    with a sheet, types its activation code. `user` is who scanned it (the message may be the bot's own)."""
    from sqlalchemy import select
    from app.database import async_session_factory
    from app.models.schemas import StoreModel, StoreMemberModel
    from app.api.auth import normalize_phone
    from app.api.seller import add_member
    from app.api.kits import helper_phone_allowed
    import time as _t
    user = user or message.from_user
    lang = await _lang_of(user)
    uid = str(user.id)
    async with async_session_factory() as db:
        store = await db.get(StoreModel, int(store_id)) if store_id.isdigit() else None
        if not store or store.status != "approved":
            await message.answer(STALL_TEXTS["bad"][lang])
            return
        member = (await db.execute(select(StoreMemberModel).where(
            StoreMemberModel.store_id == store.id, StoreMemberModel.tg_id == uid))).scalars().first()
        is_member = bool(member) or str(store.telegram_chat_id or "") == uid
        if not is_member:
            customer = await get_customer(user.id)
            phone = normalize_phone(customer.phone) if customer and customer.phone else ""
            role = None
            # The stall's registered owner is never asked (Shuhrat): Telegram confirmed this person's own phone at
            # registration, and it is the stall's owner phone, so they become the owner in the bot right away
            if phone and phone == normalize_phone(store.owner_phone):
                role = "owner"
            # A helper whose phone was written down when the stall was registered gets in the same way
            elif phone and await helper_phone_allowed(db, store.id, phone):
                role = "helper"
            if role == "helper":
                from app.models.schemas import StoreHelperPhoneModel
                saved = (await db.execute(select(StoreHelperPhoneModel.name).where(
                    StoreHelperPhoneModel.store_id == store.id, StoreHelperPhoneModel.phone == phone))).scalars().first()
                if saved:
                    user = type("U", (), {"id": user.id, "first_name": saved, "last_name": None, "username": None})()
            if role:
                await add_member(db, store.id, {"id": user.id, "first_name": user.first_name,
                                                "last_name": getattr(user, "last_name", None), "username": getattr(user, "username", None)}, role)
                if role == "owner" and not store.telegram_chat_id:
                    store.telegram_chat_id = uid
                await db.commit()
                is_member = True
        owner_connected = is_member or bool(await _stall_owners(db, store))
    name = escape(getattr(store, f"name_{lang}", None) or store.name_uz)
    url = settings.WEBAPP_URL
    if is_member:
        rows = [[InlineKeyboardButton(text=JOIN_TEXTS["button"][lang], web_app=WebAppInfo(url=f"{url}?tab=seller_cabinet&lang={lang}"))]]
        await message.answer(STALL_TEXTS["member"][lang].format(store=name, stall=escape(store.stall_number)),
                             reply_markup=InlineKeyboardMarkup(inline_keyboard=rows), parse_mode="HTML")
        return
    # Everyone else: the bot's normal start page, like opening the bot (Davlatbek's wish). A registered person also
    # gets a small «I work at this stall» button, so a new helper can ask the owner (with a sheet: or type its code).
    # Someone who still has to register is remembered: the stall opens for them once their phone is shared
    PENDING_ENTRY[uid] = (*(entry or ("stall", str(store.id))), _t.time())
    if await start_customer(message):
        PENDING_ENTRY.pop(uid, None)
        rows = [[InlineKeyboardButton(text=STALL_TEXTS["work"][lang], callback_data=f"jreq_{store.id}")]]
        if kit_id:
            rows.insert(0, [InlineKeyboardButton(text=KIT_TEXTS["pin_button"][lang], callback_data=f"kpin_{kit_id}")])
        hint = STALL_TEXTS["staff_hint" if owner_connected else "phone_mismatch"][lang]
        await message.answer(hint, reply_markup=InlineKeyboardMarkup(inline_keyboard=rows))


async def request_join(user, store_id: int) -> str:
    """«I work at this stall»: the owner gets «add them? yes / no». Returns the key of the answer for the asker."""
    from app.database import async_session_factory
    from app.models.schemas import StoreModel
    from app.bot import notify
    from app.services.customer_guard import rate_limit
    try:
        rate_limit(f"jreq:{user.id}", 3, 3600)
    except Exception:
        return "asked"  # asked enough already; the owner has the earlier messages
    async with async_session_factory() as db:
        store = await db.get(StoreModel, store_id)
        owners = await _stall_owners(db, store) if store else set()
    if not owners:
        return "no_owner"
    who = " ".join(x for x in (user.first_name, getattr(user, "last_name", None)) if x) or "—"
    if getattr(user, "username", None):
        who += f" (@{user.username})"
    text = (f"👷 <b>{escape(who)}</b> rastangizga yordamchi bo'lib qo'shilmoqchi. Qo'shaymi?\n"
            f"👷 <b>{escape(who)}</b> хочет стать помощником вашей расты. Добавить?")
    keyboard = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="✅ Ha · Да", callback_data=f"jok_{store_id}_{user.id}"),
        InlineKeyboardButton(text="❌ Yo'q · Нет", callback_data=f"jno_{store_id}_{user.id}"),
    ]])
    for owner in owners:
        await notify._send(owner, text, keyboard)
    return "asked"


async def decide_join(owner_id, store_id: int, helper_id: str, approve: bool, helper_name: str = "") -> bool:
    """The owner's answer. Only an owner of this stall can add people to it."""
    from app.database import async_session_factory
    from app.models.schemas import StoreModel
    from app.api.seller import add_member
    from app.bot import notify
    async with async_session_factory() as db:
        store = await db.get(StoreModel, store_id)
        if not store or str(owner_id) not in await _stall_owners(db, store):
            return False
        if approve:
            await add_member(db, store.id, {"id": helper_id, "first_name": helper_name or "Yordamchi"}, "helper")
            await db.commit()
        stall = store.stall_number
    if approve:
        url = settings.WEBAPP_URL
        keyboard = InlineKeyboardMarkup(inline_keyboard=[[InlineKeyboardButton(
            text=JOIN_TEXTS["button"]["uz"] + " · Кабинет", web_app=WebAppInfo(url=f"{url}?tab=seller_cabinet"))]])
        await notify._send(helper_id, f"✅ Siz {escape(stall)} rastasiga qo'shildingiz · Вы добавлены в расту {escape(stall)}", keyboard)
    else:
        await notify._send(helper_id, f"❌ Rasta egasi so'rovingizni rad etdi · Владелец расты отклонил запрос ({escape(stall)})")
    return True


async def save_driver_location(message: types.Message):
    """The order id it was written to; 0 for a worker without an order on the way; None for a customer."""
    from app.database import async_session_factory
    from app.services import taxi_control
    from app.services.events import order_changed
    async with async_session_factory() as db:
        order_id = await taxi_control.save_location(db, str(message.from_user.id), message.location.latitude, message.location.longitude)
        await db.commit()
    if order_id:
        order_changed(order_id)
    return order_id


# One link per job for the bazaar's workers: t.me/<bot>?start=seller (sotuvchi), porter (aravachi), taxi, work (all three).
# No pattachi link: only the bozorkom adds pattachi, in Bozorkom → Xodimlar.
# The link opens only the work cabinet; the cabinet itself checks who may enter (seller PIN, Bozorkom approval).
WORK_LINKS = {
    "seller": ("🏪 Sotuvchi kabineti · Кабинет продавца", "tab=seller_cabinet"),
    "porter": ("🛒 Aravachi kabineti · Кабинет аравачи", "tab=porter"),
    "taxi": ("🚕 Taksichi kabineti · Кабинет таксиста", "tab=taxi"),
}
WORK_TEXT = ("👷 <b>Bozor xodimlari uchun · Для работников базара</b>\n"
             "Tugmani bosing — kabinetingiz ochiladi. Birinchi marta bo'lsa, ariza yuboring, bozorkom tasdiqlaydi.\n"
             "Нажмите кнопку — откроется ваш кабинет. Если впервые, отправьте заявку, бозорком подтвердит.")


async def send_work_entry(message: types.Message, role: str):
    roles = [role] if role in WORK_LINKS else list(WORK_LINKS)
    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(text=WORK_LINKS[r][0], web_app=WebAppInfo(url=f"{settings.WEBAPP_URL}?{WORK_LINKS[r][1]}"))] for r in roles
    ])
    await message.answer(WORK_TEXT, reply_markup=keyboard, parse_mode="HTML")


def setup_dispatcher() -> Dispatcher:
    global dp
    dp = Dispatcher()

    @dp.message(CommandStart())
    async def cmd_start(message: types.Message):
        # A helper scanned the owner's QR code: t.me/<bot>?start=join_<token>
        args = (message.text or "").split(maxsplit=1)
        if len(args) > 1 and args[1].startswith("join_"):
            await join_stall(message, args[1][5:])
            return
        # A printed QR sheet bound to a stall at registration: t.me/<bot>?start=kit_<token>
        if len(args) > 1 and args[1].startswith("kit_"):
            await kit_qr(message, args[1][4:])
            return
        # The stall's permanent QR stuck on the stall: t.me/<bot>?start=stall_<id>
        if len(args) > 1 and args[1].startswith("stall_"):
            await stall_qr(message, args[1][6:])
            return
        # A worker's link: straight to the work cabinet, without the customer registration
        if len(args) > 1 and (args[1] in WORK_LINKS or args[1] == "work"):
            await send_work_entry(message, args[1])
            return
        await start_customer(message)

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
        text = REG_TEXTS["help"][lang].format(radius=radius, phone_line=phone_line)
        if not settings.TERMS_ENABLED:
            text = text.split("\n/qoidalar")[0]
        await message.answer(text, parse_mode="HTML")

    @dp.message(Command("qoidalar", "rules", "terms"))
    async def cmd_rules(message: types.Message):
        from app.services import terms
        customer = await get_customer(message.from_user.id)
        lang = (customer.lang if customer else None) or "uz"
        if not settings.TERMS_ENABLED:
            await message.answer(terms.SOON[lang])
            return
        accepted = await terms_accepted(message.from_user.id)
        await message.answer(terms.WARNING[lang], reply_markup=terms_keyboard(lang, with_agree=not accepted), parse_mode="HTML")

    @dp.callback_query(F.data == "terms_ok")
    async def handle_terms_ok(query: types.CallbackQuery):
        await accept_terms(query)

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

    @dp.callback_query(F.data.startswith("jreq_"))
    async def handle_join_request(query: types.CallbackQuery):
        lang = await _lang_of(query.from_user)
        key = await request_join(query.from_user, int(query.data[5:]))
        await query.answer()
        await query.message.answer(STALL_TEXTS[key][lang])

    @dp.callback_query(F.data.startswith("kpin_"))
    async def handle_kit_pin_ask(query: types.CallbackQuery):
        await query.answer()
        await query.message.answer(await ask_kit_pin(query.from_user, int(query.data[5:])), parse_mode="HTML")

    @dp.callback_query(F.data.startswith("kick_"))
    async def handle_kick(query: types.CallbackQuery):
        _, store_id, helper_id = query.data.split("_")
        done = await kick_helper(query.from_user.id, int(store_id), helper_id)
        await query.answer("✅" if done else "❌")
        if done:
            try:
                await query.message.edit_text(f"{query.message.html_text}\n\n<b>❌ Chiqarildi · Удалён</b>", parse_mode="HTML")
            except Exception:
                pass

    @dp.callback_query(F.data.startswith("jok_") | F.data.startswith("jno_"))
    async def handle_join_decision(query: types.CallbackQuery):
        _, store_id, helper_id = query.data.split("_")
        name = ""
        try:
            chat = await query.bot.get_chat(int(helper_id))
            name = " ".join(x for x in (chat.first_name, chat.last_name) if x)
        except Exception:
            pass
        done = await decide_join(query.from_user.id, int(store_id), helper_id, query.data.startswith("jok_"), name)
        await query.answer("✅" if done else "❌")
        if done:
            mark = "✅ Qo'shildi · Добавлен" if query.data.startswith("jok_") else "❌ Rad etildi · Отклонено"
            try:
                await query.message.edit_text(f"{query.message.html_text}\n\n<b>{mark}</b>", parse_mode="HTML")
            except Exception:
                pass

    @dp.callback_query(F.data.startswith("dok_") | F.data.startswith("dno_") | F.data.startswith("dstop_") | F.data.startswith("dpaid_"))
    async def handle_debt_answer(query: types.CallbackQuery):
        """📒 The buyer confirms or rejects a stall's nasiya entry, stops its reminders, or says «💵 To'ladim»."""
        from app.services import debts
        kind, debt_id = query.data.split("_", 1)
        answer = {"dok": "yes", "dno": "no", "dstop": "stop", "dpaid": "paid"}[kind]
        key = await debts.buyer_answer(query.from_user.id, int(debt_id), answer)
        lang = await _lang_of(query.from_user)
        if lang not in debts.BUYER_TEXTS:
            lang = "uz"
        text = debts.BUYER_TEXTS[lang].get(key) if key else None
        await query.answer(text or "—", show_alert=False)
        if text:
            # After «Tasdiqlayman» the message keeps one button: «💵 To'ladim» for the day it is paid
            keyboard = debts.buyer_keyboard(int(debt_id), lang) if key == "confirmed" else None
            try:
                await query.message.edit_text(f"{query.message.html_text}\n\n<b>{text}</b>", parse_mode="HTML", reply_markup=keyboard)
            except Exception:
                pass

    @dp.callback_query(F.data.startswith("dsok_") | F.data.startswith("dsno_"))
    async def handle_debt_claim(query: types.CallbackQuery):
        """📒 The stall answers the buyer's «To'ladim»: «Oldim» closes the debt, «Olmadim» tells the buyer."""
        from app.services import debts
        kind, debt_id = query.data.split("_", 1)
        result = await debts.stall_answer(int(debt_id), kind == "dsok", tg_id=query.from_user.id)
        if result is None:
            await query.answer("—")
            return
        if result.get("answered_before"):
            mark = "✅ Javob berilgan · Уже отвечено" if result["status"] != "open" else "—"
        elif result["status"] == "paid":
            mark = "✅ Yopildi · Закрыто"
        elif kind == "dsno":
            mark = "❌ Mijozga aytildi · Покупателю сообщили"
        else:
            mark = "—"
        await query.answer(mark)
        try:
            await query.message.edit_text(f"{query.message.html_text}\n\n<b>{mark}</b>", parse_mode="HTML")
        except Exception:
            pass

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

    # A driver's live location: Telegram sends the first point as a message and the rest as edits of it
    @dp.message(F.location)
    async def handle_location(message: types.Message):
        order_id = await save_driver_location(message)
        if order_id:
            await message.answer("✅ Joylashuv xaridorga ko'rinmoqda · Покупатель видит, где вы")
        elif order_id == 0:
            await message.answer("Sizda yo'ldagi buyurtma yo'q · У вас нет заказа в пути")

    @dp.edited_message(F.location)
    async def handle_location_update(message: types.Message):
        await save_driver_location(message)

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
        # The activation code from a printed sheet, when the bot asked for it
        if customer.name and await check_kit_pin(message):
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

