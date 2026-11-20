"""Phone screenshots of the customer's main screens, for design work: python shots.py <run dir> <prefix>."""
import asyncio, base64, json, sys, urllib.request, websockets
S, PREFIX = sys.argv[1], sys.argv[2]
B = "http://127.0.0.1:8099"


def api(method, path, body=None):
    req = urllib.request.Request(B + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json"}, method=method)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


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

        async def shot(name, full=False):
            p = {"format": "png"}
            if full:
                h = await js("document.documentElement.scrollHeight")
                p.update({"captureBeyondViewport": True, "clip": {"x": 0, "y": 0, "width": 390, "height": min(h, 3000), "scale": 1}})
            r = await cmd("Page.captureScreenshot", p)
            open(f"{S}/{PREFIX}_{name}.png", "wb").write(base64.b64decode(r["result"]["data"]))

        await cmd("Page.enable"); await cmd("Runtime.enable")
        await cmd("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
        await cmd("Page.navigate", {"url": f"{B}/?lang=uz"}); await asyncio.sleep(3.5)
        await shot("home")
        await shot("home_full", full=True)
        # a product opened from the first product card
        await js("(()=>{const a=document.querySelector('article.med-product-card');a&&a.scrollIntoView({block:'center'});a&&a.click()})()")
        await asyncio.sleep(1.5)
        await shot("product")
        await cmd("Page.navigate", {"url": f"{B}/?lang=uz"}); await asyncio.sleep(3)
        # two products into the cart, like a customer: the floating cart, the cart, the checkout
        await js("(()=>{const b=[...document.querySelectorAll('button[aria-label=add]')].slice(0,2);b.forEach(x=>x.click());return b.length})()")
        await asyncio.sleep(1)
        await shot("home_cart")
        await js("(()=>{const b=[...document.querySelectorAll('button.animate-fade')].find(b=>getComputedStyle(b).position==='fixed');b&&b.click()})()")
        await asyncio.sleep(1.5)
        await shot("cart")
        await js("(()=>{const b=[...document.querySelectorAll('button')].find(b=>/Rasmiylashtirish/.test(b.innerText));b&&b.click()})()")
        await asyncio.sleep(2)
        await shot("checkout")
        await js("(()=>{const el=[...document.querySelectorAll('*')].find(e=>e.scrollHeight>e.clientHeight+50&&getComputedStyle(e).overflowY==='auto');if(el)el.scrollTop=el.scrollHeight})()")
        await asyncio.sleep(0.8)
        await shot("checkout_end")
        await js("sessionStorage.clear()")
        o = api("GET", "/api/products")
        items = [p for p in (o if isinstance(o, list) else o.get("items", [])) if p.get("is_available", True)][:1]
        # an order in progress
        if items:
            order = api("POST", "/api/orders", {"customer_name": "Aziza", "customer_phone": "+998 90 123 45 67",
                                                "delivery_time_slot": "Morning (09:00-11:00)", "payment_method": "card", "fulfillment": "self",
                                                "items": [{"product_id": items[0]["id"], "store_id": items[0]["store_id"], "quantity": 1}]})
            await cmd("Page.navigate", {"url": f"{B}/?lang=uz&tab=orders&order={order['order_number']}"}); await asyncio.sleep(3)
            await shot("order")
            await shot("order_full", full=True)

asyncio.run(main())
