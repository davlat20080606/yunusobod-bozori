"""Taxi control in the UI: the driver sees the gate timer and can give the order back, the late driver loses it,
the customer sees «Taksi qayerda», the Bozorkom sees the incidents next to the driver."""
import asyncio, json, urllib.request, urllib.error, websockets, base64, sys, random, sqlite3, os, subprocess
from datetime import datetime, timedelta, timezone
S = sys.argv[1]
B = "http://127.0.0.1:8099"
DB = f"{S}/taxi.db"
BACKEND = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")


def backend(code):
    """Run server code against the suite's database (the timers the server runs every minute)."""
    out = subprocess.run([sys.executable, "-c", code], cwd=BACKEND, capture_output=True, text=True,
                         env={**os.environ, "DATABASE_URL": f"sqlite+aiosqlite:///{DB}"})
    return out.stdout.strip() or out.stderr[-300:]


def api(method, path, body=None, h=None):
    req = urllib.request.Request(B + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **(h or {})}, method=method)
    try:
        return json.loads(urllib.request.urlopen(req).read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read() or b"{}")


def ok(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg, flush=True)


def sql(query, *args):
    with sqlite3.connect(DB) as c:
        return c.execute(query, args).fetchall()


def ago(minutes):
    return (datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=minutes)).isoformat(sep=" ")


admin = api("POST", "/api/admin/login", {"pin": "909090"})
A = {"x-admin-token": admin["token"]}
seller = api("POST", "/api/seller/login", {"phone_or_slug": "+998 93 222-33-44", "pin": "2222"})
SH = {"x-seller-token": seller["token"]}


def worker(role, name, car=None):
    ph = f"+99893{random.randint(1000000, 9999999)}"
    api("POST", "/api/staff/register", {"role": role, "name": name, "phone": ph, "pin": "1234", "car": car})
    sid = [x for x in api("GET", "/api/admin/staff", h=A) if x["phone"].replace(" ", "").endswith(ph[-9:])][0]["id"]
    api("POST", f"/api/admin/staff/{sid}/status", {"status": "approved"}, A)
    return api("POST", "/api/staff/login", {"phone": ph, "pin": "1234"})


porter = worker("porter", "Jasur Aravachi")
late_taxi = worker("taxi", "Kechikkan Taksichi", "Cobalt 01 A 123 BC")
taxi = worker("taxi", "Botir Taksichi", "Nexia 01 B 777 AA")
PH, LT, TH = ({"x-staff-token": w["token"]} for w in (porter, late_taxi, taxi))

order = api("POST", "/api/orders", {"customer_name": "Aziza", "customer_phone": "+998 90 730-00-01", "delivery_time_slot": "Morning (09:00-11:00)",
                                    "payment_method": "cash", "fulfillment": "courier", "handoff_point": "main_gate",
                                    "delivery_address": "Yunusobod 4, 12", "delivery_lat": 41.36, "delivery_lng": 69.29,
                                    "items": [{"product_id": 10, "store_id": 2, "quantity": 1}]})
NUM, OID = order["order_number"], order["id"]
api("POST", f"/api/porter/orders/{OID}/take", {}, PH)
api("POST", f"/api/seller/orders/{OID}/handed", {}, SH)
for item in order["items"]:
    api("PATCH", f"/api/porter/items/{item['id']}/picked", {"is_picked": True}, PH)
