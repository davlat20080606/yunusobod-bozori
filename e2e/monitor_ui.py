"""Davlatbek and Shuhrat watch the bazaar: the partner signs in with his own PIN, the monitoring tab opens first,
day / week / month with any date, the live feed and the system's health; no buttons that change anything."""
import asyncio, json, sys, urllib.request, websockets
S = sys.argv[1]
B = "http://127.0.0.1:8099"


def ok(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg, flush=True)


def api(method, path, body=None):
    req = urllib.request.Request(B + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json"}, method=method)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


async def main():
    api("POST", "/api/orders", {"customer_name": "Mijoz", "customer_phone": "+998 90 455-77-01", "delivery_time_slot": "Morning (09:00-11:00)",
                                "payment_method": "cash", "fulfillment": "self", "items": [{"product_id": 6, "store_id": 1, "quantity": 1}]})
    partner = api("POST", "/api/admin/login", {"pin": "727272"})
    t = [x for x in json.loads(urllib.request.urlopen("http://127.0.0.1:9333/json").read()) if x["type"] == "page"][0]
    async with websockets.connect(t["webSocketDebuggerUrl"], max_size=None, ping_interval=None) as ws:
        n = [0]

        async def cmd(m, p={}):
            n[0] += 1; i = n[0]; await ws.send(json.dumps({"id": i, "method": m, "params": p}))
            while True:
                r = json.loads(await ws.recv())
                if r.get("id") == i: return r

        async def js(e): return (await cmd("Runtime.evaluate", {"expression": e, "awaitPromise": True, "returnByValue": True}))["result"].get("result", {}).get("value")

        await cmd("Page.enable"); await cmd("Runtime.enable")
        await cmd("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
        await cmd("Page.navigate", {"url": f"{B}/?lang=uz"}); await asyncio.sleep(2)
        await js(f"localStorage.setItem('admin_session', {json.dumps(json.dumps({'token': partner['token'], 'role': 'partner'}))})")
        await cmd("Page.navigate", {"url": f"{B}/?lang=uz&tab=admin"}); await asyncio.sleep(3.5)
        ok(partner["role"] == "partner" and await js("!!document.querySelector('[data-testid=partner-badge]')"), "the partner signs in with his own PIN, badge «Hamkor»")
        ok(await js("!!document.querySelector('[data-testid=monitor]')"), "monitoring opens first")
        ok(await js("!!document.querySelector('[data-testid=view-only]')"), "«view only» is said plainly")
        orders = await js("(document.querySelector('[data-testid=kpi-orders]')||{}).innerText||''")
        ok(orders.split("\n")[1].strip().isdigit() and int(orders.split("\n")[1]) >= 1, f"today's orders counted ({orders.splitlines()[:2]})")
        day_label = await js("document.querySelector('[data-testid=period-label]').innerText")
        await js("document.querySelector('[data-testid=period-week]').click()"); await asyncio.sleep(1.5)
        week_label = await js("document.querySelector('[data-testid=period-label]').innerText")
        ok("–" in week_label and week_label != day_label, f"week: a Monday–Sunday range ({week_label})")
        await js("document.querySelector('[data-testid=period-month]').click()"); await asyncio.sleep(1.5)
        month_label = await js("document.querySelector('[data-testid=period-label]').innerText")
        await js("document.querySelector('[aria-label=\"Oldingi davr\"]').click()"); await asyncio.sleep(1.5)
        prev_label = await js("document.querySelector('[data-testid=period-label]').innerText")
        ok(month_label != prev_label and len(month_label.split()) == 2, f"month, and the month before ({month_label} → {prev_label})")
        await js("document.querySelector('[data-testid=monitor-view-1]').click()"); await asyncio.sleep(2)
        feed = await js("(document.querySelector('[data-testid=feed]')||{}).innerText||''")
        ok("Yangi buyurtma" in feed, "the live feed shows the new order")
        await js("document.querySelector('[data-testid=monitor-view-2]').click()"); await asyncio.sleep(2)
        ok("MB" in (await js("(document.querySelector('[data-testid=system-db]')||{}).innerText||''")), "system: database size against the free limit")
        await js("[...document.querySelectorAll('button')].find(b=>/Rastalar/.test(b.innerText)).click()"); await asyncio.sleep(1)
        actions = await js("[...document.querySelectorAll('button')].filter(b=>/Bloklash|Tasdiqlash|Yangi PIN|Bekor qilish/.test(b.innerText)).length")
        ok(actions == 0, f"no buttons that change anything ({actions})")
        w = await js("document.documentElement.scrollWidth")
        ok(w <= 391, f"fits the phone ({w})")

asyncio.run(main())
