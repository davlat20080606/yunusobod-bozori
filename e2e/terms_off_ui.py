"""Davlatbek: the platform rules are off until the official payment gateway is ready (the default)."""
import asyncio, json, sys, urllib.request, websockets
S = sys.argv[1]
B = "http://127.0.0.1:8099"


def ok(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg, flush=True)


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

        await cmd("Page.enable"); await cmd("Runtime.enable")
        await cmd("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
        status = json.loads(urllib.request.urlopen(f"{B}/api/terms/status").read())
        ok(status.get("enabled") is False, f"the server says the rules are off ({status})")
        await cmd("Page.navigate", {"url": f"{B}/?lang=uz"}); await asyncio.sleep(3.5)
        ok(not await js("!!document.querySelector('[data-testid=terms-gate]')"), "first visit: no «DIQQAT!» window")
        ok(await js("!!document.querySelector('[data-testid=welcome-hero]')"), "the home screen opens straight away")
        ok(not await js("!!document.querySelector('[data-testid=footer-terms]')"), "no rules link in the footer")
        await cmd("Page.navigate", {"url": f"{B}/?lang=uz&tab=terms"}); await asyncio.sleep(3)
        ok(not await js("!!document.querySelector('[data-testid=terms-page]')") and await js("!!document.querySelector('[data-testid=welcome-hero]')"),
           "the old rules address opens the home screen")

asyncio.run(main())
