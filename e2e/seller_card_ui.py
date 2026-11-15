"""Payment between customer and seller: the seller's card shows in the customer's order with a copy button."""
import asyncio, base64, json, sys, urllib.request, websockets
S = sys.argv[1]
B = "http://127.0.0.1:8099"


def ok(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg, flush=True)


def api(method, path, body=None, headers=None):
    req = urllib.request.Request(B + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **(headers or {})}, method=method)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


async def main():
    seller = api("POST", "/api/seller/login", {"phone_or_slug": "+998 93 222-33-44", "pin": "2222"})
    sid = seller["store"]["id"]
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
        await cmd("Emulation.setDeviceMetricsOverride", {"width": 375, "height": 800, "deviceScaleFactor": 2, "mobile": True})
        h = {"x-seller-token": seller["token"]}
        api("PATCH", "/api/seller/stores/me", {"payment_card": "9860 1234 5678 9012"}, h)
        o = api("POST", "/api/orders", {
            "customer_name": "Mijoz", "customer_phone": "+998 90 466-00-01", "delivery_time_slot": "Morning (09:00-11:00)",
            "payment_method": "cash", "fulfillment": "self", "items": [{"product_id": 10, "store_id": sid, "quantity": 1}]})

        await cmd("Page.navigate", {"url": f"{B}/?lang=ru&tab=orders&order={o['order_number']}"}); await asyncio.sleep(3)
        has = await js("(()=>{const b=document.querySelector('[data-testid=seller-pay]');if(!b)return null;b.scrollIntoView({block:'center'});return b.innerText})()")
        ok(bool(has) and "договариваетесь с продавцом сами" in has, "order shows «agree with the seller yourself»")
        num = await js("(document.querySelector('[data-testid=seller-card-number]')||{}).innerText")
        ok(num == "9860 1234 5678 9012", f"the seller's card is in the order ({num})")
        await shot("seller_card_order")
        w = await js("document.documentElement.scrollWidth")
        ok(w <= 376, f"fits the phone ({w})")

        await cmd("Page.navigate", {"url": f"{B}/?lang=uz&tab=orders&order={o['order_number']}"}); await asyncio.sleep(3)
        text = await js("(document.querySelector('[data-testid=seller-pay]')||{}).innerText || ''")
        ok("o'zingiz kelishasiz" in text and "Nusxalash" in text, "Uzbek text and copy button")

asyncio.run(main())
