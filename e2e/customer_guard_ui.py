"""Bozorkom blocks a customer on the «Xaridorlar» tab; the customer then sees why the order is refused."""
import asyncio, json, urllib.request, urllib.error, websockets, base64, sys
S = sys.argv[1]
B = "http://127.0.0.1:8099"
PHONE = "+998 90 777-00-01"


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
api("POST", "/api/orders", {"customer_name": "Soxta Mijoz", "customer_phone": PHONE, "delivery_time_slot": "Morning (09:00-11:00)",
                            "payment_method": "cash", "fulfillment": "self", "items": [{"product_id": 10, "store_id": 2, "quantity": 1}]})


def customer():
    return next((c for c in api("GET", "/api/admin/customers?q=907770001", h=A)), {})


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

        async def go(query, wait=4.5):
            await cmd("Page.navigate", {"url": B + "/?lang=uz" + query}); await asyncio.sleep(wait)

        async def click(text, within=None, wait=1.5):
            scope = f"[...document.querySelectorAll('div')].filter(d=>d.innerText.includes({json.dumps(within)})&&[...d.querySelectorAll('button')].some(b=>b.innerText.includes({json.dumps(text)}))).sort((a,b)=>a.innerText.length-b.innerText.length)[0]" if within else "document"
            res = await js(f"(()=>{{const root={scope};const b=root&&[...root.querySelectorAll('button')].find(b=>b.innerText.includes({json.dumps(text)}));if(!b)return false;b.scrollIntoView({{block:'center'}});b.click();return true}})()")
            await asyncio.sleep(wait)
            return res

        await cmd("Runtime.enable"); await cmd("Network.enable"); await cmd("Network.setCacheDisabled", {"cacheDisabled": True})
        await cmd("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
        await go("")
        await js(f"localStorage.setItem('admin_session', {json.dumps(json.dumps({'token': admin['token']}))})")

        # Bozorkom: the customers tab, block with a reason
        await go("&tab=admin", wait=5)
        ok(await click("Xaridorlar", wait=3), "Bozorkom opens «Xaridorlar»")
        text = await js("document.body.innerText")
        ok("Soxta Mijoz" in text and "1 buyurtma" in text, "the customer is listed with the order count")
        await js("window.prompt = () => 'soxta buyurtmalar'")
        ok(await click("Bloklash", within="Soxta Mijoz", wait=3), "pressed «Bloklash»")
        await shot("guard_blocked.png")
        text = await js("document.body.innerText")
        ok("Bloklangan" in text and "soxta buyurtmalar" in text, "the card shows «Bloklangan» and the reason")
        ok(customer().get("blocked") is True, "the block is saved")

        # The limits are in the settings
        await click("Sozlamalar", wait=2)
        text = await js("document.body.innerText")
        ok("Soxta buyurtmalardan himoya" in text and "Birinchi buyurtma" in text, "limits are shown in «Sozlamalar»")

        # The blocked customer tries to order in the shop and sees why it does not work
        await js("localStorage.removeItem('admin_session')")
        await go("")
        added = await js("""(()=>{for(const b of document.querySelectorAll('button')){if(!b.querySelector('svg.lucide-plus'))continue;let c=b;for(let k=0;k<6&&c;k++){c=c.parentElement;if(c&&c.innerText.length<400&&c.innerText.includes("Yosh Qo'y")){b.scrollIntoView({block:'center'});b.click();return true}if(c&&c.innerText.length>=400)break}}return false})()""")
        await asyncio.sleep(1)
        ok(added, "customer added meat to the cart")
        await js("(()=>{const b=[...document.querySelectorAll('button.animate-fade')].find(b=>getComputedStyle(b).position==='fixed');b&&b.click()})()")
        await asyncio.sleep(2)
        await click("Rasmiylashtirish", wait=2.5)
        await click("Rastalardan", wait=2)
        await js(f"""(()=>{{const set=(el,v)=>{{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v);el.dispatchEvent(new Event('input',{{bubbles:true}}))}};const ins=[...document.querySelectorAll('form input')];const tel=ins.find(i=>i.type==='tel');const name=ins.find(i=>i.placeholder&&i.type!=='tel'&&i.type!=='checkbox'&&!i.inputMode);name&&set(name,'Soxta Mijoz');tel&&set(tel,{json.dumps(PHONE)})}})()""")
        await asyncio.sleep(0.5)
        await click("Buyurtma berish", wait=4)
        await shot("guard_refused.png")
        text = await js("document.body.innerText")
        ok("imkoniyati yopilgan" in text, "the customer sees «Buyurtma berish imkoniyati yopilgan»")
        ok(not await js("/YB-\\d{4}-\\d{6}/.test(document.body.innerText) && document.body.innerText.includes('qabul qilindi')"), "no order was made")

        # Bozorkom unblocks
        await js(f"localStorage.setItem('admin_session', {json.dumps(json.dumps({'token': admin['token']}))})")
        await go("&tab=admin", wait=5)
        await click("Xaridorlar", wait=3)
        ok(await click("Faollashtirish", within="Soxta Mijoz", wait=3), "pressed «Faollashtirish»")
        ok(customer().get("blocked") is False, "the customer can order again")


asyncio.run(main())
