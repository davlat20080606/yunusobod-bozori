"""📒 Nasiya daftari (Shuhrat, 2026-11-21): a stall's own notebook of goods given on credit.

Rules agreed with Shuhrat:
1. The buyer confirms in the bot («✅ Tasdiqlayman / ❌ Bunday qarz yo'q»): a confirmed debt is an agreement of two.
2. Reminders go only to a buyer who confirmed, at most every 2–3 days, and «🔕 Eslatmang» stops them.
   Until it is paid the stall gets its morning list every day and the buyer a reminder every 3 days (Davlatbek's father).
   The buyer presses «💵 To'ladim»; the stall answers «✅ Oldim» (closes it) or «❌ Olmadim».
3. No «nasiya» payment method in app orders: the seller writes down only people they know.
4. Nothing is deleted: a mistake is «cancelled» with a reason, every step stays in the history.
Only the stall sees its notebook (never the bozorkom). The bot reminds; it never holds or guarantees money.
"""
import asyncio
import logging
from datetime import date, datetime, timedelta
from html import escape
from typing import Optional

from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from sqlalchemy import select

from app.api.auth import normalize_phone
from app.database import async_session_factory
from app.models.schemas import CustomerModel, DebtEventModel, DebtModel, StoreModel

logger = logging.getLogger(__name__)

# Auto reminder to the buyer: on the due day, then every 3 days; the seller's «📲 Eslatish» at most every 2 days
AUTO_EVERY_DAYS = 3
MANUAL_EVERY_DAYS = 2
# One stall cannot flood one person with requests to confirm
MAX_WAITING_PER_BUYER = 3
MAX_OPEN_PER_STALL = 500

NOT_RESPONSIBLE = {
    "uz": "Bu sotuvchining shaxsiy daftari. Bozorbot pulni ushlamaydi va qarzga javob bermaydi.",
    "ru": "Это личная тетрадь продавца. Бозорбот не держит деньги и не отвечает за долг.",
    "en": "This is the seller's own notebook. Bozorbot holds no money and does not guarantee the debt.",
}

