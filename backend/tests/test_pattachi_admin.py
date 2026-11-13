"""Shuhrat's rule: a pattachi cannot apply; only the bozorkom adds one, and that person can sign in at once."""


def test_patta_off_by_default(api, ok, admin):
    """The bozorkom: the bazaar's income (patta) is not kept in the bot. Off unless turned on."""
    ok(api("GET", "/config")[1]["patta_enabled"] is False, "public config: patta off")
    o = api("GET", "/admin/overview", None, admin)[1]
    ok(o["patta_enabled"] is False and o["patta_today"] is None, "Bozorkom overview has no patta figures")
    ok(api("GET", "/admin/patta", None, admin)[0] == 404, "no patta report")
    ok(api("POST", "/admin/staff/pattachi", {"name": "Odil", "phone": "+998941119999", "pin": "4321"}, admin)[0] == 404, "no adding pattachi")
    ok(api("GET", "/patta/today")[0] == 404, "the pattachi screen's data is closed")


def test_pattachi_added_by_bozorkom_only(api, ok, admin):
    api("PUT", "/admin/settings", {"patta_enabled": True}, admin)
    c, r = api("POST", "/staff/register", {"role": "pattachi", "name": "Begona", "phone": "+998941112233", "pin": "1234"})
    ok(c == 403, f"a stranger cannot apply as pattachi ({c})")
    ok(api("POST", "/staff/login", {"phone": "+998941112233", "pin": "1234"})[0] == 401, "so they cannot sign in")
    ok(api("POST", "/admin/staff/pattachi", {"name": "Odil aka", "phone": "+998941112244", "pin": "4321"})[0] in (401, 403), "only with the bozorkom's sign-in")
    c, p = api("POST", "/admin/staff/pattachi", {"name": "Odil aka", "phone": "+998941112244", "pin": "4321"}, admin)
    ok(c == 200 and p["role"] == "pattachi" and p["status"] == "approved", "the bozorkom adds a pattachi, approved at once")
    ok(api("POST", "/admin/staff/pattachi", {"name": "Ikkinchi", "phone": "+998 94 111-22-44", "pin": "4321"}, admin)[0] == 409, "the same phone twice is refused")
    c, s = api("POST", "/staff/login", {"phone": "+998941112244", "pin": "4321"})
    ok(c == 200 and s["staff"]["role"] == "pattachi", "the pattachi signs in with that phone and PIN")
    c, _ = api("POST", "/staff/register", {"role": "porter", "name": "Aravachi", "phone": "+998941112255", "pin": "1234"})
    ok(c == 200, "aravachi still apply by themselves")
    api("PUT", "/admin/settings", {"patta_enabled": False}, admin)
    ok(api("POST", "/staff/login", {"phone": "+998941112244", "pin": "4321"})[0] == 403, "patta off again: the pattachi cannot sign in")
