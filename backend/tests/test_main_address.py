"""Google showed the Render address: pages opened there move to bozorbot.uz for good; the API and the bot do not."""
import http.client
from urllib.parse import urlparse


def request(api, method, path, host):
    base = urlparse(api.base)
    conn = http.client.HTTPConnection(base.hostname, base.port, timeout=30)
    conn.request(method, path, headers={"Host": host})
    r = conn.getresponse()
    r.read()
    return r.status, r.getheader("location")


def test_render_address_moves_to_bozorbot(api):
    status, location = request(api, "GET", "/?tab=catalog&lang=ru", "yunusobod-bozori.onrender.com")
    assert status == 301 and location == "https://bozorbot.uz/?tab=catalog&lang=ru", (status, location)
    status, _ = request(api, "GET", "/api/health", "yunusobod-bozori.onrender.com")
    assert status == 200, "the API keeps working at the Render address"
    status, _ = request(api, "POST", "/api/telegram/webhook", "yunusobod-bozori.onrender.com")
    assert status != 301, "the bot's webhook is never redirected"
    status, _ = request(api, "GET", "/api/health", "bozorbot.uz")
    assert status == 200, "the real address is served as before"
