import os
import json
import logging
import asyncio
from pathlib import Path
from typing import List
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.config import settings
from app.database import engine, Base
from app.services.seed_data import init_db_and_seed
from app.api import stores, products, seller, orders, stats
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

@asynccontextmanager
async def lifespan(app: FastAPI):
    global bot_task
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
        async def run_bot_polling():
            try:
                await bot.delete_webhook(drop_pending_updates=True)
                logger.info(f"🤖 Telegram Bot 24/7 started polling!")
                await dp.start_polling(bot)
            except Exception as e:
                logger.warning(f"Bot polling note: {e}")

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

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "app": settings.APP_NAME, "env": settings.APP_ENV}

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

# Serve Uploaded Media (Photos & Videos)
UPLOAD_DIR = Path(__file__).parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

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
        file_path = FRONTEND_DIST / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(FRONTEND_DIST / "index.html"))