BUYER_TEXTS = {
    "uz": {
        "ask": "📒 <b>Nasiya daftariga yozildi</b>\n{stall}\n{note}💰 <b>{amount} so'm</b>\n📅 Qaytarish muddati: {due}\n\n"
               "To'g'rimi? Tasdiqlasangiz, kelishuv shu yerda saqlanadi.",
        "yes": "✅ Tasdiqlayman", "no": "❌ Bunday qarz yo'q",
        "confirmed": "✅ Tasdiqlandi. Muddatda eslatib turamiz.",
        "disputed": "❌ Sotuvchiga «bunday qarz yo'q» deb yubordik.",
        "remind": "⏰ <b>Nasiya eslatmasi</b>\n{stall}\n{note}Qoldi: <b>{left} so'm</b> · muddat: {due}",
        "stop": "🔕 Eslatmang", "stopped": "🔕 Bu nasiya bo'yicha boshqa eslatmaymiz.",
        "payment": "💵 <b>To'lov yozildi: {paid} so'm</b>\n{stall}\nQoldi: <b>{left} so'm</b>",
        "closed": "✅ <b>Nasiya yopildi</b>\n{stall} · {amount} so'm. Rahmat!",
        "cancelled": "↩️ <b>Sotuvchi yozuvni bekor qildi</b>\n{stall} · {amount} so'm",
        "paid_btn": "💵 To'ladim",
        "claimed": "💵 Sotuvchiga yubordik. Pulni olganini tasdiqlasa, nasiya yopiladi.",
        "claim_wait": "⏳ Sotuvchi javobini kutyapmiz.",
        "claim_rejected": "❌ <b>Sotuvchi pulni olmaganini aytdi</b>\n{stall}\nQoldi: <b>{left} so'm</b>\nU bilan gaplashing.",
    },
    "ru": {
        "ask": "📒 <b>Запись в тетрадь насии</b>\n{stall}\n{note}💰 <b>{amount} сум</b>\n📅 Вернуть до: {due}\n\n"
               "Всё верно? Если подтвердите, договорённость сохранится здесь.",
        "yes": "✅ Подтверждаю", "no": "❌ Такого долга нет",
        "confirmed": "✅ Подтверждено. Напомним, когда подойдёт срок.",
        "disputed": "❌ Передали продавцу: «такого долга нет».",
        "remind": "⏰ <b>Напоминание о насии</b>\n{stall}\n{note}Осталось: <b>{left} сум</b> · срок: {due}",
        "stop": "🔕 Не напоминать", "stopped": "🔕 Больше не будем напоминать об этой насии.",
        "payment": "💵 <b>Записана оплата: {paid} сум</b>\n{stall}\nОсталось: <b>{left} сум</b>",
        "closed": "✅ <b>Насия закрыта</b>\n{stall} · {amount} сум. Спасибо!",
        "cancelled": "↩️ <b>Продавец отменил запись</b>\n{stall} · {amount} сум",
        "paid_btn": "💵 Я оплатил(а)",
        "claimed": "💵 Передали продавцу. Когда он подтвердит, что получил деньги, насия закроется.",
        "claim_wait": "⏳ Ждём ответа продавца.",
        "claim_rejected": "❌ <b>Продавец говорит, что не получил деньги</b>\n{stall}\nОсталось: <b>{left} сум</b>\nПоговорите с ним.",
    },
    "en": {
        "ask": "📒 <b>Written in the credit notebook</b>\n{stall}\n{note}💰 <b>{amount} sum</b>\n📅 Pay back by: {due}\n\n"
               "Is this right? Once you confirm, the agreement is kept here.",
        "yes": "✅ I confirm", "no": "❌ I owe no such debt",
        "confirmed": "✅ Confirmed. We will remind you when it is due.",
        "disputed": "❌ We told the seller: «no such debt».",
        "remind": "⏰ <b>Credit reminder</b>\n{stall}\n{note}Left: <b>{left} sum</b> · due: {due}",
        "stop": "🔕 Stop reminding", "stopped": "🔕 No more reminders about this debt.",
        "payment": "💵 <b>Payment recorded: {paid} sum</b>\n{stall}\nLeft: <b>{left} sum</b>",
        "closed": "✅ <b>Debt closed</b>\n{stall} · {amount} sum. Thank you!",
        "cancelled": "↩️ <b>The seller cancelled the entry</b>\n{stall} · {amount} sum",
        "paid_btn": "💵 I paid",
        "claimed": "💵 Sent to the seller. Once they confirm they got the money, the debt closes.",
        "claim_wait": "⏳ Waiting for the seller's answer.",
        "claim_rejected": "❌ <b>The seller says the money did not arrive</b>\n{stall}\nLeft: <b>{left} sum</b>\nPlease talk to them.",
    },
}

NOTEBOOK_BUTTON = "📒 Daftarni ochish · Открыть тетрадь"


def today_tashkent(now: Optional[datetime] = None) -> date:
    return ((now or datetime.utcnow()) + timedelta(hours=5)).date()


def money(value) -> str:
    return f"{round(value or 0):,}".replace(",", " ")


def clean_phone(raw: Optional[str]) -> Optional[str]:
    """'90 123 45 67' -> '+998 90 123 45 67'; None when empty; ValueError when it is not a whole number."""
    if not raw or not raw.strip():
        return None
    digits = normalize_phone(raw)
    if len(digits) != 9:
        raise ValueError("phone")
    return f"+998 {digits[0:2]} {digits[2:5]} {digits[5:7]} {digits[7:9]}"


def left(debt: DebtModel) -> int:
    return max(0, (debt.amount or 0) - (debt.paid or 0))


def as_dict(debt: DebtModel, today: Optional[date] = None, events=None) -> dict:
    today = today or today_tashkent()
    late = (today - debt.due_date).days if debt.status == "open" else 0
    d = {
        "id": debt.id, "customer_name": debt.customer_name, "customer_phone": debt.customer_phone,
        "amount": debt.amount, "paid": debt.paid or 0, "left": left(debt), "note": debt.note or "",
        "due_date": debt.due_date.isoformat(), "days_late": late, "status": debt.status, "confirm": debt.confirm,
        "in_bot": bool(debt.customer_tg_id), "reminders_off": bool(debt.reminders_off),
        "reminded_on": debt.reminded_on.isoformat() if debt.reminded_on else None,
        "cancel_reason": debt.cancel_reason or "", "order_id": debt.order_id,
        "paid_claim": bool(debt.paid_claim_at) and debt.status == "open",
        "created_at": debt.created_at.isoformat() if debt.created_at else None,
        "closed_at": debt.closed_at.isoformat() if debt.closed_at else None,
    }
    if events is not None:
        d["events"] = [{"kind": e.kind, "amount": e.amount, "note": e.note or "", "actor": e.actor,
                        "at": (e.created_at + timedelta(hours=5)).isoformat(timespec="minutes")} for e in events]
    return d


