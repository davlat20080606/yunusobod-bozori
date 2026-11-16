"""Platform rules: «DIQQAT!» on the first visit, the full rules page, accepted once, link in the footer."""
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

        gate = "(document.querySelector('[data-testid=terms-gate]')||{}).innerText || ''"
        await cmd("Page.enable"); await cmd("Runtime.enable")
        await cmd("Emulation.setDeviceMetricsOverride", {"width": 375, "height": 800, "deviceScaleFactor": 2, "mobile": True})

        await cmd("Page.navigate", {"url": f"{B}/?lang=uz"}); await asyncio.sleep(3)
        text = await js(gate)
        ok("DIQQAT" in text and "nasiya" in text and "O'zbekiston Respublikasi qonunchiligiga" in text, "first visit: «DIQQAT!» in Uzbek")
        await shot("terms_gate_uz")

        await js("document.querySelector('[data-testid=terms-read]').click()"); await asyncio.sleep(1)
        page = await js("(document.querySelector('[data-testid=terms-page]')||{}).innerText || ''")
        ok("Foydalanish shartlari" in page and "Shaxsiy ma'lumotlar" in page and not await js(gate), "«To'liq qoidalar» opens the full rules (window hidden)")
        await shot("terms_page_uz")
        await js("[...document.querySelectorAll('[data-testid=terms-page] button')][0].click()"); await asyncio.sleep(1)
        ok("DIQQAT" in await js(gate), "back from the rules: still has to accept")

        await js("document.querySelector('[data-testid=terms-agree]').click()"); await asyncio.sleep(1)
        ok(not await js(gate), "«Roziman» closes it")
        await cmd("Page.navigate", {"url": f"{B}/?lang=uz"}); await asyncio.sleep(3)
        ok(not await js(gate), "asked once: not shown again")

        has = await js("(()=>{const b=document.querySelector('[data-testid=footer-terms]');if(!b)return false;b.click();return true})()"); await asyncio.sleep(1)
        ok(has and "Foydalanish shartlari" in (await js("(document.querySelector('[data-testid=terms-page]')||{}).innerText || ''")), "footer link opens the rules")

        await js("localStorage.removeItem('terms_accepted')")
        await cmd("Page.navigate", {"url": f"{B}/?lang=ru"}); await asyncio.sleep(3)
        text = await js(gate)
        ok("ВНИМАНИЕ" in text and "насия" in text and "Согласен" in text, "in Russian too")
        await shot("terms_gate_ru")
        w = await js("document.documentElement.scrollWidth")
        ok(w <= 376, f"fits the phone ({w})")

asyncio.run(main())
