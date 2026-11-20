"""The founders' monitoring tab (Davlatbek and Shuhrat): numbers for any day, week or month with the period before
for comparison, a live feed of what happens, what goes wrong, and whether the system itself is healthy.

Read only. Like analytics, everything is counted in Python from the period's rows (hundreds a month, not millions).
"""
import time
from datetime import date, datetime, timedelta
from typing import Optional

from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.schemas import (
    OrderModel, OrderEventModel, StoreModel, StaffModel, CustomerModel, CustomerBlockModel, ReviewModel,
    StaffIncidentModel,
)
from app.services import analytics

STARTED_AT = time.time()
TASHKENT = analytics.TASHKENT
PERIODS = ("day", "week", "month")
# Supabase free plan: 500 MB of database
DB_LIMIT_MB = 500

# Feed events worth a founder's attention; the rest (weights, ticks) stay in each order's history
FEED_KINDS = ("created", "status", "taken", "taxi_taken", "seller_late", "no_show", "switched_to_self",
              "taxi_released", "returned", "received")


def previous(kind: str, first: date) -> date:
    if kind == "week":
        return first - timedelta(days=7)
    if kind == "month":
        return (first - timedelta(days=1)).replace(day=1)
    return first - timedelta(days=1)


def change(now_value: float, before: float) -> Optional[float]:
    """Percent change from the period before; None when there was nothing to compare with."""
    if not before:
        return None
    return round(100 * (now_value - before) / before, 1)


async def _count(db, model, start, end, *where):
    q = select(func.count()).select_from(model).where(model.created_at >= start, model.created_at <= end, *where)
    return (await db.execute(q)).scalar() or 0


async def period_report(db: AsyncSession, kind: str, day: date) -> dict:
    start, end, first, last = analytics.calendar_range(kind, day)
    now = analytics.report
    current = await now(db, start=start, end=end)
    p_start, p_end, p_first, p_last = analytics.calendar_range(kind, previous(kind, first))
    before = await now(db, start=p_start, end=p_end)

    # Orders and money per day (per hour for a single day), for the chart
    orders = (await db.execute(select(OrderModel.created_at, OrderModel.status, OrderModel.total_amount)
                               .where(OrderModel.created_at >= start, OrderModel.created_at <= end))).all()
    if kind == "day":
        buckets = [{"label": f"{h:02d}", "orders": 0, "revenue": 0} for h in range(24)]
        for created, status, total in orders:
            b = buckets[analytics.tashkent(created).hour]
            b["orders"] += 1
            if status in analytics.DONE:
                b["revenue"] += round(total or 0)
    else:
        days = (last - first).days + 1
        buckets = [{"label": (first + timedelta(days=i)).isoformat(), "orders": 0, "revenue": 0} for i in range(days)]
        for created, status, total in orders:
            i = (analytics.tashkent(created).date() - first).days
            if 0 <= i < days:
                buckets[i]["orders"] += 1
                if status in analytics.DONE:
                    buckets[i]["revenue"] += round(total or 0)

    registrations = {
        "stores": await _count(db, StoreModel, start, end, StoreModel.status != "archived"),
        "porters": await _count(db, StaffModel, start, end, StaffModel.role == "porter"),
        "taxis": await _count(db, StaffModel, start, end, StaffModel.role == "taxi"),
        "customers": await _count(db, CustomerModel, start, end),
    }
    return {
        "period": kind,
        "from": first.isoformat(),
        "to": last.isoformat(),
        "previous": {"from": p_first.isoformat(), "to": p_last.isoformat()},
        "kpi": {
            key: {"value": current[key], "before": before[key], "change": change(current[key], before[key])}
            for key in ("orders", "delivered", "revenue", "avg_check", "cancelled", "no_show")
        },
        "series": buckets,
        "registrations": registrations,
        "report": current,
        "problems": await problems(db, start, end),
    }


