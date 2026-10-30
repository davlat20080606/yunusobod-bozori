"""Counted stock in the UI: the seller's morning list, «only N left» in the shop, no more than is left, sold out."""
import asyncio, json, urllib.request, urllib.error, websockets, base64, sys
S = sys.argv[1]
B = "http://127.0.0.1:8099"
MEAT = "Yosh Qo'y"


def api(method, path, body=None, h=None):
    req = urllib.request.Request(B + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **(h or {})}, method=method)
    try:
        return json.loads(urllib.request.urlopen(req).read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read() or b"{}")


def ok(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg, flush=True)


seller = api("POST", "/api/seller/login", {"phone_or_slug": "+998 93 222-33-44", "pin": "2222"})
SH = {"x-seller-token": seller["token"]}


def meat():
    return next(p for p in api("GET", "/api/seller/my-store", h=SH)["products"] if p["name_uz"].startswith(MEAT))


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

        # the meat card's "+" button, wherever it is on the home screen
        card_plus = f"""(()=>{{for(const b of document.querySelectorAll('button')){{if(!b.querySelector('svg.lucide-plus'))continue;let c=b;for(let k=0;k<6&&c;k++){{c=c.parentElement;if(c&&c.innerText.length<400&&c.innerText.includes({json.dumps(MEAT)})){{b.scrollIntoView({{block:'center'}});b.click();return c.innerText}}if(c&&c.innerText.length>=400)break}}}}return null}})()"""
        card_text = f"""(()=>{{const els=[...document.querySelectorAll('article')].filter(a=>a.innerText.includes({json.dumps(MEAT)}));return els.map(a=>a.innerText.replace(/\\n/g,' | ')).join(' ## ')}})()"""

        await cmd("Runtime.enable"); await cmd("Network.enable"); await cmd("Network.setCacheDisabled", {"cacheDisabled": True})
        await cmd("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
        await go("")
        await js(f"localStorage.setItem('seller_session', {json.dumps(json.dumps({'token': seller['token'], 'store': seller['store']}))})")
        await js("localStorage.removeItem('yunusobod_cart')")

        # Seller: the morning message's button opens the stock list
        await go("&tab=seller_cabinet&stock=1", wait=6)
        ok("Bugungi qoldiq" in (await js("document.body.innerText") or ""), "seller sees «Bugungi qoldiq»")
        typed = await js(f"""(()=>{{const row=[...document.querySelectorAll('#stock div')].filter(d=>d.innerText.includes({json.dumps(MEAT)})&&d.querySelector('input[aria-label=quantity]')).sort((a,b)=>a.innerText.length-b.innerText.length)[0];if(!row)return false;const i=row.querySelector('input[aria-label=quantity]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'1.5');i.dispatchEvent(new Event('input',{{bubbles:true}}));return true}})()""")
        ok(typed, "seller typed 1.5 kg for the lamb")
        await js("[...document.querySelectorAll('#stock button')].find(b=>b.innerText.trim()==='Saqlash').click()")
        await asyncio.sleep(2)
        await shot("stock_seller.png")
        m = meat()
        ok(m["track_stock"] and m["stock_quantity"] == 1.5 and m["available_quantity"] == 1.5, f"saved: 1.5 kg counted ({m['available_quantity']})")

        # Customer: «only 1.5 kg left», and the + stops at 1.5 kg
        await js("localStorage.removeItem('seller_session')")
        await go("")
        text = await js(card_text) or ""
        ok("Faqat 1.5 kg qoldi" in text, f"the shop shows «Faqat 1.5 kg qoldi»: {text[:80]}")
        for _ in range(6):
            await js(card_plus); await asyncio.sleep(0.4)
        await shot("stock_shop.png")
        text = await js(card_text) or ""
        ok("1.5 kg" in text and "2 kg" not in text and "2.5 kg" not in text, f"pressing + many times stops at 1.5 kg: {text[:90]}")

        # Someone orders the last 1.5 kg: the shop shows it as sold out
        r = api("POST", "/api/orders", {"customer_name": "Mijoz", "customer_phone": "+998 90 600-00-01", "delivery_time_slot": "Morning (09:00-11:00)",
                                        "payment_method": "cash", "fulfillment": "self", "items": [{"product_id": m["id"], "store_id": m["store_id"], "quantity": 1.5}]})
        ok(r.get("order_number"), "another customer orders the last 1.5 kg")
        await js("localStorage.removeItem('yunusobod_cart')")
        await go("")
        text = await js(card_text) or ""
        ok("Hozir yo'q" in text, f"the shop shows «Hozir yo'q»: {text[:80]}")
        await shot("stock_soldout.png")


asyncio.run(main())
