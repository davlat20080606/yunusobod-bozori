"""«Xaridor kelmadi» in the UI: the aravachi waits and calls, the customer says «Men shu yerdaman»,
after 15 minutes the aravachi gives up, the bag goes back and the seller presses «Qaytib oldim»."""
import asyncio, json, urllib.request, urllib.error, websockets, base64, sys, random, sqlite3
from datetime import datetime, timedelta, timezone
S = sys.argv[1]
B = "http://127.0.0.1:8099"
DB = f"{S}/noshow.db"


def api(method, path, body=None, h=None):
    req = urllib.request.Request(B + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **(h or {})}, method=method)
    try:
        return json.loads(urllib.request.urlopen(req).read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read() or b"{}")


def ok(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg, flush=True)


A = {"x-admin-token": api("POST", "/api/admin/login", {"pin": "909090"})["token"]}
seller = api("POST", "/api/seller/login", {"phone_or_slug": "+998 93 222-33-44", "pin": "2222"})
SH = {"x-seller-token": seller["token"]}
ph = f"+99893{random.randint(1000000, 9999999)}"
api("POST", "/api/staff/register", {"role": "porter", "name": "Jasur Aravachi", "phone": ph, "pin": "1234"})
sid = [x for x in api("GET", "/api/admin/staff", h=A) if x["phone"].replace(" ", "").endswith(ph[-9:])][0]["id"]
api("POST", f"/api/admin/staff/{sid}/status", {"status": "approved"}, A)
porter = api("POST", "/api/staff/login", {"phone": ph, "pin": "1234"})
PH = {"x-staff-token": porter["token"]}

order = api("POST", "/api/orders", {"customer_name": "Aziza", "customer_phone": "+998 90 720-00-01", "delivery_time_slot": "Morning (09:00-11:00)",
                                    "payment_method": "cash", "fulfillment": "point", "handoff_point": "main_gate",
                                    "items": [{"product_id": 10, "store_id": 2, "quantity": 1}]})
NUM = order["order_number"]
api("POST", f"/api/porter/orders/{order['id']}/take", {}, PH)
api("POST", f"/api/seller/orders/{order['id']}/handed", {}, SH)
for item in order["items"]:
    api("PATCH", f"/api/porter/items/{item['id']}/picked", {"is_picked": True}, PH)
api("PATCH", f"/api/porter/orders/{order['id']}/status", {"status": "at_point"}, PH)


def backdate(minutes):
    with sqlite3.connect(DB) as c:
        c.execute("UPDATE orders SET waiting_since = ? WHERE id = ?", ((datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=minutes)).isoformat(sep=" "), order["id"]))


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

        async def open_porter_order():
            await js(f"localStorage.setItem('staff_session', {json.dumps(json.dumps({'token': porter['token'], 'staff': porter['staff']}))})")
            await go("&tab=porter", wait=5)
            await click("Mening buyurtmalarim", wait=1.5)
            return await click("Ochish", within=NUM, wait=2)

        await cmd("Runtime.enable"); await cmd("Page.enable")
        await cmd("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
        await go("")

        # Aravachi at the point: the clock runs, the button is not there yet
        ok(await open_porter_order(), "aravachi opens the order at the point")
        text = await body()
        button = await js("[...document.querySelectorAll('button')].some(b=>b.innerText.includes('Xaridor kelmadi'))")
        ok("Kutilmoqda: 0 daq" in text and "15 daqiqadan keyin ochiladi" in text and not button,
           "just arrived: waiting 0 min, «Xaridor kelmadi» not yet available")
        await shot("noshow_wait.png")

        # Customer: «They are waiting for you» and «Men shu yerdaman»
        await js("localStorage.removeItem('staff_session')")
        await go(f"&tab=orders&order={NUM}", wait=5)
        text = await body()
        ok("Sizni kutishyapti" in text, "the customer sees «Sizni kutishyapti»")
        ok(await click("Men shu yerdaman", wait=2), "the customer taps «Men shu yerdaman»")
        ok("xabar oldi" in await body(), "and sees that the aravachi and the Bozorkom were told")
        await shot("noshow_customer_here.png")
        kinds = [e["kind"] for e in api("GET", f"/api/admin/orders/{order['id']}/events", h=A)]
        ok("customer_here" in kinds, "it is in the order's history")

        # 16 minutes later: the aravachi may give up
        backdate(16)
        await open_porter_order()
        text = await body()
        ok("Kutilmoqda: 16 daq" in text and "Xaridor kelmadi" in text, "after 16 minutes the «Xaridor kelmadi» button is there")
        await js("window.confirm = () => true")
        ok(await click("Xaridor kelmadi", wait=3), "aravachi presses «Xaridor kelmadi»")
        text = await body()
        ok("Rastalarga qaytaring" in text and "birinchi" in text, "he gets the return list, meat marked to go first")
        await shot("noshow_return.png")

        # Customer sees it
        await js("localStorage.removeItem('staff_session')")
        await go(f"&tab=orders&order={NUM}", wait=5)
        ok("Sizni kuta olmadik" in await body(), "the customer's tracker says «Sizni kuta olmadik»")

        # Seller: «Qaytib oldim»
        await js(f"localStorage.setItem('seller_session', {json.dumps(json.dumps({'token': seller['token'], 'store': seller['store']}))})")
        await go("&tab=seller_cabinet", wait=6)
        ok("Xaridor kelmadi" in await body(), "the seller sees the no-show")
        ok(await click("Qaytib oldim", within=NUM, wait=3), "the seller presses «Qaytib oldim»")
        await shot("noshow_seller.png")
        status = api("GET", f"/api/orders/{NUM}")["status"]
        ok(status == "returned", f"the order is closed as returned: {status}")


asyncio.run(main())
