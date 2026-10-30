"""Test setup: every test file gets the real server on a fresh demo database.

The server runs as a separate process (like in production) with a fake Telegram bot: nothing is
sent to Telegram, messages are written to a file instead. Run from backend/:  python -m pytest
"""
import json
import os
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
RUN_DIR = BACKEND / "tests" / ".run"
RUN_DIR.mkdir(exist_ok=True)
DB_FILE = RUN_DIR / "test.db"
SENT_LOG = RUN_DIR / "sent.log"
ADMIN_PIN = "909090"
BOT_TOKEN = "123456:TESTtokenTESTtokenTESTtokenTESTtok"

# The same settings for code the tests call directly (bot handlers, background checks)
os.environ.update({
    "DATABASE_URL": f"sqlite+aiosqlite:///{DB_FILE}",
    "ADMIN_PIN": ADMIN_PIN,
    "TELEGRAM_BOT_TOKEN": BOT_TOKEN,
    "BOT_MODE": "webhook",
    "SENT_LOG": str(SENT_LOG),
    "DB_FILE": str(DB_FILE),
    "APP_ENV": "test",
})
sys.path.insert(0, str(BACKEND))


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class Api:
    def __init__(self, base: str):
        self.base = base

    def __call__(self, method, path, body=None, h=None, headers=None):
        """(status, json) for /api<path>; error responses are returned, not raised."""
        req = urllib.request.Request(
            self.base + path, method=method,
            data=json.dumps(body).encode() if body is not None else None,
            headers={"Content-Type": "application/json", **(h or headers or {})},
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.status, json.loads(r.read() or b"null")
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read() or b"{}")


@pytest.fixture(scope="module")
def api():
    for f in (DB_FILE, SENT_LOG):
        f.unlink(missing_ok=True)
    SENT_LOG.touch()
    port = free_port()
    env = {**os.environ, "PYTHONPATH": f"{BACKEND}{os.pathsep}{BACKEND / 'tests'}"}
    log = open(RUN_DIR / "server.log", "w")
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "fake_bot_app:app", "--port", str(port)],
        cwd=BACKEND, env=env, stdout=log, stderr=subprocess.STDOUT,
    )
    client = Api(f"http://127.0.0.1:{port}/api")
    for _ in range(120):
        if proc.poll() is not None:
            break
        try:
            if client("GET", "/health")[0] == 200:
                break
        except OSError:
            pass
        time.sleep(0.25)
    else:
        proc.kill()
    if proc.poll() is not None:
        pytest.fail("server did not start:\n" + (RUN_DIR / "server.log").read_text()[-3000:])
    yield client
    proc.terminate()
    proc.wait(timeout=10)
    log.close()
    # Code that ran in this process keeps pooled connections to the old database file
    try:
        import asyncio
        from app.database import engine
        asyncio.run(engine.dispose())
    except Exception:
        pass


@pytest.fixture
def ok():
    """Soft checks: every failed one is listed at the end, so one run shows all problems."""
    failures = []

    def check(condition, message):
        if not condition:
            failures.append(message)

    yield check
    if failures:
        pytest.fail(f"{len(failures)} check(s) failed:\n- " + "\n- ".join(failures), pytrace=False)


@pytest.fixture(scope="module")
def admin(api):
    return {"x-admin-token": api("POST", "/admin/login", {"pin": ADMIN_PIN})[1]["token"]}


def seller_headers(api, phone, pin):
    return {"x-seller-token": api("POST", "/seller/login", {"phone_or_slug": phone, "pin": pin})[1]["token"]}


# Demo stalls from seed_data
SELLERS = [("+998 90 111-22-33", "1111"), ("+998 93 222-33-44", "2222"), ("+998 97 333-44-55", "3333")]


@pytest.fixture(scope="module")
def sellers(api):
    return [seller_headers(api, p, pin) for p, pin in SELLERS]


@pytest.fixture(scope="module")
def make_staff(api, admin):
    """A registered and approved aravachi or taksichi, signed in."""
    def make(role, name=None):
        import random
        phone = f"+99895{random.randint(1000000, 9999999)}"
        api("POST", "/staff/register", {"role": role, "name": name or f"Test {role}", "phone": phone, "pin": "1234",
                                        "car": "Cobalt" if role == "taxi" else None})
        sid = [x for x in api("GET", "/admin/staff", h=admin)[1] if x["phone"].replace(" ", "").endswith(phone[-9:])][0]["id"]
        api("POST", f"/admin/staff/{sid}/status", {"status": "approved"}, admin)
        return {"x-staff-token": api("POST", "/staff/login", {"phone": phone, "pin": "1234"})[1]["token"]}
    return make


BASE_ORDER = {"customer_name": "Test Xaridor", "customer_phone": "+998901234567",
              "delivery_time_slot": "Morning (09:00-11:00)", "payment_method": "cash"}
COURIER = {"fulfillment": "courier", "handoff_point": "main_gate", "delivery_address": "Yunusobod 4, 12",
           "delivery_lat": 41.36, "delivery_lng": 69.29}


@pytest.fixture(scope="module")
def relaxed_limits(api, admin):
    """Flow tests place many orders from one test phone; fake-order limits have their own test."""
    api("PUT", "/admin/settings", {"max_open_orders": 20, "new_customer_max_open": 20,
                                   "new_customer_max_total": 100_000_000, "orders_per_10_min": 1000}, admin)
