"""«📊 Tahlil» in the UI: the Bozorkom sees today's numbers, the stage times and the order map,
gets the Excel file from the bot, and sees whether backups are on."""
import asyncio, json, urllib.request, urllib.error, websockets, base64, sys, random, sqlite3
S = sys.argv[1]
B = "http://127.0.0.1:8099"
DB = f"{S}/analytics.db"


def api(method, path, body=None, h=None):
    req = urllib.request.Request(B + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **(h or {})}, method=method)
    try:
        return json.loads(urllib.request.urlopen(req).read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read() or b"{}")


def ok(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg, flush=True)


admin = api("POST", "/api/admin/login", {"pin": "909090"})
A = {"x-admin-token": admin["token"]}
with sqlite3.connect(DB) as c:  # as if the Bozorkom had opened the cabinet from Telegram
    c.execute("INSERT INTO settings (key, value) VALUES ('admin_tg_id', '555') ON CONFLICT(key) DO UPDATE SET value = '555'")
seller = api("POST", "/api/seller/login", {"phone_or_slug": "+998 93 222-33-44", "pin": "2222"})
SH = {"x-seller-token": seller["token"]}
ph = f"+99893{random.randint(1000000, 9999999)}"
api("POST", "/api/staff/register", {"role": "porter", "name": "Jasur Aravachi", "phone": ph, "pin": "1234"})
sid = [x for x in api("GET", "/api/admin/staff", h=A) if x["phone"].replace(" ", "").endswith(ph[-9:])][0]["id"]
api("POST", f"/api/admin/staff/{sid}/status", {"status": "approved"}, A)
PH = {"x-staff-token": api("POST", "/api/staff/login", {"phone": ph, "pin": "1234"})["token"]}

# Two orders today: one delivered at the point, one cancelled
o = api("POST", "/api/orders", {"customer_name": "Aziza", "customer_phone": "+998 90 750-00-01", "delivery_time_slot": "Morning (09:00-11:00)",
                                "payment_method": "cash", "fulfillment": "point", "handoff_point": "main_gate",
                                "items": [{"product_id": 10, "store_id": 2, "quantity": 1}]})
api("POST", f"/api/porter/orders/{o['id']}/take", {}, PH)
api("POST", f"/api/seller/orders/{o['id']}/handed", {}, SH)
for item in o["items"]:
    api("PATCH", f"/api/porter/items/{item['id']}/picked", {"is_picked": True}, PH)
api("PATCH", f"/api/porter/orders/{o['id']}/status", {"status": "at_point"}, PH)
api("PATCH", f"/api/porter/orders/{o['id']}/status", {"status": "delivered", "code": o["handoff_code"]}, PH)
c2 = api("POST", "/api/orders", {"customer_name": "Bek", "customer_phone": "+998 90 750-00-02", "delivery_time_slot": "Morning (09:00-11:00)",
                                 "payment_method": "cash", "fulfillment": "self", "items": [{"product_id": 10, "store_id": 2, "quantity": 1}]})
api("POST", f"/api/orders/{c2['order_number']}/cancel")
report = api("GET", "/api/admin/analytics?days=1", h=A)


async def main():
    t = [x for x in json.loads(urllib.request.urlopen("http://127.0.0.1:9333/json").read()) if x["type"] == "page"][0]
    async with websockets.connect(t["webSocketDebuggerUrl"], max_size=None, ping_interval=None) as ws:
        n = [0]

        async def cmd(m, p={}):
            n[0] += 1; i = n[0]; await ws.send(json.dumps({"id": i, "method": m, "params": p}))
            while True:
                r = json.loads(await ws.recv())
                if r.get("id") == i: return r

        async def js(e): return (await cmd("Runtime.evaluate", {"expression": e, "awaitPromise": True, "returnByValue": True}))["result"].get("result", {}).get("value")

        async def shot(name):
            r = await cmd("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": True})
            open(f"{S}/{name}", "wb").write(base64.b64decode(r["result"]["data"]))

        async def click(text, wait=1.5):
            res = await js(f"(()=>{{const b=[...document.querySelectorAll('button')].find(b=>b.innerText.includes({json.dumps(text)}));if(!b)return false;b.scrollIntoView({{block:'center'}});b.click();return true}})()")
            await asyncio.sleep(wait)
            return res

        async def body(): return await js("document.querySelector('[data-testid=analytics]')?.innerText || ''") or ""

        await cmd("Runtime.enable"); await cmd("Network.setCacheDisabled", {"cacheDisabled": True})
        await cmd("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
        await cmd("Page.navigate", {"url": B + "/?lang=uz"}); await asyncio.sleep(3)
        await js(f"localStorage.setItem('admin_session', {json.dumps(json.dumps({'token': admin['token']}))})")

        # The evening report's button opens «Tahlil» directly
        await cmd("Page.navigate", {"url": B + "/?lang=uz&tab=admin&admin_tab=analytics"}); await asyncio.sleep(5)
        await click("Bugun", wait=2)
        text = await body()
        ok("Buyurtmalar" in text and "Savdo" in text, "«📊 Tahlil» opens from the report's link")
        ok(f"Yetkazildi: {report['delivered']}" in text, f"today: delivered {report['delivered']} of {report['orders']}")
        revenue = f"{report['revenue']:,}".replace(",", " ")
        ok(revenue in text or f"{report['revenue']:,}".replace(",", " ") in text, f"sales {report['revenue']} UZS shown")
        ok(f"{report['cancelled_pct']:g}%" in text, f"cancelled {report['cancelled_pct']:g}%")
        ok("Har bosqich necha daqiqa" in text and "Jami" in text, "the stage times are there")
        ok(await js("document.querySelectorAll('[data-testid=analytics] table td[title]').length") == 7 * 17, "the weekday × hour map has 7 rows of hours")
        ok("Jasur Aravachi" in text, "the aravachi who delivered is listed")
        await shot("analytics.png")

        open(f"{S}/sent.log", "a").close()
        before = open(f"{S}/sent.log").read().count('"file"')
        ok(await click("Excel faylni botga yuborish", wait=2.5), "«Excel faylni botga yuborish»")
        log = open(f"{S}/sent.log").read()
        ok(log.count('"file"') == before + 1 and '"chat": "555"' in log, "the bot sent the CSV to the Bozorkom's chat")
        ok("Fayl botga yuborildi" in await body(), "and the screen says so")
        ok("BACKUP_KEY" in (await js("document.querySelector('[data-testid=backup-state]')?.innerText") or ""),
           "backup state: off until BACKUP_KEY is in Render")

        await click("7 kun", wait=2)
        ok("Buyurtmalar" in await body(), "switching to 7 days works")


asyncio.run(main())
