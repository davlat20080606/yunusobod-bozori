"""Simulation, local only: a made-up taxi drives from the bazaar to the customer, with no real driver or Telegram.
Each point runs the bot's own live-location code through a route only the test server has, and the
customer's open order screen must move the car by itself. The address is fixed to this computer on purpose:
nothing here can touch the real site."""
import asyncio, base64, json, random, sqlite3, sys, urllib.error, urllib.request, websockets
S = sys.argv[1]
B = "http://127.0.0.1:8099"
DB = f"{S}/sim.db"
TG_ID = 7770009
HOME = (41.3551, 69.2843)
START = (41.36467, 69.29089)
STOPS = 6


def api(method, path, body=None, h=None):
    req = urllib.request.Request(B + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **(h or {})}, method=method)
    try:
        return json.loads(urllib.request.urlopen(req).read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read() or b"{}")


def ok(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg, flush=True)


def send_location(lat, lng):
    """The bot's own live-location code, on the test server only."""
    return api("POST", f"/api/test/driver-location?tg_id={TG_ID}&lat={lat}&lng={lng}")


admin = api("POST", "/api/admin/login", {"pin": "909090"})
A = {"x-admin-token": admin["token"]}
SH = {"x-seller-token": api("POST", "/api/seller/login", {"phone_or_slug": "+998 93 222-33-44", "pin": "2222"})["token"]}


def worker(role, name, car=None):
    ph = f"+99893{random.randint(1000000, 9999999)}"
    api("POST", "/api/staff/register", {"role": role, "name": name, "phone": ph, "pin": "1234", "car": car})
    sid = [x for x in api("GET", "/api/admin/staff", h=A) if x["phone"].replace(" ", "").endswith(ph[-9:])][0]["id"]
    api("POST", f"/api/admin/staff/{sid}/status", {"status": "approved"}, A)
    return api("POST", "/api/staff/login", {"phone": ph, "pin": "1234"})


porter, taxi = worker("porter", "Sim Aravachi"), worker("taxi", "Sim Taksichi", "Nexia 01 S 000 IM")
PH, TH = ({"x-staff-token": w["token"]} for w in (porter, taxi))
with sqlite3.connect(DB) as c:
    c.execute("UPDATE staff SET tg_id = ? WHERE phone = ?", (str(TG_ID), taxi["staff"]["phone"]))

order = api("POST", "/api/orders", {"customer_name": "Sim", "customer_phone": "+998 90 730-00-09", "delivery_time_slot": "Morning (09:00-11:00)",
                                    "payment_method": "cash", "fulfillment": "courier", "handoff_point": "main_gate",
                                    "delivery_address": "Yunusobod 4, 12", "delivery_lat": HOME[0], "delivery_lng": HOME[1],
                                    "items": [{"product_id": 10, "store_id": 2, "quantity": 1}]})
NUM, OID = order["order_number"], order["id"]
api("POST", f"/api/porter/orders/{OID}/take", {}, PH)
api("POST", f"/api/seller/orders/{OID}/handed", {}, SH)
for item in order["items"]:
    api("PATCH", f"/api/porter/items/{item['id']}/picked", {"is_picked": True}, PH)
api("PATCH", f"/api/porter/orders/{OID}/status", {"status": "handed_over"}, PH)
print("taxi take:", api("POST", f"/api/taxi/orders/{OID}/take", {"eta_minutes": 5}, TH).get("detail", "ok"), flush=True)
print("on the way:", api("PATCH", f"/api/taxi/orders/{OID}/status", {"status": "on_the_way"}, TH).get("detail", "ok"), flush=True)


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

        await cmd("Page.enable"); await cmd("Runtime.enable")
        await cmd("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 2, "mobile": True})
        await cmd("Page.navigate", {"url": f"{B}/?lang=uz&tab=orders&order={NUM}"}); await asyncio.sleep(6)
        ok(not await js("!!document.querySelector('[data-testid=taxi-marker]')"), "before the first point there is no car on the map")
        await js("window.__samePage = true")

        spots = []
        for stop in range(STOPS):
            part = stop / (STOPS - 1)
            send_location(START[0] + (HOME[0] - START[0]) * part, START[1] + (HOME[1] - START[1]) * part)
            await asyncio.sleep(3)  # the screen must follow within seconds, it has no reason to wait for a refresh
            where = await js("document.querySelector('[data-testid=taxi-marker]')?.style.transform || ''")
            spots.append(where)
            print(f"point {stop + 1}: {where}", flush=True)
            await shot(f"sim_{stop + 1}.png")
            await asyncio.sleep(8)  # the server keeps one point in 10 seconds

        ok(spots[0] != "", "the first point puts the car 🚕 on the map")
        ok(len(set(spots)) == STOPS, f"the car moved at every one of the {STOPS} points: {len(set(spots))} different places")
        ok(await js("window.__samePage === true"), "the customer's screen did not reload: the car moved by itself")
        saved = api("GET", f"/api/orders/{NUM}")
        ok(abs(saved["taxi_lat"] - HOME[0]) < 1e-6 and abs(saved["taxi_lng"] - HOME[1]) < 1e-6, "the last point is the customer's home")
        href = await js("document.querySelector('[data-testid=taxi-where]')?.href || ''")
        ok(f"{HOME[1]},{HOME[0]}" in href, "«Taksi qayerda» points at the car's last place")

asyncio.run(main())
