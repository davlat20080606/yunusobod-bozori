"""Platform rules (Davlatbek's father and Shuhrat): the bot only connects sellers, customers, aravachi and taxi/couriers.
How to pay (cash, card, nasiya) and who answers for goods and services is up to the users themselves.
Everyone accepts the rules once; the bot remembers who accepted which version and when."""
from datetime import datetime
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schemas import TermsAcceptanceModel

# Change it when the rules change: everybody is asked again. Keep in step with frontend/src/services/terms.js
TERMS_VERSION = "2026-11-16"

WARNING = {
    "uz": (
        "⚠️ <b>DIQQAT!</b>\n\n"
        "Ushbu Bozorbot platformasi bozorda faoliyat ko'rsatayotgan sotuvchi va xaridorlarga oldi-sotdi jarayonini "
        "yengillashtirish va qulaylik yaratish maqsadida yaratilgan.\n\n"
        "• Bot faqat sotuvchi, xaridor, aravakash va taksi/kuryerni bir-biri bilan bog'laydi.\n"
        "• To'lov usulini (naqd, karta yoki nasiya) sotuvchi va xaridor o'zaro kelishib, o'zlari tanlaydi. "
        "Bot hisob-kitobga aralashmaydi.\n"
        "• Mahsulot sifati, to'lov va ko'rsatilgan xizmatlar uchun javobgarlikni foydalanuvchilar "
        "O'zbekiston Respublikasi qonunchiligiga muvofiq o'z zimmasiga oladi.\n\n"
        "«✅ Roziman» tugmasini bosib, siz foydalanish shartlari va maxfiylik siyosatiga rozilik bildirasiz."
    ),
    "ru": (
        "⚠️ <b>ВНИМАНИЕ!</b>\n\n"
        "Платформа Bozorbot создана, чтобы облегчить и сделать удобной куплю-продажу для продавцов и покупателей базара.\n\n"
        "• Бот только связывает продавца, покупателя, аравачи и таксиста/курьера.\n"
        "• Способ оплаты (наличные, карта или в долг/насия) продавец и покупатель выбирают сами, по договорённости. "
        "Бот в расчёты не вмешивается.\n"
        "• За качество товара, оплату и оказанные услуги пользователи отвечают сами, "
        "в соответствии с законодательством Республики Узбекистан.\n\n"
        "Нажимая «✅ Согласен», вы принимаете условия использования и политику конфиденциальности."
    ),
    "en": (
        "⚠️ <b>NOTICE!</b>\n\n"
        "The Bozorbot platform was made to make buying and selling at the bazaar easier for sellers and customers.\n\n"
        "• The bot only connects the seller, the customer, the porter (aravachi) and the taxi/courier.\n"
        "• The seller and the customer choose how to pay (cash, card or credit/nasiya) between themselves. "
        "The bot takes no part in payments.\n"
        "• Users themselves are responsible for the quality of goods, payments and their services, "
        "under the laws of the Republic of Uzbekistan.\n\n"
        "By tapping «✅ I agree» you accept the terms of use and the privacy policy."
    ),
}
AGREE = {"uz": "✅ Roziman", "ru": "✅ Согласен", "en": "✅ I agree"}
READ_ALL = {"uz": "📄 To'liq qoidalar", "ru": "📄 Полные правила", "en": "📄 Full rules"}
ACCEPTED = {"uz": "✅ Qabul qilindi", "ru": "✅ Принято", "en": "✅ Accepted"}
# /qoidalar while the rules are switched off (settings.TERMS_ENABLED)
SOON = {
    "uz": "Foydalanish qoidalari yangilanmoqda va tez orada e'lon qilinadi.",
    "ru": "Правила использования обновляются и скоро будут опубликованы.",
    "en": "The terms of use are being updated and will be published soon.",
}


async def has_accepted(db: AsyncSession, tg_id) -> bool:
    if not tg_id:
        return False
    row = (await db.execute(select(TermsAcceptanceModel.id).where(
        TermsAcceptanceModel.tg_id == str(tg_id), TermsAcceptanceModel.version == TERMS_VERSION))).first()
    return row is not None


async def accept(db: AsyncSession, tg_id, lang: Optional[str], source: str) -> None:
    """Saved once per person and version: who, which rules, when and where (bot or app)."""
    if await has_accepted(db, tg_id):
        return
    db.add(TermsAcceptanceModel(tg_id=str(tg_id), version=TERMS_VERSION, lang=(lang or "uz")[:5], source=source[:10],
                                accepted_at=datetime.utcnow()))
    await db.commit()
