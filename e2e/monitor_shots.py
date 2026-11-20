"""Screenshots of the founders' monitoring tab at 390px and 1440px (visual audit): python monitor_shots.py <out dir> <base url>."""
import asyncio, base64, json, sys, urllib.request, websockets
OUT, B = sys.argv[1], sys.argv[2]


def api(method, path, body=None, headers=None):
    req = urllib.request.Request(B + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **(headers or {})}, method=method)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


async def main():
    admin = {"x-admin-token": api("POST", "/api/admin/login", {"pin": "909090"})["token"]}
    api("PUT", "/api/admin/settings", {"max_open_orders": 20, "new_customer_max_open": 20, "new_customer_max_total": 100000000, "orders_per_10_min": 1000}, admin)
    products = [p for p in api("GET", "/api/products") if p.get("is_available", True)][:4]
    for n, p in enumerate(products):
      try:
        api("POST", "/api/orders", {"customer_name": "Mijoz", "customer_phone": f"+998 90 77{n}-00-0{n}", "delivery_time_slot": "Morning (09:00-11:00)",
                                    "payment_method": "cash", "fulfillment": "self", "items": [{"product_id": p["id"], "store_id": p["store_id"], "quantity": 1}]})
      except Exception as e:
        print("order skipped:", e)
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

        async def shot(name, w, h):
            r = await cmd("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": True, "clip": {"x": 0, "y": 0, "width": w, "height": h, "scale": 1}})
            open(f"{OUT}/mon_{name}.png", "wb").write(base64.b64decode(r["result"]["data"]))

        await cmd("Page.enable"); await cmd("Runtime.enable")
        await cmd("Page.navigate", {"url": f"{B}/?lang=ru"}); await asyncio.sleep(2)
        await js(f"localStorage.setItem('admin_session', {json.dumps(json.dumps({'token': partner['token'], 'role': 'partner'}))})")
        for w, h in ((390, 844), (1440, 900)):
            await cmd("Emulation.setDeviceMetricsOverride", {"width": w, "height": h, "deviceScaleFactor": 1, "mobile": w < 500})
            await cmd("Page.navigate", {"url": f"{B}/?lang=ru&tab=admin"}); await asyncio.sleep(3.5)
            full = await js("document.documentElement.scrollHeight")
            await shot(f"numbers_{w}", w, min(full, 2600))
            for v, name in ((1, "feed"), (2, "system")):
                await js(f"document.querySelector('[data-testid=monitor-view-{v}]').click()"); await asyncio.sleep(2)
                await shot(f"{name}_{w}", w, min(await js("document.documentElement.scrollHeight"), 2000))
            await js("document.querySelector('[data-testid=monitor-view-0]').click()"); await asyncio.sleep(0.5)
        print("tabs:", await js("[...document.querySelectorAll('button')].map(b=>b.innerText).filter(t=>/Монитор|Обзор|Настрой|Заявк/.test(t)).join(' | ')"))
        print("view-only:", await js("(document.querySelector('[data-testid=view-only]')||{}).innerText"))

asyncio.run(main())
