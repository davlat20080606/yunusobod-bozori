import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "Yunusobod Dehqon Bozori API"
    APP_ENV: str = "development"
    DATABASE_URL: str = "sqlite+aiosqlite:///./bozor.db"
    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "").replace("HTTP API:", "").strip()
    WEBAPP_URL: str = os.getenv("WEBAPP_URL", "http://localhost:3000").strip()
    ADMIN_SECRET_KEY: str = "yunusobod_secret_2026"
    PORTER_PIN: str = "7777"
    # "polling" (local Mac), "webhook" (cloud) or "auto" (webhook when running on Render)
    BOT_MODE: str = "auto"
    
    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
# Clean token if loaded from .env
if "HTTP API:" in settings.TELEGRAM_BOT_TOKEN:
    settings.TELEGRAM_BOT_TOKEN = settings.TELEGRAM_BOT_TOKEN.replace("HTTP API:", "").strip()

# Render gives every service a permanent public https address
RENDER_EXTERNAL_URL = os.getenv("RENDER_EXTERNAL_URL", "").strip()
if RENDER_EXTERNAL_URL and "localhost" in settings.WEBAPP_URL:
    settings.WEBAPP_URL = RENDER_EXTERNAL_URL
settings.WEBAPP_URL = settings.WEBAPP_URL.rstrip("/")

# Neon / Render give "postgres://...?sslmode=require"; SQLAlchemy async needs the asyncpg driver
IS_POSTGRES = settings.DATABASE_URL.startswith(("postgres://", "postgresql://", "postgresql+asyncpg://"))
if IS_POSTGRES:
    url = settings.DATABASE_URL.split("?", 1)[0]
    url = url.replace("postgres://", "postgresql://", 1).replace("postgresql://", "postgresql+asyncpg://", 1)
    settings.DATABASE_URL = url

USE_WEBHOOK = settings.BOT_MODE == "webhook" or (
    settings.BOT_MODE == "auto" and bool(RENDER_EXTERNAL_URL) and settings.WEBAPP_URL.startswith("https://")
)
