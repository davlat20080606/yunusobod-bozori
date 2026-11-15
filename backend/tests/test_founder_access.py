"""Davlatbek (the bot's founder) signs into the Bozorkom panel with his own PIN and sees everything."""
from tests.conftest import FOUNDER_PIN, ADMIN_PIN


def test_founder_signs_in_with_own_pin(api, ok):
    c, r = api("POST", "/admin/login", {"pin": FOUNDER_PIN})
    ok(c == 200 and r["role"] == "founder", "the founder's own PIN opens the panel")
    founder = {"x-admin-token": r["token"]}
    for path in ("/admin/overview", "/admin/stores", "/admin/orders", "/admin/staff", "/admin/customers", "/admin/analytics"):
        ok(api("GET", path, None, founder)[0] == 200, f"the founder sees {path}")
    c, r = api("POST", "/admin/login", {"pin": ADMIN_PIN})
    ok(c == 200 and r["role"] == "admin", "the bozorkom's PIN still works as before")
    ok(api("POST", "/admin/login", {"pin": "123987"})[0] == 401, "a wrong PIN is refused")
    fake = {"x-admin-token": "founder.9999999999.abc"}
    ok(api("GET", "/admin/overview", None, fake)[0] == 401, "a made-up founder token is refused")
