"""The stall's permanent QR: the seller sees a printable poster in the cabinet; a ?store link opens the stall."""
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

        # A link with ?store=<id> still opens that stall (customers who scan the QR get the bot's start page, checked in the API test)
        await cmd("Page.navigate", {"url": f"{B}/?store={sid}&lang=ru"}); await asyncio.sleep(3)
        text = await js("document.body.innerText")
        ok("Карен" in text and "Rasta 14" in text.replace("Раста", "Rasta"), "?store link opens Karen's stall page")
        await shot("stall_from_qr")

        await js(f"localStorage.setItem('seller_session', {json.dumps(json.dumps({'token': seller['token'], 'store': seller['store']}))})")
        await cmd("Page.navigate", {"url": f"{B}/?tab=seller_cabinet&lang=uz"}); await asyncio.sleep(3)
        has = await js("(()=>{const b=document.querySelector('[data-testid=stall-qr]');if(!b)return false;b.scrollIntoView({block:'center'});return true})()")
        ok(has, "seller cabinet has «Rasta QR kodi»")
        await js("document.querySelector('[data-testid=stall-qr-show]').click()"); await asyncio.sleep(2)
        size = await js("(()=>{const i=document.querySelector('[data-testid=stall-qr-poster]');return i&&i.complete?[i.naturalWidth,i.naturalHeight]:null})()")
        ok(size == [800, 1060], f"printable poster drawn {size}")
        await js("document.querySelector('[data-testid=stall-qr-poster]').scrollIntoView({block:'center'})"); await shot("stall_qr_poster")
        src = await js("document.querySelector('[data-testid=stall-qr-poster]').src")
        open(f"{S}/stall_qr_poster_only.png", "wb").write(base64.b64decode(src.split(",", 1)[1]))
        w = await js("document.documentElement.scrollWidth")
        ok(w <= 376, f"fits the phone ({w})")

asyncio.run(main())