def log(db, debt: DebtModel, kind: str, actor: str = "seller", amount: Optional[int] = None, note: Optional[str] = None):
    db.add(DebtEventModel(debt_id=debt.id, kind=kind, actor=actor, amount=amount, note=note))


async def find_buyer(db, phone: Optional[str]) -> Optional[CustomerModel]:
    """The registered bot user with this phone (registration only accepts a person's own number)."""
    if not phone:
        return None
    wanted = normalize_phone(phone)
    for customer in (await db.execute(select(CustomerModel).where(CustomerModel.phone.is_not(None)))).scalars():
        if normalize_phone(customer.phone) == wanted:
            return customer
    return None


def _stall(store: StoreModel) -> str:
    return f"🏪 {escape(store.stall_number)} · {escape(store.owner_name)}"


def _note(debt: DebtModel) -> str:
    return f"📝 {escape(debt.note)}\n" if debt.note else ""


async def _buyer_lang(db, debt: DebtModel) -> str:
    customer = (await db.execute(select(CustomerModel).where(CustomerModel.tg_id == debt.customer_tg_id))).scalars().first()
    return (customer.lang if customer and customer.lang in BUYER_TEXTS else None) or "uz"


def _due(lang: str, d: date) -> str:
    return d.strftime("%d.%m.%Y")


# ---------- Telegram messages ----------

async def _send(chat_id, text: str, keyboard=None):
    from app.bot.notify import _send as send
    await send(chat_id, text, keyboard)


async def send_confirm_request(debt_id: int):
    async with async_session_factory() as db:
        debt = await db.get(DebtModel, debt_id)
        if not debt or not debt.customer_tg_id or debt.status != "open":
            return
        store = await db.get(StoreModel, debt.store_id)
        lang = await _buyer_lang(db, debt)
    t = BUYER_TEXTS[lang]
    text = t["ask"].format(stall=_stall(store), note=_note(debt), amount=money(debt.amount), due=_due(lang, debt.due_date))
    text += f"\n\n<i>{NOT_RESPONSIBLE[lang]}</i>"
    keyboard = InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text=t["yes"], callback_data=f"dok_{debt.id}"),
        InlineKeyboardButton(text=t["no"], callback_data=f"dno_{debt.id}"),
    ]])
    await _send(debt.customer_tg_id, text, keyboard)


async def _buyer_message(debt_id: int, key: str, **extra):
    async with async_session_factory() as db:
        debt = await db.get(DebtModel, debt_id)
        if not debt or not debt.customer_tg_id or debt.confirm not in ("waiting", "confirmed"):
            return
        store = await db.get(StoreModel, debt.store_id)
        lang = await _buyer_lang(db, debt)
    t = BUYER_TEXTS[lang]
    text = t[key].format(stall=_stall(store), note=_note(debt), amount=money(debt.amount), left=money(left(debt)),
                         due=_due(lang, debt.due_date), **extra)
    keyboard = None
    if key == "remind":
        text += f"\n\n<i>{NOT_RESPONSIBLE[lang]}</i>"
        keyboard = buyer_keyboard(debt.id, lang, stop=True)
    elif key in ("payment", "claim_rejected") and debt.status == "open" and debt.confirm == "confirmed":
        keyboard = buyer_keyboard(debt.id, lang)
    await _send(debt.customer_tg_id, text, keyboard)


async def _seller_message(debt_id: int, text_fn, keyboard=None):
    from app.bot.notify import _stall_chats, _webapp_button
    async with async_session_factory() as db:
        debt = await db.get(DebtModel, debt_id)
        if not debt:
            return
        chats = await _stall_chats(db, debt.store_id)
    keyboard = keyboard or _webapp_button(NOTEBOOK_BUTTON, "tab=seller_cabinet&nasiya=1")
    await asyncio.gather(*[_send(chat, text_fn(debt), keyboard) for chat in chats])


