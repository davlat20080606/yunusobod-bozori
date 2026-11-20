"""Davlatbek (the bot's founder) signs into the Bozorkom panel with a separate PIN and sees everything."""
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


def test_partner_and_founder_only_watch(api, ok, admin):
    """Shuhrat (the partner) has his own PIN; the founder and the partner see everything and change nothing."""
    from tests.conftest import PARTNER_PIN
    c, r = api("POST", "/admin/login", {"pin": PARTNER_PIN})
    ok(c == 200 and r["role"] == "partner", "the partner's own PIN opens the panel")
    partner = {"x-admin-token": r["token"]}
    founder = {"x-admin-token": api("POST", "/admin/login", {"pin": FOUNDER_PIN})[1]["token"]}
    for who, h in (("partner", partner), ("founder", founder)):
        for path in ("/admin/monitor", "/admin/feed", "/admin/system", "/admin/stores", "/admin/orders"):
            ok(api("GET", path, None, h)[0] == 200, f"the {who} sees {path}")
        c, r = api("PUT", "/admin/settings", {"porter_fee": 1}, h)
        ok(c == 403 and "Только просмотр" in r["detail"], f"the {who} cannot change settings ({c})")
        sid = api("GET", "/admin/stores", None, admin)[1][0]["id"]
        ok(api("POST", f"/admin/stores/{sid}/status", {"status": "blocked"}, h)[0] == 403, f"the {who} cannot block a stall")
    ok(api("GET", "/admin/stores", None, admin)[1][0]["status"] != "blocked", "nothing was changed")
