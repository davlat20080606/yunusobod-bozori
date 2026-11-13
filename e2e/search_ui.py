"""Search: a product a seller adds while the customer's app is open shows up in the search without reopening the app;
search finds products in uz/ru, any apostrophe, stalls by name, and says so when nothing matches."""
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

        async def search(text):
            await js("""(()=>{const i=document.querySelector('.med-search-input');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
                set.call(i,'');i.dispatchEvent(new Event('input',{bubbles:true}));})()""")
            await asyncio.sleep(0.3)
            await js(f"""(()=>{{const i=document.querySelector('.med-search-input');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
                set.call(i,{json.dumps(text)});i.dispatchEvent(new Event('input',{{bubbles:true}}));}})()""")
            await asyncio.sleep(1.5)
            return await js("(()=>{const r=document.querySelector('[data-testid=search-results]');return r?r.innerText:null})()")

        async def shot(name):
            r = await cmd("Page.captureScreenshot", {"format": "png"}); open(f"{S}/{name}.png", "wb").write(base64.b64decode(r["result"]["data"]))

        await cmd("Page.enable"); await cmd("Runtime.enable")
        await cmd("Emulation.setDeviceMetricsOverride", {"width": 375, "height": 800, "deviceScaleFactor": 2, "mobile": True})
        await cmd("Page.navigate", {"url": f"{B}/?lang=uz"}); await asyncio.sleep(3)

        r = await search("go'sht")
        ok(r and "Topildi" in r, f"search shows results at all: {r and r[:60]!r}")
        r2 = await search("goʻsht")
        ok(r2 == r, "another apostrophe (goʻsht) finds the same")

        # The seller adds a product while the customer's app stays open
        seller = api("POST", "/api/seller/login", {"phone_or_slug": "+998 93 222-33-44", "pin": "2222"})
        api("POST", "/api/seller/stores/me/products", {"name_uz": "Qo'zichoq jigari", "name_ru": "Печень ягнёнка", "category_slug": "meat",
                                                       "price": 95000, "unit": "kg"}, {"x-seller-token": seller["token"]})
        r = await search("jigar")
        ok(r and "Qo'zichoq jigari" in r, f"new product found without reopening the app: {r and r[:80]!r}")
        await shot("search_new")
        r = await search("печень")
        ok(r and "jigari" in r.lower() or (r and "Печень" in r), "found by its Russian name too")
        r = await search("karen")
        ok(r and "Rastalar" in r and await js("document.querySelectorAll('[data-testid=search-store]').length") >= 1, "stall found by the seller's name")
        await js("document.querySelector('[data-testid=search-store]').click()"); await asyncio.sleep(1.5)
        ok(not await js("document.querySelector('[data-testid=search-results]')") and await js("document.querySelector('.med-search-input').value") == "",
           "tapping the stall opens it and clears the search")
        r = await search("zzzqqq")
        ok(r and "Hech narsa topilmadi" in r, "nothing found: says so")
        await shot("search_none")
        await js("document.querySelector('[data-testid=search-results] button').click()"); await asyncio.sleep(1)
        ok(not await js("document.querySelector('[data-testid=search-results]')"), "«clear search» brings the home screen back")
        await cmd("Emulation.setDeviceMetricsOverride", {"width": 320, "height": 640, "deviceScaleFactor": 2, "mobile": True})
        r = await search("olma")
        w = await js("document.documentElement.scrollWidth")
        ok(r and w <= 321, f"results fit a 320 px phone (page {w})")
        await shot("search_320")

asyncio.run(main())
