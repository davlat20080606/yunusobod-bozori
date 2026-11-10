"""Express order, no aravachi in 7 minutes: the customer sees a countdown, then «wait 3 more / collect myself / cancel».
Stalls in two columns on phones. The 7 minutes are shortened by writing search_until into the test database."""
import asyncio, base64, json, sqlite3, sys, urllib.request, websockets
from datetime import datetime, timedelta
S = sys.argv[1]
DB = f"{S}/porter_search.db"
B = "http://127.0.0.1:8099"


def ok(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg, flush=True)


def post(path, body=None):
    req = urllib.request.Request(B + path, data=json.dumps(body or {}).encode(), headers={"Content-Type": "application/json"}, method="POST")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def set_until(order_id, seconds):
    with sqlite3.connect(DB) as con:
        con.execute("UPDATE orders SET search_until=? WHERE id=?",
                    ((datetime.utcnow() + timedelta(seconds=seconds)).strftime("%Y-%m-%d %H:%M:%S.%f"), order_id))


def new_order():
    prods = json.loads(urllib.request.urlopen(B + "/api/products").read())
    prods = prods.get("items", prods) if isinstance(prods, dict) else prods
    p = [x for x in prods if x.get("is_available")][0]
    return post("/api/orders", {"customer_name": "Sinov", "customer_phone": "+998901112233", "delivery_time_slot": "Morning (09:00-11:00)",
                                "payment_method": "cash", "fulfillment": "courier", "handoff_point": "main_gate",
                                "delivery_address": "Yunusobod 4", "delivery_lat": 41.36, "delivery_lng": 69.29,
                                "items": [{"product_id": p["id"], "store_id": p["store_id"], "quantity": 1}]})


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
            r = await cmd("Page.captureScreenshot", {"format": "png"}); open(f"{S}/{name}.png", "wb").write(base64.b64decode(r["result"]["data"]))

        await cmd("Page.enable"); await cmd("Runtime.enable")
        await cmd("Emulation.setDeviceMetricsOverride", {"width": 360, "height": 780, "deviceScaleFactor": 2, "mobile": True})
        await js("window.confirm = () => true")

        o = new_order()
        set_until(o["id"], 65)
        url = f"{B}/?lang=ru&tab=orders&order={o['order_number']}"
        await cmd("Page.navigate", {"url": url}); await asyncio.sleep(3); await js("window.confirm = () => true")
        t1 = await js("document.querySelector('[data-testid=porter-search-timer]')?.innerText")
        await asyncio.sleep(2.2)
        t2 = await js("document.querySelector('[data-testid=porter-search-timer]')?.innerText")
        ok(t1 and t1.startswith("1:0") and t2 and t1 != t2, f"countdown runs: {t1} -> {t2}")
        await js("document.querySelector('[data-testid=porter-search]').scrollIntoView({block:'center'})"); await shot("search_timer")

        # Time is up: the three choices appear on their own when the countdown reaches zero
        set_until(o["id"], 9)
        await cmd("Page.navigate", {"url": url}); await asyncio.sleep(3); await js("window.confirm = () => true")
        before = await js("!!document.querySelector('[data-testid=porter-search-timer]')")
        await asyncio.sleep(8)
        await js("document.querySelector('[data-testid=porter-search-over]')?.scrollIntoView({block:'center'})")
        over = await js("(()=>{const b=document.querySelector('[data-testid=porter-search-over]');return b&&b.innerText})()")
        ok(before and over and "Подожду ещё 3 минуты" in over and "Заберу сам" in over and "Отменить" in over, f"three choices: {over and over[:120]!r}")
        await shot("search_over")

        await js("document.querySelector('[data-testid=search-wait]').click()"); await asyncio.sleep(2)
        t3 = await js("document.querySelector('[data-testid=porter-search-timer]')?.innerText")
        ok(t3 and (t3.startswith("2:5") or t3 == "3:00"), f"«wait 3 more» starts a new countdown: {t3}")

        set_until(o["id"], -2)
        await cmd("Page.navigate", {"url": url}); await asyncio.sleep(3); await js("window.confirm = () => true")
        fee_before = await js("document.body.innerText.includes('Заберу сам')")
        await js("document.querySelector('[data-testid=search-self]').click()"); await asyncio.sleep(2.5)
        text = await js("document.body.innerText")
        ok(fee_before and "Самовывоз" in text or "Заберу на растах" in text or "сам" in text.lower(), "switched: page shows self pickup")
        ok(not await js("document.querySelector('[data-testid=porter-search-over],[data-testid=porter-search]')"), "the search box is gone")
        server = json.loads(urllib.request.urlopen(f"{B}/api/orders/{o['order_number']}").read())
        ok(server["fulfillment"] == "self" and server["delivery_fee"] == 0, f"server: self pickup, no delivery fee ({server['total_amount']})")
        await shot("search_self")

        o2 = new_order(); set_until(o2["id"], -2)
        await cmd("Page.navigate", {"url": f"{B}/?lang=uz&tab=orders&order={o2['order_number']}"}); await asyncio.sleep(3); await js("window.confirm = () => true")
        await js("document.querySelector('[data-testid=search-cancel]').click()"); await asyncio.sleep(2.5)
        server = json.loads(urllib.request.urlopen(f"{B}/api/orders/{o2['order_number']}").read())
        ok(server["status"] == "cancelled", "cancel from the choices: order cancelled")

        # Stalls: two columns on every phone, nothing sticks out
        for w in (320, 360, 412):
            await cmd("Emulation.setDeviceMetricsOverride", {"width": w, "height": 800, "deviceScaleFactor": 2, "mobile": True})
            await cmd("Page.navigate", {"url": f"{B}/?lang=ru"}); await asyncio.sleep(3)
            r = await js("""(()=>{const c=[...document.querySelectorAll('.med-store-card')];if(c.length<2)return null;c[0].scrollIntoView({block:'start'});
              const a=c[0].getBoundingClientRect(),b=c[1].getBoundingClientRect();
              const out=c.some(x=>{const r=x.getBoundingClientRect();return r.right>innerWidth+1||r.left<-1});
              return {sameRow:Math.abs(a.top-b.top)<2,width:Math.round(a.width),out,page:document.documentElement.scrollWidth}})()""")
            ok(r and r["sameRow"] and not r["out"] and r["page"] <= w + 1, f"{w}px stalls in two columns: {r}")
            await asyncio.sleep(0.5); await shot(f"stalls_{w}")

asyncio.run(main())
