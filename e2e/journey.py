"""Whole order journey in the real UI, three ways: customer -> sellers -> aravachi -> taxi -> customer."""
import asyncio, json, urllib.request, websockets, base64, sys, random
S = sys.argv[1]
B = "http://127.0.0.1:8099"
results = []


def api(method, path, body=None, h=None):
    req = urllib.request.Request(B + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **(h or {})}, method=method)
    return json.loads(urllib.request.urlopen(req).read())


def ok(cond, msg):
    results.append(bool(cond))
    print(("PASS " if cond else "FAIL ") + msg, flush=True)


# accounts
A = {"x-admin-token": api("POST", "/api/admin/login", {"pin": "909090"})["token"]}
sellers = {sid: api("POST", "/api/seller/login", {"phone_or_slug": ph, "pin": pin})
           for sid, ph, pin in [(1, "+998 90 111-22-33", "1111"), (2, "+998 93 222-33-44", "2222")]}
# Clean offers for the meat stall: a delivery bonus and a real gift product (0 so'm line)
SH = {"x-seller-token": sellers[2]["token"]}
for pr in api("GET", "/api/seller/promos", h=SH):
    api("DELETE", f"/api/seller/promos/{pr['id']}", h=SH)
api("POST", "/api/seller/promos", {"kind": "delivery", "min_amount": 450000, "amount": 18000}, SH)
api("POST", "/api/seller/promos", {"kind": "gift", "min_amount": 450000, "gift_product_id": 20, "gift_qty": 1}, SH)
staff = {}
for role, name in (("porter", "Jasur Aravachi"), ("taxi", "Bekzod Taksi")):
    ph = f"+99893{random.randint(1000000, 9999999)}"
    api("POST", "/api/staff/register", {"role": role, "name": name, "phone": ph, "pin": "1234", "car": "Cobalt 01A123BC" if role == "taxi" else None})
    sid = [x for x in api("GET", "/api/admin/staff", h=A) if x["phone"].replace(" ", "").endswith(ph[-9:])][0]["id"]
    api("POST", f"/api/admin/staff/{sid}/status", {"status": "approved"}, A)
    staff[role] = api("POST", "/api/staff/login", {"phone": ph, "pin": "1234"})


