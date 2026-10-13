"""Bazaar settings that the administration can change: delivery radius, patta amount."""
import math
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.schemas import SettingModel

# Yunusobod Dehqon Bozori, Tashkent
BAZAAR_LAT = 41.36467
BAZAAR_LNG = 69.29089

DEFAULTS = {
    "delivery_radius_km": "3",
    "patta_amount": "20000",
    "admin_tg_id": "",
}


async def get_setting(db: AsyncSession, key: str) -> str:
    row = await db.get(SettingModel, key)
    return row.value if row else DEFAULTS[key]


async def set_setting(db: AsyncSession, key: str, value: str):
    row = await db.get(SettingModel, key)
    if row:
        row.value = value
    else:
        db.add(SettingModel(key=key, value=value))
    await db.commit()


def distance_km(lat: float, lng: float) -> float:
    """Straight-line distance from the bazaar (haversine)."""
    r = 6371.0
    p1, p2 = math.radians(BAZAAR_LAT), math.radians(lat)
    dp, dl = math.radians(lat - BAZAAR_LAT), math.radians(lng - BAZAAR_LNG)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))
