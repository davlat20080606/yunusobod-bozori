"""Payment between the customer and the people of the order (Davlatbek, Shuhrat): the customer sees the phone and
card of each seller, porter and taxi driver in the order; porters and taxi drivers enter their card themselves;
the seller can call the porter and the taxi driver."""
import asyncio, base64, json, random, sys, urllib.request, websockets
S = sys.argv[1]
B = "http://127.0.0.1:8099"


def ok(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg, flush=True)


def api(method, path, body=None, headers=None):
    req = urllib.request.Request(B + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **(headers or {})}, method=method)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


A = {"x-admin-token": api("POST", "/api/admin/login", {"pin": "909090"})["token"]}


def worker(role, name):
    ph = f"+99894{random.randint(1000000, 9999999)}"
    api("POST", "/api/staff/register", {"role": role, "name": name, "phone": ph, "pin": "1234", "car": "Cobalt 01A777AA" if role == "taxi" else None})
    sid = [x for x in api("GET", "/api/admin/staff", headers=A) if x["phone"].replace(" ", "").endswith(ph[-9:])][0]["id"]
    api("POST", f"/api/admin/staff/{sid}/status", {"status": "approved"}, A)
    return api("POST", "/api/staff/login", {"phone": ph, "pin": "1234"})


async def main():
    seller = api("POST", "/api/seller/login", {"phone_or_slug": "+998 93 222-33-44", "pin": "2222"})
    sid = seller["store"]["id"]
    SH = {"x-seller-token": seller["token"]}
    porter, taxi = worker("porter", "Karta Aravachi"), worker("taxi", "Karta Taksi")
    PH, TH = {"x-staff-token": porter["token"]}, {"x-staff-token": taxi["token"]}
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
        api("PATCH", "/api/seller/stores/me", {"payment_card": "9860 1234 5678 9012"}, SH)

        # 1. The porter enters their card in their own panel
        await cmd("Page.navigate", {"url": f"{B}/?lang=uz"}); await asyncio.sleep(1.5)
        await js(f"localStorage.setItem('staff_session', {json.dumps(json.dumps({'token': porter['token'], 'staff': porter['staff']}))})")
        await cmd("Page.navigate", {"url": f"{B}/?lang=uz&tab=porter"}); await asyncio.sleep(3)
        box = await js("(document.querySelector('[data-testid=staff-card]')||{}).innerText||''")
        ok("Kartam" in box and "Kiritilmagan" in box, "the porter sees «Kartam», not set yet")
        await js("document.querySelector('[data-testid=staff-card] button').click()"); await asyncio.sleep(0.5)
        await js("""(()=>{const el=document.querySelector('[data-testid=staff-card-input]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'8600123412341234');el.dispatchEvent(new Event('input',{bubbles:true}))})()""")
        await js("document.querySelector('[data-testid=staff-card-save]').click()"); await asyncio.sleep(1.5)
        msg = await js("(document.querySelector('[data-testid=staff-card-msg]')||{}).innerText")
        ok(msg == "Saqlandi" and api("GET", "/api/staff/me", headers=PH)["payment_card"] == "8600 1234 1234 1234", f"the porter saved the card ({msg})")
        await shot("staff_card_porter")
        api("PATCH", "/api/staff/me/card", {"payment_card": "5614 0000 1111 2222"}, TH)

        # 2. A home-delivery order paid by card goes stall -> porter -> taxi
        o = api("POST", "/api/orders", {
            "customer_name": "Mijoz", "customer_phone": f"+998 90 46{random.randint(10000, 99999)}", "delivery_time_slot": "Morning (09:00-11:00)",
            "payment_method": "card", "fulfillment": "courier", "handoff_point": "main_gate", "delivery_address": "Yunusobod 4, 12",
            "delivery_lat": 41.36, "delivery_lng": 69.29, "items": [{"product_id": 10, "store_id": sid, "quantity": 1}]})
        api("POST", f"/api/porter/orders/{o['id']}/take", {}, PH)
        api("POST", f"/api/seller/orders/{o['id']}/handed", {}, SH)
        for item in o["items"]:
            api("PATCH", f"/api/porter/items/{item['id']}/picked", {"is_picked": True}, PH)
        api("PATCH", f"/api/porter/orders/{o['id']}/status", {"status": "handed_over"}, PH)
        api("POST", f"/api/taxi/orders/{o['id']}/take", {"eta_minutes": 5}, TH)

        await cmd("Page.navigate", {"url": f"{B}/?lang=ru&tab=orders&order={o['order_number']}"}); await asyncio.sleep(3)
        has = await js("(()=>{const b=document.querySelector('[data-testid=seller-pay]');if(!b)return null;b.scrollIntoView({block:'center'});return b.innerText})()")
        ok(bool(has) and "Вы выбрали оплату картой" in has, "the order says the customer chose card")
        cards = await js("['seller','porter','taxi'].map(k=>(document.querySelector(`[data-testid=${k}-card-number]`)||{}).innerText||'')")
        ok(cards == ["9860 1234 5678 9012", "8600 1234 1234 1234", "5614 0000 1111 2222"], f"cards of seller, porter and taxi ({cards})")
        calls = await js("document.querySelectorAll('[data-testid=seller-pay] [data-testid=contact-call]').length")
        ok(calls == 3, f"a call button for each of the three ({calls})")
        pay = await js("document.body.innerText.includes('Перевод на карту')")
        ok(pay, "order details show «Перевод на карту»")
        await shot("seller_card_order")
        w = await js("document.documentElement.scrollWidth")
        ok(w <= 376, f"fits the phone ({w})")

        await cmd("Page.navigate", {"url": f"{B}/?lang=uz&tab=orders&order={o['order_number']}"}); await asyncio.sleep(3)
        text = await js("(document.querySelector('[data-testid=seller-pay]')||{}).innerText || ''")
        ok("Aravachi" in text and "Taksichi" in text and "Nusxalash" in text, "Uzbek labels and copy button")

        # 3. The seller can call the porter and the taxi driver, and sees how the customer pays
        await js(f"localStorage.setItem('seller_session', {json.dumps(json.dumps({'token': seller['token'], 'store': seller['store']}))})")
        await cmd("Page.navigate", {"url": f"{B}/?lang=uz&tab=seller_cabinet"}); await asyncio.sleep(3.5)
        links = await js("['customer','porter','taxi'].map(k=>!!document.querySelector(`[data-testid=seller-call-${k}]`))")
        pay_s = await js("[...document.querySelectorAll('[data-testid=seller-order-pay]')].map(e=>e.innerText).join('|')")
        ok(links == [True, True, True], f"the seller can call customer, porter and taxi ({links})")
        ok("Kartaga" in (pay_s or ""), f"the seller sees «Kartaga o'tkazma» ({(pay_s or '')[:60]})")

asyncio.run(main())