api("PATCH", f"/api/porter/orders/{OID}/status", {"status": "handed_over"}, PH)


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
            r = await cmd("Page.captureScreenshot", {"format": "png"})
            open(f"{S}/{name}", "wb").write(base64.b64decode(r["result"]["data"]))

        async def go(query, wait=4.5):
            await cmd("Page.navigate", {"url": B + "/?lang=uz" + query}); await asyncio.sleep(wait)

        async def click(text, within=None, wait=1.5):
            scope = f"[...document.querySelectorAll('div')].filter(d=>d.innerText.includes({json.dumps(within)})&&[...d.querySelectorAll('button')].some(b=>b.innerText.includes({json.dumps(text)}))).sort((a,b)=>a.innerText.length-b.innerText.length)[0]" if within else "document"
            res = await js(f"(()=>{{const root={scope};const b=root&&[...root.querySelectorAll('button')].find(b=>b.innerText.includes({json.dumps(text)}));if(!b)return false;b.scrollIntoView({{block:'center'}});b.click();return true}})()")
            await asyncio.sleep(wait)
            return res

        async def body(): return await js("document.body.innerText") or ""

        async def as_staff(w, tab):
            await js(f"localStorage.setItem('staff_session', {json.dumps(json.dumps({'token': w['token'], 'staff': w['staff']}))})")
            await go(f"&tab={tab}", wait=5)

        await cmd("Runtime.enable"); await cmd("Network.enable"); await cmd("Network.setCacheDisabled", {"cacheDisabled": True})
        await cmd("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
        await go("")

        # 1. The late driver takes the order for 5 minutes and sees the gate timer
        await as_staff(late_taxi, "taxi")
        ok(await click("Olib ketaman", within=NUM), "the driver presses «Olib ketaman»")
        ok(await click("5 daq", within=NUM, wait=2.5), "and promises 5 minutes")
        text = await body()
        ok("Darvozada bo'ling" in text and "daqiqa qoldi" in text, "«Mening yo'llarim» shows the gate timer")
        ok("jonli joylashuv" in text, "and how to share the live location")
        await shot("taxi_gate_timer.png")

        # 2. The promised time has passed: the screen warns him
        sql("UPDATE orders SET taxi_eta_at = ? WHERE id = ?", ago(2), OID)
        await go("&tab=taxi", wait=4); await click("Mening yo'llarim", wait=1.5)
        ok("Kechikyapsiz" in await body(), "2 minutes late: «Kechikyapsiz! ... boshqa taksichiga beriladi»")
        await shot("taxi_late.png")

        # 3. The server takes the order away (the minute timer, run here by hand)
        sql("UPDATE orders SET taxi_eta_at = ? WHERE id = ?", ago(6), OID)
        # The server checks every minute; run the check now (it may already have done it itself)
        out = backend("import asyncio;from app.services import maintenance;print(asyncio.run(maintenance.taxi_timers()))")
        r = api("GET", f"/api/orders/{NUM}")
        ok(r["status"] == "handed_over" and not r["taxi_phone"], f"the server took the order from the late driver ({out})")
        await go("&tab=taxi", wait=4); await click("Mening yo'llarim", wait=1.5)
        ok(NUM not in await body(), "it is gone from his trips")

        # 4. Another driver takes it, then gives it back himself
        await as_staff(taxi, "taxi")
        ok(NUM in await body(), "the other driver sees it among the ready orders again")
        await click("Olib ketaman", within=NUM); await click("10 daq", within=NUM, wait=2.5)
        await js("window.confirm = () => true")
        ok(await click("Bora olmayman", within=NUM, wait=2.5), "«Bora olmayman»: he gives it back")
        ok(not api("GET", f"/api/orders/{NUM}")["taxi_phone"], "the order is free again")

        # 5. He takes it again, picks up the bag, shares his location: the customer sees the car
        await click("Tayyor buyurtmalar", wait=1.5)
        await click("Olib ketaman", within=NUM); await click("5 daq", within=NUM, wait=2.5)
        ok(await click("Qabul qildim", within=NUM, wait=2.5), "he takes the bag: «Qabul qildim, yo'lga chiqdim»")
        sql("UPDATE staff SET tg_id = '7770002' WHERE phone = ?", taxi["staff"]["phone"])
        # What the bot does with each Telegram live-location update
        out = backend("import asyncio\nfrom app.database import async_session_factory\nfrom app.services import taxi_control\n"
                      "async def m():\n    async with async_session_factory() as s:\n"
                      "        r = await taxi_control.save_location(s, '7770002', 41.3551, 69.2843); await s.commit(); print(r)\n"
                      "asyncio.run(m())")
        ok(out == str(OID), f"his live location is written to the order: {out}")
        await go("&tab=taxi", wait=4); await click("Mening yo'llarim", wait=1.5)
        ok("Joylashuv ulashilmoqda" in await body(), "his screen says the location is on")

        await js("localStorage.removeItem('staff_session')")
        await go(f"&tab=orders&order={NUM}", wait=5)
        href = await js("document.querySelector('[data-testid=taxi-where]')?.href || ''")
        ok("69.2843,41.3551" in href, f"the customer sees «Taksi qayerda» with the car on the map: {href}")
        ok(await js("!!document.querySelector('[data-testid=taxi-marker]')"), "and the car 🚕 on the route map")
        await shot("taxi_where_customer.png")

        # 6. The Bozorkom sees both drivers' incidents
        await js(f"localStorage.setItem('admin_session', {json.dumps(json.dumps({'token': admin['token']}))})")
        await go("&tab=admin", wait=5)
        await click("Xodimlar", wait=2.5)
        text = await body()
        ok("darvozaga kelmadi 1" in text, "Bozorkom: «darvozaga kelmadi 1» next to the late driver")
        ok("qaytardi 1" in text, "and «qaytardi 1» next to the one who gave it back")
        await shot("taxi_admin_incidents.png")
        await click("Sozlamalar", wait=2)
        ok("Taksi darvozaga kechiksa" in await body(), "the taxi timers are in «Sozlamalar»")


asyncio.run(main())