def buyer_keyboard(debt_id: int, lang: str, stop: bool = False) -> InlineKeyboardMarkup:
    """«💵 To'ladim» under every message about an open, confirmed debt (and «🔕 Eslatmang» under reminders)."""
    t = BUYER_TEXTS[lang]
    rows = [[InlineKeyboardButton(text=t["paid_btn"], callback_data=f"dpaid_{debt_id}")]]
    if stop:
        rows.append([InlineKeyboardButton(text=t["stop"], callback_data=f"dstop_{debt_id}")])
    return InlineKeyboardMarkup(inline_keyboard=rows)


def stall_claim_keyboard(debt_id: int) -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(inline_keyboard=[[
        InlineKeyboardButton(text="✅ Oldim · Получил", callback_data=f"dsok_{debt_id}"),
        InlineKeyboardButton(text="❌ Olmadim · Не получал", callback_data=f"dsno_{debt_id}"),
    ]])


def _background(coro):
    try:
        asyncio.get_running_loop().create_task(coro)
    except RuntimeError:
        pass


def notify_confirm_request(debt_id: int):
    _background(send_confirm_request(debt_id))


def notify_buyer(debt_id: int, key: str, **extra):
    _background(_buyer_message(debt_id, key, **extra))


# ---------- The buyer's answers in the bot ----------

async def buyer_answer(tg_id, debt_id: int, answer: str) -> Optional[str]:
    """answer: yes | no | stop. Only the buyer the debt was sent to can answer. Returns the text key to show."""
    async with async_session_factory() as db:
        debt = await db.get(DebtModel, debt_id)
        if not debt or debt.customer_tg_id != str(tg_id):
            return None
        if answer == "paid":
            if debt.status != "open" or debt.confirm != "confirmed":
                return None
            if debt.paid_claim_at:
                return "claim_wait"
            debt.paid_claim_at = datetime.utcnow()
            log(db, debt, "claimed", actor="buyer", amount=left(debt))
            await db.commit()
            name, rest, note = debt.customer_name, left(debt), debt.note
            _background(_seller_message(debt_id, lambda d: (
                f"💵 <b>{escape(name)}: «to'ladim» · «я оплатил(а)»</b>\n{money(rest)} so'm"
                + (f" · {escape(note)}" if note else "")
                + "\nPulni oldingizmi? · Деньги получили?"), stall_claim_keyboard(debt_id)))
            return "claimed"
        if answer == "stop":
            if not debt.reminders_off:
                debt.reminders_off = True
                log(db, debt, "reminders_off", actor="buyer")
                await db.commit()
            return "stopped"
        if debt.confirm != "waiting" or debt.status != "open":
            # Already answered (or the seller cancelled): the first answer stands
            return "confirmed" if debt.confirm == "confirmed" else ("disputed" if debt.confirm == "disputed" else None)
        debt.confirm = "confirmed" if answer == "yes" else "disputed"
        log(db, debt, debt.confirm, actor="buyer")
        await db.commit()
        name, amount, note = debt.customer_name, debt.amount, debt.note
    if answer == "yes":
        _background(_seller_message(debt_id, lambda d: (
            f"✅ <b>{escape(name)} nasiyani tasdiqladi · подтвердил(а) долг</b>\n{money(amount)} so'm"
            + (f" · {escape(note)}" if note else ""))))
        return "confirmed"
    _background(_seller_message(debt_id, lambda d: (
        f"❌ <b>{escape(name)} bu nasiyani tan olmadi · не признал(а) этот долг</b>\n{money(amount)} so'm"
        + (f" · {escape(note)}" if note else "")
        + "\nMijoz bilan gaplashing · Поговорите с покупателем")))
    return "disputed"


async def stall_answer(debt_id: int, accept: bool, store_id: Optional[int] = None, tg_id=None) -> Optional[dict]:
    """The stall answers the buyer's «To'ladim»: «Oldim» closes the debt with what was left, «Olmadim» tells the buyer.
    From the cabinet (store_id) or from the bot (tg_id of someone who works at that stall)."""
    from app.bot.notify import _stall_chats
    async with async_session_factory() as db:
        debt = await db.get(DebtModel, debt_id)
        if not debt or (store_id is not None and debt.store_id != store_id):
            return None
        if tg_id is not None and str(tg_id) not in await _stall_chats(db, debt.store_id):
            return None
        if debt.status != "open" or not debt.paid_claim_at:
            return {**as_dict(debt), "answered_before": True}
        debt.paid_claim_at = None
        if accept:
            rest = left(debt)
            debt.paid = debt.amount
            debt.status = "paid"
            debt.closed_at = datetime.utcnow()
            log(db, debt, "payment", amount=rest, note="to'ladim")
        else:
            log(db, debt, "claim_rejected")
        await db.commit()
        await db.refresh(debt)
        result = as_dict(debt)
    notify_buyer(debt_id, "closed" if accept else "claim_rejected")
    return result