async def main():
    t = [x for x in json.loads(urllib.request.urlopen("http://127.0.0.1:9333/json").read()) if x["type"] == "page"][0]
    async with websockets.connect(t["webSocketDebuggerUrl"], max_size=None, ping_interval=None) as ws:
        n = [0]
        errs = []

        async def cmd(m, p={}):
            n[0] += 1
            i = n[0]
            await ws.send(json.dumps({"id": i, "method": m, "params": p}))
            while True:
                r = json.loads(await ws.recv())
                if r.get("id") == i:
                    return r
                if r.get("method") == "Runtime.exceptionThrown":
                    errs.append(r["params"]["exceptionDetails"].get("exception", {}).get("description", "")[:300])

        async def js(e):
            return (await cmd("Runtime.evaluate", {"expression": e, "awaitPromise": True, "returnByValue": True}))["result"].get("result", {}).get("value")

        async def shot(name):
            r = await cmd("Page.captureScreenshot", {"format": "png"})
            open(f"{S}/{name}", "wb").write(base64.b64decode(r["result"]["data"]))

        async def go(query, wait=4.5):
            await cmd("Page.navigate", {"url": B + "/?lang=uz" + query})
            await asyncio.sleep(wait)

        async def click(text, within=None, wait=1.5):
            scope = f"(()=>{{let el=[...document.querySelectorAll('strong,span,b,div')].filter(e=>e.innerText&&e.innerText.includes({json.dumps(within)})).sort((a,b)=>a.innerText.length-b.innerText.length)[0];while(el&&![...el.querySelectorAll('button')].some(b=>b.innerText.includes({json.dumps(text)})))el=el.parentElement;return el}})()" if within else "document"
            res = await js(f"""(()=>{{const root={scope};if(!root)return 'no-scope';const b=[...root.querySelectorAll('button')].find(b=>b.innerText.includes({json.dumps(text)}));if(!b)return 'no-button';if(b.disabled)return 'disabled';b.scrollIntoView({{block:'center'}});b.click();return true}})()""")
            await asyncio.sleep(wait)
            return res

        async def session(key, value):
            await js(f"localStorage.setItem({json.dumps(key)}, {json.dumps(json.dumps(value))})")

        await cmd("Runtime.enable")
        await cmd("Network.enable")
        await cmd("Network.setCacheDisabled", {"cacheDisabled": True})
        await cmd("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
        await go("")
        await session("yunusobod_addresses", [{"main": "Amir Temur ko'chasi, 108", "details": "Yunusobod", "district": "Yunusobod", "lat": 41.362, "lng": 69.287, "entrance": "2", "floor": "3", "apartment": "15", "landmark": "", "doorPhone": ""}])
        await js("localStorage.removeItem('yunusobod_my_orders')")

        async def place_order(mode_label, products, point=None):
            await go("")
            for name in products:
                r = await js(f"""(()=>{{for(const b of document.querySelectorAll('button')){{if(!b.querySelector('svg.lucide-plus'))continue;let c=b;for(let k=0;k<6&&c;k++){{c=c.parentElement;if(c&&c.innerText.length<400&&c.innerText.includes({json.dumps(name)})){{b.scrollIntoView({{block:'center'}});b.click();return true}}if(c&&c.innerText.length>=400)break}}}}return false}})()""")
                await asyncio.sleep(0.8)
                ok(r, f"[{mode_label}] added «{name[:28]}» to cart")
            await js("(()=>{const b=[...document.querySelectorAll('button.animate-fade')].find(b=>getComputedStyle(b).position==='fixed');b&&b.click()})()")
            await asyncio.sleep(2)
            await click("Rasmiylashtirish", wait=2.5)
            sub = {"Uyga yetkazish": "Aravachi + taksi", "Aravachi": "Bozordagi joyga", "O'zim olaman": "Rastalardan"}[mode_label]
            ok(await click(sub, wait=2) is True, f"[{mode_label}] chose the way to get it")
            if point:
                await click(point, wait=1)
            await js("""(()=>{const set=(el,v)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}))};const ins=[...document.querySelectorAll('form input')];const tel=ins.find(i=>i.type==='tel');const name=ins.find(i=>i.placeholder&&i.type!=='tel'&&i.type!=='checkbox'&&!i.inputMode);name&&set(name,'Aziza Karimova');tel&&set(tel,'+998901112233')})()""")
            await asyncio.sleep(0.5)
            price = await js("[...document.querySelectorAll('h3')].find(h=>h.innerText.includes('Narx tafsiloti'))?.parentElement.innerText.replace(/\\n/g,' | ')")
            total = await js("[...document.querySelectorAll('span')].find(s=>s.innerText==='Jami')?.parentElement.innerText.replace(/\\n/g,' ')")
            print(f"   price: {price}\n   {total}")
            await click("Buyurtma berish", wait=4)
            num = await js("(document.body.innerText.match(/YB-\\d{4}-\\d{6}/)||[])[0]")
            ok(num, f"[{mode_label}] order placed {num}")
            return num, price

        async def seller_press(store_id, num, label):
            await session("seller_session", {"token": sellers[store_id]["token"], "store": sellers[store_id]["store"]})
            await go("&tab=seller_cabinet", wait=6)
            return await click(label, within=num, wait=2)

        async def as_staff(role, tab):
            await session("staff_session", {"token": staff[role]["token"], "staff": staff[role]["staff"]})
            await go(f"&tab={tab}", wait=5)

        async def porter_collect(num, final_label):
            await as_staff("porter", "porter")
            ok(await click("Buyurtmani olaman", within=num, wait=2.5) is True, f"porter took {num}")
            for _ in range(10):
                r = await js("(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.querySelector('svg.lucide-circle')&&!b.disabled);if(!b)return false;b.click();return true})()")
                await asyncio.sleep(1.2)
                if not r:
                    break
            picked = await js("(document.body.innerText.match(/Olindi: (\\d+) \\/ (\\d+)/)||[]).slice(1).join('/')")
            ok(picked and picked.split('/')[0] == picked.split('/')[1], f"porter ticked every item ({picked})")
            await shot(f"e2e_porter_{num}.png")
            ok(await click(final_label, wait=2) is True, f"porter pressed «{final_label}»")

        async def customer_finish(num, mode_label):
            await go(f"&tab=orders&order={num}", wait=5)
            ok(await click("Buyurtmani oldim", wait=2.5) is True, f"[{mode_label}] customer pressed «Buyurtmani oldim»")
            await js("(()=>{const s=[...document.querySelectorAll('button[aria-label=\"5\"]')][0];s&&s.click()})()")
            await asyncio.sleep(0.6)
            await js("(()=>{const t=document.querySelector('textarea');if(!t)return;Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,'Hammasi zo\\'r, tez keldi!');t.dispatchEvent(new Event('input',{bubbles:true}))})()")
            ok(await click("Yuborish", wait=2) is True, f"[{mode_label}] customer sent 5 stars")
            thanks = await js("document.body.innerText.toLowerCase().includes('rahmat')")
            await shot(f"e2e_done_{num}.png")
            o = api("GET", f"/api/orders/{num}")
            ok(o["status"] == "delivered" and o["customer_confirmed_at"] and o["review_rating"] == 5 and thanks,
               f"[{mode_label}] closed: delivered, confirmed, rated 5")
            return o

        # ---------- 1. Home delivery: aravachi -> taxi -> home ----------
        print("\n=== 1. Uyga yetkazish ===")
        num, price = await place_order("Uyga yetkazish", ["Oila Uchun Haftalik Katta", "Vitaminga Boy Bozor Savati"], point="Avtoturargoh")
        ok("Taksi to'lovi qoplandi" in (price or ""), "checkout shows the stall bonus paying the taxi")
        ok(await seller_press(1, num, "Tayyor") is True, "seller 1 pressed Tayyor")
        ok(await click("Aravachiga berdim", within=num) == "disabled", "seller cannot hand over before an aravachi takes it")
        await porter_collect(num, "taksi chaqirish")
        for sid in (1, 2):
            ok(await seller_press(sid, num, "Aravachiga berdim") is True, f"seller {sid} pressed «Aravachiga berdim»")
        await as_staff("taxi", "taxi")
        ok(await click("Olib ketaman", within=num, wait=1) is True, "taxi pressed «Olib ketaman»")
        ok(await click("10 daq", within=num, wait=2.5) is True, "taxi said: at the gate in 10 min")
        await as_staff("porter", "porter")
        await click("Mening", wait=1); await click("Ochish", within=num, wait=1.5)
        gate = await js("document.body.innerText.includes('Darvozaga') && document.body.innerText.includes('daqiqadan keyin chiqing')")
        ok(gate, "aravachi sees «Darvozaga N daqiqadan keyin chiqing»")
        await shot(f"e2e_gate_{num}.png")
        await as_staff("taxi", "taxi")
        await click("Mening", wait=1.5)
        ok(await click("Qabul qildim", within=num, wait=2) is True, "taxi pressed «Qabul qildim, yo'lga chiqdim»")
        r_noc = await click("Yetkazdim", within=num, wait=1)
        print("   debug: Yetkazdim without code ->", r_noc, "| buttons:", await js("[...document.querySelectorAll('button')].map(b=>b.innerText.trim()).filter(t=>t&&t.length<40).slice(5,14).join(' | ')"), "| status:", api("GET", f"/api/orders/{num}")["status"])
        ok(r_noc == "disabled", "taxi cannot press «Yetkazdim» without the code")
        code = api("GET", f"/api/orders/{num}")["handoff_code"]
        await js(f"""(()=>{{const i=[...document.querySelectorAll('input[inputmode=numeric]')][0];Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'{code}');i.dispatchEvent(new Event('input',{{bubbles:true}}))}})()""")
        await asyncio.sleep(0.5)
        ok(await click("Yetkazdim", within=num, wait=2) is True, f"taxi typed the customer's code {code} and pressed «Yetkazdim»")
        o = await customer_finish(num, "Uyga yetkazish")
        ok(all(i["seller_handed"] and i["is_picked"] for i in o["items"]), "every item: seller handed + aravachi ticked")
        ok(any(i["price"] == 0 and i["product_name"].startswith("🎁") for i in o["items"]), "gift travelled as a 0 so'm item")

        # ---------- 2. Aravachi to a bazaar point ----------
        print("\n=== 2. Aravachi (tochka) ===")
        num, price = await place_order("Aravachi", ["Yusupov Pomidori", "Mol Go'shti Lahm"], point="Orqa darvoza")
        before = api("GET", f"/api/orders/{num}")
        await as_staff("porter", "porter")
        ok(await click("Buyurtmani olaman", within=num, wait=2.5) is True, f"porter took {num}")
        tomato_line = [i for i in before["items"] if i["product_name"].startswith("Yusupov")][0]
        await js("""(()=>{const b=[...document.querySelectorAll('button')].filter(b=>b.innerText.includes('Vazn'))[0];b&&b.click()})()"""); await asyncio.sleep(0.8)
        await js(f"""(()=>{{const i=[...document.querySelectorAll('input[inputmode=decimal]')][0];Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'{tomato_line["quantity"]*1.3:g}');i.dispatchEvent(new Event('input',{{bubbles:true}}))}})()"""); await asyncio.sleep(0.4)
        blocked = await js("(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Saqlash');return !!(b&&b.disabled)&&document.body.innerText.includes('±5%')})()")
        ok(blocked is True, "+30% on the scale: «Saqlash» is locked and the ±5% range is shown")
        await js(f"""(()=>{{const i=[...document.querySelectorAll('input[inputmode=decimal]')][0];Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'{round(tomato_line["quantity"]*1.04,3):g}');i.dispatchEvent(new Event('input',{{bubbles:true}}))}})()"""); await asyncio.sleep(0.4)
        ok(await click("Saqlash", wait=2.5) is True, "porter trimmed it and typed +4%")
        await js("""(()=>{const b=[...document.querySelectorAll('button')].filter(b=>b.innerText.includes("Yo'q"))[1];b&&b.click()})()"""); await asyncio.sleep(2.5)
        await shot(f"e2e_weights_{num}.png")
        after = api("GET", f"/api/orders/{num}")
        tom = [i for i in after["items"] if i["id"] == tomato_line["id"]][0]
        beef = [i for i in after["items"] if i["id"] != tomato_line["id"]][0]
        ok(tom["weight_status"] is None and beef["item_status"] == "missing", "tomato +4% accepted at once (no question to the customer), beef marked «yo'q»")
        ok(after["total_amount"] == before["total_amount"] - beef["price"] * beef["quantity"] + round(tom["price"] * round(tom["quantity"] * 1.04, 3)) - tom["price"] * tom["quantity"],
           f"new total: beef taken off, tomato +4% ({before['total_amount']:.0f} → {after['total_amount']:.0f})")
        await as_staff("porter", "porter")
        await click("Mening", wait=1); await click("Ochish", within=num, wait=1.5)
        for _ in range(6):
            r = await js("(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.querySelector('svg.lucide-circle')&&!b.disabled);if(!b)return false;b.click();return true})()")
            await asyncio.sleep(1.2)
            if not r: break
        ok(await click("Joyga olib keldim", wait=2) is True, "porter pressed «Joyga olib keldim»")
        o = api("GET", f"/api/orders/{num}")
        ok(o["status"] == "at_point" and o["handoff_point"] == "back_gate", "order waits at «Orqa darvoza»")
        await customer_finish(num, "Aravachi")

        # ---------- 3. Self pickup ----------
        print("\n=== 3. O'zim olaman ===")
        num, price = await place_order("O'zim olaman", ["Bodring 'Orzu'", "Qo'lda Tayyorlangan Qazi"])
        ok("Yo'q" in (price or ""), "self pickup has no delivery fee")
        for sid in (1, 2):
            ok(await seller_press(sid, num, "Tayyor") is True, f"seller {sid} pressed Tayyor")
        ok(api("GET", f"/api/orders/{num}")["status"] == "ready", "all stalls packed -> customer told «tayyor»")
        for sid in (1, 2):
            ok(await seller_press(sid, num, "Xaridorga berdim") is True, f"seller {sid} pressed «Xaridorga berdim»")
        await customer_finish(num, "O'zim olaman")

        print("\njs errors:", errs)
        print(f"\nTOTAL: {sum(results)}/{len(results)} passed")


asyncio.run(main())
