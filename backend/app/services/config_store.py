"""Bazaar settings that the administration can change: delivery radius, patta amount, help phone."""
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
    "support_phone": "",
    # Customer pays the aravachi for carrying, and the taxi for the ride home
    "porter_fee": "5000",
    "taxi_fee": "10000",
    # Fake-order protection: a customer who has not received an order yet gets one open order and a cap
    "max_open_orders": "3",
    "new_customer_max_open": "1",
    "new_customer_max_total": "500000",
    "orders_per_10_min": "10",
    # Hour (Tashkent) when stalls are asked "what do you have today?"; the day it was last sent
    "morning_stock_hour": "7",
    "morning_stock_sent": "",
}

# Where an aravachi hands the order to the customer or the taxi
HANDOFF_POINTS = [
    {"id": "main_gate", "name_uz": "Asosiy darvoza", "name_ru": "Главные ворота", "name_en": "Main gate"},
    {"id": "parking", "name_uz": "Avtoturargoh", "name_ru": "Парковка", "name_en": "Parking"},
    {"id": "back_gate", "name_uz": "Orqa darvoza", "name_ru": "Задние ворота", "name_en": "Back gate"},
]
HANDOFF_POINT_IDS = {p["id"] for p in HANDOFF_POINTS}


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
