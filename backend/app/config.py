import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "Yunusobod Dehqon Bozori API"
    APP_ENV: str = "development"
    DATABASE_URL: str = "sqlite+aiosqlite:///./bozor.db"
    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "").replace("HTTP API:", "").strip()
    WEBAPP_URL: str = os.getenv("WEBAPP_URL", "http://localhost:3000").strip()
    ADMIN_SECRET_KEY: str = "yunusobod_secret_2026"
    # Bazaar administration PIN for registering new stalls; empty = registration closed
    ADMIN_PIN: str = ""
    # "polling" (local Mac), "webhook" (cloud) or "auto" (webhook when running on Render)
    BOT_MODE: str = "auto"
    # Cloudflare R2 for seller photos/videos; empty = keep them in the database
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET: str = ""
    R2_PUBLIC_URL: str = ""  # e.g. https://img.bozorbot.uz or https://pub-xxx.r2.dev
    
    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
# Clean token pasted with extra text, spaces or line breaks (easy to do in a hosting dashboard)
settings.TELEGRAM_BOT_TOKEN = "".join(settings.TELEGRAM_BOT_TOKEN.replace("HTTP API:", "").split())
settings.DATABASE_URL = settings.DATABASE_URL.strip()
settings.ADMIN_PIN = settings.ADMIN_PIN.strip()

# Render gives every service a permanent public https address
RENDER_EXTERNAL_URL = os.getenv("RENDER_EXTERNAL_URL", "").strip()
if RENDER_EXTERNAL_URL and "localhost" in settings.WEBAPP_URL:
    settings.WEBAPP_URL = RENDER_EXTERNAL_URL
settings.WEBAPP_URL = settings.WEBAPP_URL.rstrip("/")
# Telegram calls the server itself, even when the site is served from Vercel
API_URL = (os.getenv("API_URL", "").strip() or RENDER_EXTERNAL_URL or settings.WEBAPP_URL).rstrip("/")
R2_ENABLED = all([settings.R2_ACCOUNT_ID, settings.R2_ACCESS_KEY_ID, settings.R2_SECRET_ACCESS_KEY, settings.R2_BUCKET, settings.R2_PUBLIC_URL])
settings.R2_PUBLIC_URL = settings.R2_PUBLIC_URL.strip().rstrip("/")

# Neon / Render give "postgres://...?sslmode=require"; SQLAlchemy async needs the asyncpg driver
IS_POSTGRES = settings.DATABASE_URL.startswith(("postgres://", "postgresql://", "postgresql+asyncpg://"))
if IS_POSTGRES:
    url = settings.DATABASE_URL.split("?", 1)[0]
    url = url.replace("postgres://", "postgresql://", 1).replace("postgresql://", "postgresql+asyncpg://", 1)
    settings.DATABASE_URL = url

USE_WEBHOOK = settings.BOT_MODE == "webhook" or (
    settings.BOT_MODE == "auto" and bool(RENDER_EXTERNAL_URL) and settings.WEBAPP_URL.startswith("https://")
)
