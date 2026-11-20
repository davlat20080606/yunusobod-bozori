"""The founders' monitoring tab: any day, week or month with the period before for comparison, a live feed of
events, what goes wrong, and the system's health (database size against the free limit)."""
from datetime import datetime, timedelta

from tests.conftest import BASE_ORDER

TOMATO = 6  # stall 1


def tashkent_today():
    return (datetime.utcnow() + timedelta(hours=5)).date()


def test_numbers_for_day_week_month(api, ok, admin, relaxed_limits):
    before = api("GET", "/admin/monitor?period=day", None, admin)[1]["kpi"]["orders"]["value"]
    for n in range(2):
        c, o = api("POST", "/orders", {**BASE_ORDER, "customer_phone": f"+998 90 300-00-0{n}", "fulfillment": "self",
                                       "items": [{"product_id": TOMATO, "store_id": 1, "quantity": 1}]})
        assert c == 200, o
    today = tashkent_today()
    day = api("GET", f"/admin/monitor?period=day&date={today.isoformat()}", None, admin)[1]
    ok(day["kpi"]["orders"]["value"] == before + 2, f"today's orders counted ({day['kpi']['orders']})")
    ok(day["from"] == day["to"] == today.isoformat() and len(day["series"]) == 24, "a day: 24 hourly bars")
    week = api("GET", f"/admin/monitor?period=week&date={today.isoformat()}", None, admin)[1]
    monday = today - timedelta(days=today.weekday())
    ok(week["from"] == monday.isoformat() and len(week["series"]) == 7, f"a week runs Monday to Sunday ({week['from']})")
    ok(week["kpi"]["orders"]["value"] >= day["kpi"]["orders"]["value"], "the week holds today's orders")
    month = api("GET", f"/admin/monitor?period=month&date={today.isoformat()}", None, admin)[1]
    ok(month["from"] == today.replace(day=1).isoformat() and month["previous"]["to"] == (today.replace(day=1) - timedelta(days=1)).isoformat(),
       "a month, compared with the month before")
    past = api("GET", "/admin/monitor?period=day&date=2020-01-01", None, admin)[1]
    ok(past["kpi"]["orders"]["value"] == 0 and past["kpi"]["orders"]["change"] is None, "an empty day in the past: zero, nothing to compare")
    ok(api("GET", "/admin/monitor?period=day&date=bad", None, admin)[0] == 400, "a wrong date is refused")
    ok(api("GET", "/admin/monitor?period=year", None, admin)[0] == 422, "only day, week or month")


def test_feed_and_system(api, ok, admin):
    feed = api("GET", "/admin/feed?limit=20", None, admin)[1]
    ok(feed and any(i["kind"] == "created" for i in feed), "new orders appear in the feed")
    ok(all(feed[i]["at"] >= feed[i + 1]["at"] for i in range(len(feed) - 1)), "newest first")
    system = api("GET", "/admin/system", None, admin)[1]
    ok(system["db_mb"] >= 0 and system["db_limit_mb"] == 500 and system["rows"]["orders"] > 0, f"database size and rows ({system['db_mb']} MB)")
    ok(api("GET", "/admin/system")[0] == 401, "not without signing in")
