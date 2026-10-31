"""Taxi control: the driver keeps his word about the gate, the trip does not drag on, and the customer can see the car.

Gate: when taking an order the driver says in how many minutes he will be at the gate (taxi_eta_at). If he has
not taken the bag («Qabul qildim») `taxi_gate_grace_min` after that, the order is taken from him and offered
to every taxi again, and he gets an incident. A driver who cannot come may give the order back himself.
After `taxi_reassign_alert` reassignments of one order the Bozorkom is told: something is wrong with it.

Trip: `taxi_trip_max_min` after the bag left the gate the order should be delivered; if not, the Bozorkom and
the customer are warned once.

Where: the driver shares his Telegram live location with the bot; each update is written to his order and
the customer's tracker shows «Taksi qayerda».
"""
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.schemas import OrderModel, StaffModel, StaffIncidentModel
from app.services.config_store import get_setting
from app.services.order_log import log_event

INCIDENT_DAYS = 30
# Live location comes every few seconds; the database and the trackers do not need every point
LOCATION_EVERY_SECONDS = 10
# An old position is worse than none: the customer would look for the car in the wrong place
LOCATION_FRESH_MINUTES = 10


async def gate_deadline(db: AsyncSession, order: OrderModel) -> Optional[datetime]:
    if not order.taxi_eta_at:
        return None
    return order.taxi_eta_at + timedelta(minutes=int(await get_setting(db, "taxi_gate_grace_min")))


def add_incident(db: AsyncSession, staff: Optional[StaffModel], order: OrderModel, kind: str):
    if staff:
        db.add(StaffIncidentModel(staff_id=staff.id, order_id=order.id, kind=kind))


async def release(db: AsyncSession, order: OrderModel, staff: Optional[StaffModel], kind: str) -> bool:
    """The order goes back to «ready at the gate, no taxi». Returns True when the Bozorkom should hear about it."""
    add_incident(db, staff, order, kind)
    log_event(order, "taxi_released", reason=kind, taxi=order.taxi_phone)
    order.taxi_name = None
    order.taxi_phone = None
    order.taxi_eta_at = None
    order.taxi_taken_at = None
    order.taxi_lat = order.taxi_lng = order.taxi_loc_at = None
    order.taxi_reassign_count = (order.taxi_reassign_count or 0) + 1
    return order.taxi_reassign_count >= int(await get_setting(db, "taxi_reassign_alert"))


def fresh_location(order: OrderModel, now: Optional[datetime] = None) -> bool:
    return bool(order.taxi_loc_at and order.taxi_lat is not None
                and (now or datetime.utcnow()) - order.taxi_loc_at <= timedelta(minutes=LOCATION_FRESH_MINUTES))


async def save_location(db: AsyncSession, tg_id: str, lat: float, lng: float, now: Optional[datetime] = None) -> Optional[int]:
    """A driver's live location, written to the order he is driving.
    Returns the order id; 0 for a worker with nothing to write to (no order on the way, or too soon); None for anyone else."""
    now = now or datetime.utcnow()
    staff = (await db.execute(select(StaffModel).where(
        StaffModel.tg_id == str(tg_id), StaffModel.role.in_(["taxi", "porter"]), StaffModel.status == "approved"
    ))).scalars().first()
    if not staff:
        return None
    # A taxi on the way to the gate or to the customer; an aravachi driving the order himself
    orders = (await db.execute(select(OrderModel).where(
        OrderModel.status.in_(["handed_over", "on_the_way"]),
        (OrderModel.taxi_phone == staff.phone) | ((OrderModel.porter_phone == staff.phone) & OrderModel.taxi_phone.is_(None)),
    ))).scalars().all()
    if staff.role == "porter":
        orders = [o for o in orders if o.status == "on_the_way"]
    saved = 0
    for order in orders:
        if order.taxi_loc_at and (now - order.taxi_loc_at).total_seconds() < LOCATION_EVERY_SECONDS:
            continue
        order.taxi_lat, order.taxi_lng, order.taxi_loc_at = lat, lng, now
        saved = order.id
    return saved


async def incident_counts(db: AsyncSession) -> dict:
    """{staff_id: {kind: count}} for the last month."""
    since = datetime.utcnow() - timedelta(days=INCIDENT_DAYS)
    rows = (await db.execute(select(StaffIncidentModel.staff_id, StaffIncidentModel.kind)
                             .where(StaffIncidentModel.created_at >= since))).all()
    counts = {}
    for staff_id, kind in rows:
        counts.setdefault(staff_id, {}).setdefault(kind, 0)
        counts[staff_id][kind] += 1
    return counts
