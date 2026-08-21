import asyncio
import logging
from aiogram import Bot, Dispatcher
from app.config import settings
from app.bot.bot import setup_dispatcher

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("yunusobod_bot")

async def main():
    if not settings.TELEGRAM_BOT_TOKEN or settings.TELEGRAM_BOT_TOKEN.startswith("7123456789"):
        print("\n" + "="*60)
        print("⚠️  DIQQAT / ВНИМАНИЕ: Telegram Bot Token kiritilmagan!")
        print("="*60)
        print("1. Telegramda @BotFather ga kiring va /newbot buyrug'ini bering.")
        print("2. Olingan tokenni `backend/.env` faylidagi TELEGRAM_BOT_TOKEN ga yozing.")
        print("   Misol: TELEGRAM_BOT_TOKEN=\"7891234567:AAHdf829jf_df923...\"")
        print("="*60 + "\n")
        return

    print("🚀 Telegram Bot ishga tushmoqda...")
    bot = Bot(token=settings.TELEGRAM_BOT_TOKEN)
    dp = setup_dispatcher()
    
    try:
        # Delete webhook before polling
        await bot.delete_webhook(drop_pending_updates=True)
        print(f"✅ Bot faollashdi! Telegramda /start bosing.")
        await dp.start_polling(bot)
    finally:
        await bot.session.close()

if __name__ == "__main__":
    asyncio.run(main())
