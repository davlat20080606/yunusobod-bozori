"""What the Bozorkom needs to see after the pilot: how many orders and when, how long each stage takes,
what goes wrong (cancelled, no-show, sold out, weight refused), which stalls and workers do the work.

Everything is counted in Python from the orders of the period: a bazaar has hundreds of orders a month,
not millions, and the same code works on SQLite (tests) and Postgres (production).
"""
from datetime import datetime, timedelta
from statistics import mean
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.schemas import OrderModel, OrderEventModel, StoreModel

TASHKENT = timedelta(hours=5)
DONE = {"delivered"}
NOT_COLLECTED = {"no_show", "returned"}
# Where the order is when the bazaar's part is finished
COLLECTED = {"handed_over", "at_point", "ready"}


def tashkent(dt: datetime) -> datetime:
    return dt + TASHKENT


def p90(values: list) -> Optional[float]:
    if not values:
        return None
    values = sorted(values)
    return round(values[min(len(values) - 1, int(0.9 * len(values)))], 1)


def summary(values: list) -> dict:
    return {"avg": round(mean(values), 1) if values else None, "p90": p90(values), "count": len(values)}


def period(days: int, now: Optional[datetime] = None):
    """From midnight in Tashkent `days - 1` days ago until now (days=1 is «today»)."""
    now = now or datetime.utcnow()
    start_local = tashkent(now).replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days - 1)
    return start_local - TASHKENT, now


def stage_minutes(order: OrderModel, events: list) -> dict:
    """Minutes between the order's steps, from its event log (the first time it reached each status)."""
    reached = {}
    for e in events:
        if e.kind == "status" and e.to_status and e.to_status not in reached:
            reached[e.to_status] = e.created_at
    created = order.created_at
    taken = reached.get("picking")  # an aravachi took it
    collected = min((reached[s] for s in COLLECTED if s in reached), default=None)
    delivered = reached.get("delivered")

    def minutes(a, b):
        return (b - a).total_seconds() / 60 if a and b and b >= a else None

    return {
        "to_porter": minutes(created, taken),
        "collecting": minutes(taken or created, collected),
        "to_customer": minutes(collected, delivered),
        "total": minutes(created, delivered),
    }


async def report(db: AsyncSession, days: int = 7, now: Optional[datetime] = None) -> dict:
    start, end = period(days, now)
    orders = (await db.execute(
        select(OrderModel).where(OrderModel.created_at >= start, OrderModel.created_at <= end)
        .options(selectinload(OrderModel.items))
    )).scalars().all()
    ids = [o.id for o in orders]
    events = {}
    if ids:
        for e in (await db.execute(select(OrderEventModel).where(OrderEventModel.order_id.in_(ids))
                                   .order_by(OrderEventModel.created_at, OrderEventModel.id))).scalars().all():
            events.setdefault(e.order_id, []).append(e)
    stores = {s.id: s for s in (await db.execute(select(StoreModel))).scalars().all()}

    delivered = [o for o in orders if o.status in DONE]
    revenue = sum(o.total_amount or 0 for o in delivered)
    by_status = {}
    for o in orders:
        by_status[o.status] = by_status.get(o.status, 0) + 1

    # When people order: weekday (0 = Monday) × hour, Tashkent time
    heat = [[0] * 24 for _ in range(7)]
    for o in orders:
        local = tashkent(o.created_at)
        heat[local.weekday()][local.hour] += 1

    stages = {"to_porter": [], "collecting": [], "to_customer": [], "total": []}
    for o in delivered:
        for key, value in stage_minutes(o, events.get(o.id, [])).items():
            if value is not None:
                stages[key].append(value)

    missing, weight_refused, stall_sales, porters, taxis = {}, 0, {}, {}, {}
    for o in orders:
        for i in o.items:
            if i.item_status == "missing":
                key = (i.product_name, i.store_id)
                missing[key] = missing.get(key, 0) + 1
            if i.weight_status == "rejected":
                weight_refused += 1
    for o in delivered:
        for i in o.items:
            if i.item_status != "missing":
                stall_sales[i.store_id] = stall_sales.get(i.store_id, 0) + (i.total_price or 0)
        if o.porter_name:
            porters[o.porter_name] = porters.get(o.porter_name, 0) + 1
        if o.taxi_name:
            taxis[o.taxi_name] = taxis.get(o.taxi_name, 0) + 1

    def share(n):
        return round(100 * n / len(orders), 1) if orders else 0

    def stall(store_id):
        s = stores.get(store_id)
        return f"{s.stall_number} · {s.name_uz}" if s else str(store_id)

    cancelled = by_status.get("cancelled", 0)
    no_shows = sum(by_status.get(s, 0) for s in NOT_COLLECTED)
    return {
        "days": days,
        "from": tashkent(start).date().isoformat(),
        "to": tashkent(end).date().isoformat(),
        "orders": len(orders),
        "delivered": len(delivered),
        "revenue": round(revenue),
        "avg_check": round(revenue / len(delivered)) if delivered else 0,
        "cancelled": cancelled,
        "cancelled_pct": share(cancelled),
        "no_show": no_shows,
        "no_show_pct": share(no_shows),
        "open": len(orders) - len(delivered) - cancelled - no_shows,
        "by_status": by_status,
        "by_fulfillment": {f: sum(1 for o in orders if (o.fulfillment or "courier") == f) for f in ("self", "point", "courier")},
        "heatmap": heat,
        "stages": {key: summary(values) for key, values in stages.items()},
        "missing": [{"product": p, "stall": stall(s), "count": n}
                    for (p, s), n in sorted(missing.items(), key=lambda kv: -kv[1])[:10]],
        "weight_refused": weight_refused,
        "stalls": [{"stall": stall(s), "sales": round(v)} for s, v in sorted(stall_sales.items(), key=lambda kv: -kv[1])[:10]],
        "porters": [{"name": n, "delivered": c} for n, c in sorted(porters.items(), key=lambda kv: -kv[1])[:10]],
        "taxis": [{"name": n, "delivered": c} for n, c in sorted(taxis.items(), key=lambda kv: -kv[1])[:10]],
    }


CSV_COLUMNS = ["order_number", "created_tashkent", "status", "fulfillment", "total_amount", "items", "missing_items",
               "porter", "taxi", "minutes_total"]


async def orders_csv(db: AsyncSession, days: int = 30, now: Optional[datetime] = None) -> str:
    """One line per order, for Excel. Customer names and phones stay out: the file gets passed around."""
    import csv
    import io
    start, end = period(days, now)
    orders = (await db.execute(
        select(OrderModel).where(OrderModel.created_at >= start, OrderModel.created_at <= end)
        .order_by(OrderModel.created_at).options(selectinload(OrderModel.items))
    )).scalars().all()
    events = {}
    if orders:
        for e in (await db.execute(select(OrderEventModel).where(OrderEventModel.order_id.in_([o.id for o in orders]))
                                   .order_by(OrderEventModel.created_at, OrderEventModel.id))).scalars().all():
            events.setdefault(e.order_id, []).append(e)
    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(CSV_COLUMNS)
    for o in orders:
        total = stage_minutes(o, events.get(o.id, []))["total"]
        writer.writerow([o.order_number, tashkent(o.created_at).strftime("%Y-%m-%d %H:%M"), o.status, o.fulfillment or "courier",
                         round(o.total_amount or 0), len(o.items), sum(1 for i in o.items if i.item_status == "missing"),
                         o.porter_name or "", o.taxi_name or "", round(total) if total is not None else ""])
    # Excel opens UTF-8 with a BOM correctly (Uzbek and Russian names)
    return "﻿" + out.getvalue()
