"""Before the pilot, in the UI: with «Faqat O'zim olaman» on the customer sees only self pickup,
a wrong typed phone is stopped at checkout, and the Bozorkom can turn delivery back on."""
import asyncio, json, urllib.request, urllib.error, websockets, base64, sys
S = sys.argv[1]
B = "http://127.0.0.1:8099"
PRODUCT = "Bodring 'Orzu'"


def api(method, path, body=None, h=None):
    req = urllib.request.Request(B + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **(h or {})}, method=method)
    try:
        return json.loads(urllib.request.urlopen(req).read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read() or b"{}")


def ok(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg, flush=True)


admin = api("POST", "/api/admin/login", {"pin": "909090"})
A = {"x-admin-token": admin["token"]}
api("PUT", "/api/admin/settings", {"self_pickup_only": True}, A)


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

        async def go(query="", wait=4.5):
            await cmd("Page.navigate", {"url": B + "/?lang=uz" + query}); await asyncio.sleep(wait)

        async def click(text, wait=1.5):
            res = await js(f"(()=>{{const b=[...document.querySelectorAll('button')].find(b=>b.innerText.includes({json.dumps(text)}));if(!b)return false;b.scrollIntoView({{block:'center'}});b.click();return true}})()")
            await asyncio.sleep(wait)
            return res

        async def body(): return await js("document.body.innerText") or ""

        async def open_checkout():
            await go()
            await js(f"""(()=>{{for(const b of document.querySelectorAll('button')){{if(!b.querySelector('svg.lucide-plus'))continue;let c=b;for(let k=0;k<6&&c;k++){{c=c.parentElement;if(c&&c.innerText.length<400&&c.innerText.includes({json.dumps(PRODUCT)})){{b.scrollIntoView({{block:'center'}});b.click();return true}}if(c&&c.innerText.length>=400)break}}}}return false}})()""")
            await asyncio.sleep(1)
            await js("(()=>{const b=[...document.querySelectorAll('button.animate-fade')].find(b=>getComputedStyle(b).position==='fixed');b&&b.click()})()")
            await asyncio.sleep(2)
            await click("Rasmiylashtirish", wait=3)

        await cmd("Runtime.enable"); await cmd("Network.setCacheDisabled", {"cacheDisabled": True})
        await cmd("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
        await go()
        await js("localStorage.removeItem('yunusobod_cart')")

        await open_checkout()
        text = await body()
        ok("Qanday olasiz" in text and "Rastalardan" in text, "checkout offers self pickup")
        ok("Aravachi + taksi" not in text and "Bozordagi joyga" not in text, "and no delivery while the pilot is self pickup only")
        await shot("prepilot_checkout.png")

        # Outside Telegram the phone is typed: a short number stops at the form
        filled = await js("""(()=>{const set=(el,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}))};const p=document.querySelector('input[type=tel]');if(!p)return false;const n=[...document.querySelectorAll('input')].find(i=>i!==p&&i.type!=='checkbox');set(n,'Aziza');set(p,'+998 90 12');return true})()""")
        ok(filled, "typed a name and a short phone")
        await asyncio.sleep(0.5)
        await click("Buyurtma berish", wait=2)
        ok("+998 XX XXX-XX-XX" in await body(), "the short phone is refused with the right format")

        # The Bozorkom's switch
        await go()
        await js(f"localStorage.setItem('admin_session', {json.dumps(json.dumps({'token': admin['token']}))})")
        await go("&tab=admin", wait=5)
        await click("Sozlamalar", wait=2)
        ok("Faqat «O'zim olaman»" in await body(), "the switch is in «Sozlamalar»")
        await shot("prepilot_switch.png")
        await js("document.querySelector('[aria-label=\"self pickup only\"]').click()")
        await asyncio.sleep(2)
        ok(api("GET", "/api/config")["self_pickup_only"] is False, "the Bozorkom turned delivery on")
        await js("localStorage.removeItem('admin_session')")
        await open_checkout()
        ok("Aravachi + taksi" in await body(), "the customer sees delivery again")


asyncio.run(main())
