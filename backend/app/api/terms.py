"""The platform rules screen in the app: has this Telegram user accepted the current version? Accept it."""
from typing import Optional
from fastapi import APIRouter, Depends, Header, Body
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.api.tg_auth import telegram_user
from app.services import terms
from app.config import settings

router = APIRouter(prefix="/api/terms", tags=["terms"])


@router.get("/status")
async def status(x_telegram_init_data: Optional[str] = Header(None), db: AsyncSession = Depends(get_db)):
    if not settings.TERMS_ENABLED:
        # Rules switched off: nothing to accept, the app shows no rules screen and no link
        return {"version": terms.TERMS_VERSION, "enabled": False, "accepted": True}
    user = telegram_user(x_telegram_init_data)
    return {"version": terms.TERMS_VERSION, "enabled": True,
            "accepted": bool(user) and await terms.has_accepted(db, user["id"])}


@router.post("/accept")
async def accept(lang: str = Body("uz", embed=True), x_telegram_init_data: Optional[str] = Header(None),
                 db: AsyncSession = Depends(get_db)):
    # Outside Telegram there is no account to remember it for: the app keeps it on the device only
    user = telegram_user(x_telegram_init_data)
    if user:
        await terms.accept(db, user["id"], lang, "app")
    return {"version": terms.TERMS_VERSION, "saved": bool(user)}
