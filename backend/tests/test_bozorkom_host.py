"""The bozorkom panel at its own address (Shuhrat, 2026-11-26): with BOZORKOM_HOST set, the market's address
does not answer /api/admin and moves the old panel links to the panel's own address."""
import http.client
import os
from urllib.parse import urlparse

import pytest

PANEL = "bozorkom.bozorbot.uz"


@pytest.fixture(scope="module")
def split():
    """This module's server runs with the panel's own address set; other modules' servers do not."""
    os.environ["BOZORKOM_HOST"] = PANEL
    yield
    os.environ.pop("BOZORKOM_HOST", None)


def request(api, path, host):
    base = urlparse(api.base)
    conn = http.client.HTTPConnection(base.hostname, base.port, timeout=30)
    conn.request("GET", path, headers={"Host": host})
    r = conn.getresponse()
    r.read()
    return r.status, r.getheader("location"), r.getheader("x-robots-tag")


def test_panel_only_at_its_own_address(split, api, ok):
    status, _, _ = request(api, "/api/admin/overview", "bozorbot.uz")
    ok(status == 404, f"the market's address does not answer the panel's API: {status}")

    status, location, _ = request(api, "/bozorkom", "bozorbot.uz")
    ok(status == 302 and location == f"https://{PANEL}/", f"/bozorkom moves to the panel: {status} {location}")

    status, location, _ = request(api, "/?tab=admin&admin_tab=analytics", "www.bozorbot.uz")
    ok(status == 302 and location == f"https://{PANEL}/?admin_tab=analytics",
       f"old bot buttons (?tab=admin) move to the panel: {status} {location}")

    status, _, robots = request(api, "/api/admin/overview", PANEL)
    ok(status == 401, f"the panel's API answers at its own address (401 without a PIN): {status}")
    ok(robots == "noindex, nofollow", f"the panel's address is never indexed: {robots}")

    status, _, robots = request(api, "/api/health", "bozorbot.uz")
    ok(status == 200 and robots is None, "the market itself is untouched")


def test_bot_button_opens_the_panel_address(monkeypatch):
    from app.bot.notify import _webapp_button
    from app.config import settings
    monkeypatch.setattr(settings, "BOZORKOM_HOST", PANEL)
    url = _webapp_button("🏛 Bozorkom", "tab=admin").inline_keyboard[0][0].web_app.url
    assert url == f"https://{PANEL}/?tab=admin"
    url = _webapp_button("🛒", "tab=orders").inline_keyboard[0][0].web_app.url
    assert url.startswith(settings.WEBAPP_URL) and PANEL not in url