async def problems(db: AsyncSession, start: datetime, end: datetime) -> dict:
    """Who is late or lets customers down most often, and the low ratings with their comments."""
    stores = {s.id: s for s in (await db.execute(select(StoreModel))).scalars().all()}
    late = {}
    events = (await db.execute(select(OrderEventModel.kind, OrderEventModel.data)
                               .where(OrderEventModel.created_at >= start, OrderEventModel.created_at <= end,
                                      OrderEventModel.kind.in_(("seller_late",))))).all()
    for _, data in events:
        sid = (data or {}).get("store_id")
        if sid is not None:
            late[sid] = late.get(sid, 0) + 1
    incidents = {}
    staff = {s.id: s for s in (await db.execute(select(StaffModel))).scalars().all()}
    for staff_id, kind in (await db.execute(select(StaffIncidentModel.staff_id, StaffIncidentModel.kind)
                                            .where(StaffIncidentModel.created_at >= start,
                                                   StaffIncidentModel.created_at <= end))).all():
        incidents[(staff_id, kind)] = incidents.get((staff_id, kind), 0) + 1
    low = (await db.execute(select(ReviewModel, OrderModel.order_number).join(OrderModel, OrderModel.id == ReviewModel.order_id)
                            .where(ReviewModel.created_at >= start, ReviewModel.created_at <= end, ReviewModel.rating <= 3)
                            .order_by(ReviewModel.created_at.desc()).limit(20))).all()
    blocked = await _count(db, CustomerBlockModel, start, end)

    def stall(sid):
        s = stores.get(sid)
        return f"{s.stall_number} · {s.owner_name}" if s else str(sid)

    return {
        "late_stalls": [{"stall": stall(s), "count": n} for s, n in sorted(late.items(), key=lambda kv: -kv[1])[:10]],
        "staff_incidents": [
            {"name": staff[s].name if s in staff else str(s), "role": staff[s].role if s in staff else "", "kind": k, "count": n}
            for (s, k), n in sorted(incidents.items(), key=lambda kv: -kv[1])[:10]
        ],
        "low_ratings": [{"order": num, "rating": r.rating, "comment": r.comment or "",
                         "at": analytics.tashkent(r.created_at).isoformat(timespec="minutes")} for r, num in low],
        "blocked_customers": blocked,
    }


async def feed(db: AsyncSession, limit: int = 60, before_id: Optional[int] = None) -> list:
    """The latest order events plus new stalls and workers, newest first."""
    q = (select(OrderEventModel, OrderModel.order_number, OrderModel.total_amount)
         .join(OrderModel, OrderModel.id == OrderEventModel.order_id)
         .where(OrderEventModel.kind.in_(FEED_KINDS)))
    if before_id:
        q = q.where(OrderEventModel.id < before_id)
    rows = (await db.execute(q.order_by(OrderEventModel.id.desc()).limit(limit))).all()
    items = [{
        "id": e.id, "type": "order", "kind": e.kind, "to_status": e.to_status, "actor": e.actor_role,
        "order": num, "amount": round(total or 0), "data": e.data or {},
        "at": analytics.tashkent(e.created_at).isoformat(timespec="seconds"),
    } for e, num, total in rows]
    if not before_id:
        since = datetime.utcnow() - timedelta(days=7)
        for s in (await db.execute(select(StoreModel).where(StoreModel.created_at >= since, StoreModel.status != "archived"))).scalars():
            items.append({"id": None, "type": "store", "kind": "registered", "status": s.status,
                          "name": f"{s.stall_number} · {s.owner_name}", "at": analytics.tashkent(s.created_at).isoformat(timespec="seconds")})
        for s in (await db.execute(select(StaffModel).where(StaffModel.created_at >= since))).scalars():
            items.append({"id": None, "type": "staff", "kind": "registered", "status": s.status, "role": s.role,
                          "name": s.name, "at": analytics.tashkent(s.created_at).isoformat(timespec="seconds")})
        items.sort(key=lambda i: i["at"], reverse=True)
        items = items[:limit]
    return items


async def system(db: AsyncSession, bot_status: dict, backup_state: str) -> dict:
    """Is everything up, and how close the free database is to its limit (the Neon outage of 2026-11-20)."""
    if db.bind.dialect.name == "postgresql":
        size = (await db.execute(text("SELECT pg_database_size(current_database())"))).scalar() or 0
    else:
        pages = (await db.execute(text("PRAGMA page_count"))).scalar() or 0
        page = (await db.execute(text("PRAGMA page_size"))).scalar() or 0
        size = pages * page
    counts = {}
    for name, model in (("orders", OrderModel), ("stores", StoreModel), ("staff", StaffModel),
                        ("customers", CustomerModel), ("events", OrderEventModel)):
        counts[name] = (await db.execute(select(func.count()).select_from(model))).scalar() or 0
    mb = round(size / 1024 / 1024, 1)
    return {
        "db_mb": mb,
        "db_limit_mb": DB_LIMIT_MB,
        "db_used_pct": round(100 * mb / DB_LIMIT_MB, 1),
        "rows": counts,
        "bot": bot_status.get("bot"),
        "webhook": bot_status.get("webhook"),
        "r2": bot_status.get("r2"),
        "backup": backup_state,
        "uptime_min": round((time.time() - STARTED_AT) / 60),
        "env": settings.APP_ENV,
    }