async def link_new_buyer(tg_id, phone: str) -> int:
    """A buyer who joins the bot later gets the requests waiting for their phone (debts written while they were not in the bot)."""
    wanted = normalize_phone(phone)
    found = []
    async with async_session_factory() as db:
        for debt in (await db.execute(select(DebtModel).where(DebtModel.status == "open", DebtModel.confirm == "none",
                                                             DebtModel.customer_tg_id.is_(None),
                                                             DebtModel.customer_phone.is_not(None)))).scalars():
            if normalize_phone(debt.customer_phone) == wanted:
                debt.customer_tg_id = str(tg_id)
                debt.confirm = "waiting"
                log(db, debt, "sent", actor="system")
                found.append(debt.id)
        await db.commit()
    for debt_id in found:
        await send_confirm_request(debt_id)
    return len(found)


# ---------- Every morning ----------

def due_for_auto_reminder(debt: DebtModel, today: date) -> bool:
    if debt.status != "open" or debt.confirm != "confirmed" or debt.reminders_off or not debt.customer_tg_id:
        return False
    if debt.paid_claim_at:
        return False  # the buyer says it is paid: wait for the stall
    if debt.due_date > today:
        return False
    return debt.reminded_on is None or (today - debt.reminded_on).days >= AUTO_EVERY_DAYS


async def morning(now: Optional[datetime] = None) -> dict:
    """The stall gets what is due today and what is late; confirmed buyers get their reminder."""
    from app.bot.notify import _stall_chats, _webapp_button
    today = today_tashkent(now)
    by_store, reminders = {}, []
    async with async_session_factory() as db:
        debts = (await db.execute(select(DebtModel).where(
            DebtModel.status == "open", (DebtModel.due_date <= today) | DebtModel.paid_claim_at.is_not(None))
            .order_by(DebtModel.due_date))).scalars().all()
        for debt in debts:
            by_store.setdefault(debt.store_id, []).append(debt)
            if due_for_auto_reminder(debt, today):
                debt.reminded_on = today
                log(db, debt, "reminded", actor="system")
                reminders.append(debt.id)
        await db.commit()
        digests = []
        for store_id, items in by_store.items():
            chats = await _stall_chats(db, store_id)
            if chats:
                digests.append((chats, digest_text(items, today)))
    keyboard = _webapp_button(NOTEBOOK_BUTTON, "tab=seller_cabinet&nasiya=1")
    for chats, text in digests:
        await asyncio.gather(*[_send(chat, text, keyboard) for chat in chats])
    for debt_id in reminders:
        await _buyer_message(debt_id, "remind")
    return {"stalls": len(digests), "reminders": len(reminders)}


def digest_text(items, today: date) -> str:
    claims = [d for d in items if d.paid_claim_at]
    items = [d for d in items if d.due_date <= today and not d.paid_claim_at]
    due = [d for d in items if d.due_date == today]
    late = [d for d in items if d.due_date < today]
    lines = ["📒 <b>Nasiya daftari · Тетрадь насии</b>"]
    if claims:
        lines.append(f"💵 «To'ladim» deganlar · Говорят «оплатил»: <b>{len(claims)}</b> — tasdiqlang · подтвердите")
    if due:
        lines.append(f"⏰ Bugun muddat · Срок сегодня: <b>{len(due)}</b> · {money(sum(left(d) for d in due))} so'm")
    if late:
        lines.append(f"🔴 Kechikkan · Просрочено: <b>{len(late)}</b> · {money(sum(left(d) for d in late))} so'm")
    lines.append("")
    for d in sorted(items, key=lambda d: d.due_date)[:8]:
        days = (today - d.due_date).days
        when = f"{days} kun kechikdi · {days} дн." if days else "bugun · сегодня"
        lines.append(f"• {escape(d.customer_name)} — {money(left(d))} so'm ({when})")
    if len(items) > 8:
        lines.append(f"… +{len(items) - 8}")
    return "\n".join(lines)
