import os
import json
import logging
import asyncio
from pathlib import Path
from typing import List
from contextlib import asynccontextmanager
import hashlib
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, Response, HTTPException, Depends
from aiogram import types as tg_types
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from aiogram.types import MenuButtonWebApp, WebAppInfo
from app.config import settings, USE_WEBHOOK
from app.database import engine, Base, get_db
from app.models.schemas import MediaModel
from app.services.seed_data import init_db_and_seed
from app.api import stores, products, seller, orders, stats, porter
from app.bot.bot import setup_dispatcher, get_bot

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("yunusobod_app")

# WebSocket Connection Manager for Real-Time Price & Order updates
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_text(json.dumps(message))
            except Exception:
                pass

ws_manager = ConnectionManager()
bot_task: asyncio.Task = None
bot_dp = None

WEBHOOK_PATH = "/api/telegram/webhook"
# Telegram sends this secret back with every update, so strangers cannot post fake updates
WEBHOOK_SECRET = hashlib.sha256(f"webhook:{settings.TELEGRAM_BOT_TOKEN}".encode()).hexdigest()[:48]

@asynccontextmanager
async def lifespan(app: FastAPI):
    global bot_task, bot_dp
    # 1. Initialize SQLite tables & seed bazaar data
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    try:
        await init_db_and_seed()
        logger.info("✅ Database seeded with authentic Yunusobod stores & fresh products.")
    except Exception as e:
        logger.error(f"Seeding notice: {e}")

    # 2. Start Telegram Bot polling in background
    bot = get_bot()
    if bot:
        dp = setup_dispatcher()
        bot_dp = dp

        # If the bot already runs in the cloud, a local copy must not take it over
        cloud_url = ""
        if not USE_WEBHOOK:
            try:
                cloud_url = (await bot.get_webhook_info()).url or ""
            except Exception as e:
                logger.warning(f"Webhook check note: {e}")
            if cloud_url:
                logger.warning(f"⚠️ Bot is running in the cloud ({cloud_url}); local copy will not answer Telegram.")

        # Keep the Telegram menu button pointing at the current site address
        if settings.WEBAPP_URL.startswith("https://") and not cloud_url:
            try:
                await bot.set_chat_menu_button(menu_button=MenuButtonWebApp(text="🛒 Bozor", web_app=WebAppInfo(url=settings.WEBAPP_URL)))
            except Exception as e:
                logger.warning(f"Menu button note: {e}")

        async def run_bot_polling():
            try:
                await bot.delete_webhook(drop_pending_updates=True)
                logger.info(f"🤖 Telegram Bot 24/7 started polling!")
                await dp.start_polling(bot)
            except Exception as e:
                logger.warning(f"Bot polling note: {e}")

        if USE_WEBHOOK:
            # Cloud mode: Telegram calls us, which also wakes a sleeping free server
            try:
                await bot.set_webhook(
                    url=f"{settings.WEBAPP_URL}{WEBHOOK_PATH}",
                    secret_token=WEBHOOK_SECRET,
                    allowed_updates=["message", "callback_query"]
                )
                logger.info(f"🤖 Telegram Bot webhook set: {settings.WEBAPP_URL}{WEBHOOK_PATH}")
            except Exception as e:
                logger.error(f"Webhook setup failed: {e}")
        elif not cloud_url:
            bot_task = asyncio.create_task(run_bot_polling())

    yield

    # Teardown
    if bot_task:
        bot_task.cancel()
    bot = get_bot()
    if bot:
        await bot.session.close()

from fastapi.middleware.gzip import GZipMiddleware

app = FastAPI(
    title=settings.APP_NAME,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Enable ultra-fast GZip compression for mobile networks (3G/4G/5G)
app.add_middleware(GZipMiddleware, minimum_size=500)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers
app.include_router(stores.router)
app.include_router(products.router)
app.include_router(seller.router)
app.include_router(orders.router)
app.include_router(stats.router)
app.include_router(porter.router)

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME, "env": settings.APP_ENV}

@app.post(WEBHOOK_PATH)
async def telegram_webhook(request: Request):
    if request.headers.get("X-Telegram-Bot-Api-Secret-Token") != WEBHOOK_SECRET:
        raise HTTPException(status_code=403)
    bot = get_bot()
    if not bot or not bot_dp:
        raise HTTPException(status_code=503)
    update = tg_types.Update.model_validate(await request.json(), context={"bot": bot})
    try:
        await bot_dp.feed_update(bot, update)
    except Exception as e:
        # Answer 200 anyway, otherwise Telegram keeps re-sending the same update
        logger.error(f"Bot update error: {e}")
    return {"ok": True}

@app.websocket("/ws/updates")
async def websocket_endpoint(websocket: WebSocket):
    await ws_manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            await websocket.send_text(json.dumps({"type": "ack", "received": data}))
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)

# Serve Uploaded Media (Photos & Videos) from the database; older files may still be on disk
UPLOAD_DIR = Path(__file__).parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

@app.get("/uploads/{filename}")
async def serve_upload(filename: str, request: Request, db: AsyncSession = Depends(get_db)):
    res = await db.execute(select(MediaModel).where(MediaModel.filename == filename))
    media = res.scalars().first()
    if not media:
        disk_path = (UPLOAD_DIR / filename).resolve()
        if disk_path.parent == UPLOAD_DIR.resolve() and disk_path.is_file():
            return FileResponse(str(disk_path))
        raise HTTPException(status_code=404)

    data = media.data
    headers = {"Accept-Ranges": "bytes", "Cache-Control": "public, max-age=31536000, immutable"}
    # iPhone video playback needs byte-range support
    range_header = request.headers.get("range", "")
    if range_header.startswith("bytes="):
        start_s, _, end_s = range_header[6:].split(",")[0].partition("-")
        try:
            start = int(start_s) if start_s else max(0, len(data) - int(end_s))
            end = min(int(end_s), len(data) - 1) if start_s and end_s else len(data) - 1
        except ValueError:
            start, end = 0, len(data) - 1
        if start >= len(data) or start > end:
            return Response(status_code=416, headers={"Content-Range": f"bytes */{len(data)}"})
        headers["Content-Range"] = f"bytes {start}-{end}/{len(data)}"
        return Response(content=data[start:end + 1], status_code=206, media_type=media.content_type, headers=headers)
    return Response(content=data, media_type=media.content_type, headers=headers)

# Serve React Frontend Static Files (Production Build)
FRONTEND_DIST = Path(__file__).parent.parent.parent / "frontend" / "dist"
if FRONTEND_DIST.exists():
    if (FRONTEND_DIST / "assets").exists():
        app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIST / "assets")), name="assets")

    # Catch-all SPA route for any page refresh or deep link
    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/") or full_path.startswith("ws/") or full_path.startswith("uploads/"):
            return {"error": "Not Found"}
        file_path = (FRONTEND_DIST / full_path).resolve()
        if file_path.is_relative_to(FRONTEND_DIST.resolve()) and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_DIST / "index.html"))
