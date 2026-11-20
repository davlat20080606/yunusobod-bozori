"""Davlatbek: a demo stall shown to the bozorkom is removed from the list; it stays in the database, hidden."""


def test_blocked_stall_can_be_removed_from_the_list(api, ok, admin):
    phone = "+998 97 555-12-34"
    c, r = api("POST", "/seller/register-store", {"name_uz": "Namuna", "stall_number": "999", "owner_name": "Namuna",
                                                  "owner_phone": phone, "category_slug": "vegetables", "pin": "4321"})
    ok(c == 200, f"a demo stall applies ({c} {r})")
    sid = next(s["id"] for s in api("GET", "/admin/stores", h=admin)[1] if s["stall_number"] == "999")
    ok(api("POST", f"/admin/stores/{sid}/status", {"status": "archived"}, admin)[0] == 409, "a stall must be blocked first")
    api("POST", f"/admin/stores/{sid}/status", {"status": "blocked"}, admin)
    c, r = api("POST", f"/admin/stores/{sid}/status", {"status": "archived"}, admin)
    ok(c == 200 and r["status"] == "archived", "the blocked stall is removed")
    ok(all(s["id"] != sid for s in api("GET", "/admin/stores", h=admin)[1]), "not in the bozorkom's list any more")
    ok(all(s["id"] != sid for s in api("GET", "/stores")[1]), "not in the shop")
    ok(api("POST", "/seller/login", {"phone_or_slug": phone, "pin": "4321"})[0] in (401, 403), "it cannot sign in")
    c, r = api("POST", "/seller/register-store", {"name_uz": "Haqiqiy", "stall_number": "998", "owner_name": "Namuna",
                                                  "owner_phone": phone, "category_slug": "vegetables", "pin": "4321"})
    ok(c == 200, f"the same person may register a real stall later ({c})")
    new = next(s["id"] for s in api("GET", "/admin/stores", h=admin)[1] if s["stall_number"] == "998")
    api("POST", f"/admin/stores/{new}/status", {"status": "approved"}, admin)
    c, r = api("POST", "/seller/login", {"phone_or_slug": phone, "pin": "4321"})
    ok(c == 200 and r["store"]["id"] == new, "and signs into the new stall, not the removed one")
