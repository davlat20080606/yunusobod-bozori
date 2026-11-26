import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    APP_NAME: str = "Yunusobod Dehqon Bozori API"
    APP_ENV: str = "development"
    DATABASE_URL: str = "sqlite+aiosqlite:///./bozor.db"
    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "").replace("HTTP API:", "").strip()
    WEBAPP_URL: str = os.getenv("WEBAPP_URL", "http://localhost:3000").strip()
    # Signs seller, worker and Bozorkom sign-ins. Long random text, only in .env / Render, never in the repository.
    # Empty: derived from the bot token (so changing the token also signs everyone out)
    AUTH_SECRET: str = ""
    # Encrypts the nightly database copy in R2 (the bucket is readable by link). Keep a copy in a password manager:
    # without it a backup cannot be opened. Empty = no backups
    BACKUP_KEY: str = ""
    # Bazaar administration PIN for registering new stalls; empty = registration closed
    ADMIN_PIN: str = ""
    # The bot's founder signs into the same Bozorkom panel with their own PIN; empty = no founder sign-in
    FOUNDER_PIN: str = ""
    # The partner (Shuhrat) signs into the same panel with their own PIN; like the founder, they only watch
    PARTNER_PIN: str = ""
    # Platform rules (the «DIQQAT!» screen, the terms page, /qoidalar): off until the official payment gateway
    # is connected and the rules are rewritten for it (Davlatbek, 2026-11-20). TERMS_ENABLED=1 in Render turns them on
    TERMS_ENABLED: bool = False
    # The site's own address: the Render address (…onrender.com) sends visitors and Google here
    SITE_HOST: str = "bozorbot.uz"
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
settings.FOUNDER_PIN = settings.FOUNDER_PIN.strip()
settings.PARTNER_PIN = settings.PARTNER_PIN.strip()

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
# Neon's certificate is publicly signed, so it is checked in full. Other hosts (Supabase's pooler) sign with their
# own CA: the connection is still encrypted, without checking whose certificate it is
DB_SSL = True
if IS_POSTGRES and "neon.tech" not in settings.DATABASE_URL:
    DB_SSL = "require"
# The team server's own Postgres sits on a private docker network next to the app: no SSL there (DB_SSL=off)
if os.getenv("DB_SSL", "").strip().lower() in ("0", "off", "false", "disable"):
    DB_SSL = False
if IS_POSTGRES:
    url = settings.DATABASE_URL.split("?", 1)[0]
    url = url.replace("postgres://", "postgresql://", 1).replace("postgresql://", "postgresql+asyncpg://", 1)
    settings.DATABASE_URL = url

USE_WEBHOOK = settings.BOT_MODE == "webhook" or (
    settings.BOT_MODE == "auto" and bool(RENDER_EXTERNAL_URL) and settings.WEBAPP_URL.startswith("https://")
)
