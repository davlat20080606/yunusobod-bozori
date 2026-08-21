import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "Yunusobod Dehqon Bozori API"
    APP_ENV: str = "development"
    DATABASE_URL: str = "sqlite+aiosqlite:///./bozor.db"
    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "").replace("HTTP API:", "").strip()
    WEBAPP_URL: str = os.getenv("WEBAPP_URL", "http://localhost:3000").strip()
    ADMIN_SECRET_KEY: str = "yunusobod_secret_2026"
    
    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
# Clean token if loaded from .env
if "HTTP API:" in settings.TELEGRAM_BOT_TOKEN:
    settings.TELEGRAM_BOT_TOKEN = settings.TELEGRAM_BOT_TOKEN.replace("HTTP API:", "").strip()
