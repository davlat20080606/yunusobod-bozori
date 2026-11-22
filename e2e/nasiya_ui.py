"""📒 Nasiya daftari in a real browser (Shuhrat, 2026-11-21): the stall writes a debt, the buyer in the bot
is asked to confirm, reminders only after that, part payments, a new due date, the history, cancel instead of delete,
writing an order as credit; Esc closes; nothing overflows at 320 px. Screenshots for the visual audit."""
import asyncio, base64, json, sqlite3, sys, urllib.request, websockets
from datetime import datetime
S = sys.argv[1]
B = "http://127.0.0.1:8099"
DB = f"{S}/nasiya.db"
BUYER_TG, BUYER_PHONE = "6660001", "+998 90 666 00 01"


def ok(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg, flush=True)


def api(method, path, body=None, headers=None):
    req = urllib.request.Request(B + path, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Content-Type": "application/json", **(headers or {})}, method=method)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def sql(q, args=()):
    with sqlite3.connect(DB) as c:
        return c.execute(q, args).fetchall()


async def main():
    seller = api("POST", "/api/seller/login", {"phone_or_slug": "+998 90 111-22-33", "pin": "1111"})
    sql("INSERT INTO customers (tg_id, lang, phone, name, created_at) VALUES (?, 'uz', ?, 'Karim', ?)",
        (BUYER_TG, BUYER_PHONE, datetime.utcnow().isoformat(sep=" ")))
    order = api("POST", "/api/orders", {"customer_name": "Dilnoza opa", "customer_phone": "+998 91 222 33 44", "delivery_time_slot": "Morning (09:00-11:00)",
                                        "payment_method": "cash", "fulfillment": "self", "items": [{"product_id": 6, "store_id": 1, "quantity": 2}]})
    t = [x for x in json.loads(urllib.request.urlopen("http://127.0.0.1:9333/json").read()) if x["type"] == "page"][0]
    async with websockets.connect(t["webSocketDebuggerUrl"], max_size=None, ping_interval=None) as ws:
        n = [0]

        async def cmd(m, p={}):
            n[0] += 1; i = n[0]; await ws.send(json.dumps({"id": i, "method": m, "params": p}))
            while True:
                r = json.loads(await ws.recv())
                if r.get("id") == i: return r

        async def js(e): return (await cmd("Runtime.evaluate", {"expression": e, "awaitPromise": True, "returnByValue": True}))["result"].get("result", {}).get("value")

        async def shot(name, w, h):
            r = await cmd("Page.captureScreenshot", {"format": "png", "clip": {"x": 0, "y": 0, "width": w, "height": h, "scale": 1}})
            open(f"{S}/nasiya_{name}.png", "wb").write(base64.b64decode(r["result"]["data"]))

        async def click(testid, i=0):
            return await js(f"(()=>{{const b=document.querySelectorAll('[data-testid={testid}]')[{i}];if(!b)return false;b.click();return true}})()")

        async def text(testid):
            return await js(f"(document.querySelector('[data-testid={testid}]')||{{}}).innerText||''")

        async def type_in(testid, value):
            # React listens to the native input setter + an input event
            return await js(f"""(()=>{{const el=document.querySelector('[data-testid={testid}]');if(!el)return false;
              const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(el,{json.dumps(value)});
              el.dispatchEvent(new Event('input',{{bubbles:true}}));return true}})()""")

        async def wait_for(expr, seconds=5):
            for _ in range(int(seconds * 5)):
                if await js(expr): return True
                await asyncio.sleep(0.2)
            return False

        async def key(k):
            await cmd("Input.dispatchKeyEvent", {"type": "keyDown", "key": k, "code": k, "windowsVirtualKeyCode": 27 if k == "Escape" else 0})
            await cmd("Input.dispatchKeyEvent", {"type": "keyUp", "key": k, "code": k, "windowsVirtualKeyCode": 27 if k == "Escape" else 0})

        await cmd("Page.enable"); await cmd("Runtime.enable")
        await cmd("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
        await cmd("Page.navigate", {"url": f"{B}/?lang=uz"}); await asyncio.sleep(1.5)
        await js(f"localStorage.setItem('seller_session', {json.dumps(json.dumps({'token': seller['token'], 'store': seller['store'], 'role': 'owner'}))})")
        await cmd("Page.navigate", {"url": f"{B}/?lang=uz&tab=seller_cabinet"})
        ok(await wait_for("!!document.querySelector('[data-testid=nasiya-entry]')", 8), "the notebook card is in the seller cabinet")
        entry = await text("nasiya-entry")
        ok("Nasiya daftari" in entry and "yozib qo'ying" in entry, f"empty: it says what it is for ({entry!r})")
        await shot("entry_390", 390, 844)

        await click("nasiya-entry")
        ok(await wait_for("!!document.querySelector('[data-testid=nasiya-empty]')"), "empty notebook says why and what to do")
        await shot("empty_390", 390, 844)

        # 1. A new entry: checks first, then saved and sent to the buyer
        await click("nasiya-new"); await asyncio.sleep(0.4)
        await click("nasiya-save"); await asyncio.sleep(0.3)
        errors = await js("[...document.querySelectorAll('.nz-err-text')].map(e=>e.innerText)")
        ok(errors and len(errors) == 2, f"empty name and amount are shown under the fields {errors}")
        await type_in("nasiya-name", "Karim aka")
        await type_in("nasiya-phone", "90 666 00 01")
        await type_in("nasiya-amount", "250000")
        ok((await js("document.querySelector('[data-testid=nasiya-amount]').value")) == "250 000", "the amount is grouped as it is typed")
        await type_in("nasiya-note", "2 kg mol go'shti")
        await click("nasiya-due-tomorrow")
        ok(await js("document.querySelector('[data-testid=nasiya-due-tomorrow]').getAttribute('aria-pressed')") == "true", "«Ertaga» picked in one tap")
        await shot("form_390", 390, 844)
        await click("nasiya-save")
        ok(await wait_for("(document.querySelector('[data-testid=nasiya-toast]')||{}).innerText?.includes('tasdiq')"), "saved: «the buyer was asked to confirm»")
        await asyncio.sleep(0.8)
        sent = [json.loads(l) for l in open(f"{S}/sent.log")]
        ok(any(m.get("chat") == BUYER_TG and "Nasiya" in m.get("text", "") for m in sent), "the buyer got the request in the bot")
        debt = await text("nasiya-debt")
        ok("250 000" in debt and "Tasdiq kutilmoqda" in debt, f"the entry shows the amount and «waiting» ({debt!r})")
        ok(await js("document.querySelector('[data-testid=nasiya-remind]').disabled") is True, "no reminder before the buyer confirms")
        ok("tasdiqlagach" in (await js("(document.querySelector('.nz-hint')||{}).innerText||''")), "and it says why")

        # 2. The buyer confirms (in the bot); a reminder, a part payment, a later date
        sql("UPDATE debts SET confirm = 'confirmed'")
        await click("nasiya-close"); await asyncio.sleep(0.3); await click("nasiya-entry")
        ok(await wait_for("(document.querySelector('[data-testid=nasiya-debt]')||{}).innerText?.includes('tasdiqladi')"), "the stall sees it confirmed")
        await click("nasiya-remind")
        ok(await wait_for("(document.querySelector('[data-testid=nasiya-toast]')||{}).innerText?.includes('Eslatma')"), "📲 reminder sent")
        ok(await wait_for("document.querySelector('[data-testid=nasiya-remind]')?.disabled === true"), "not again within 2 days")

        await click("nasiya-pay"); await asyncio.sleep(0.4)
        await type_in("nasiya-pay-amount", "100000"); await asyncio.sleep(0.2)
        hint = await js("(document.querySelector('[data-testid=nasiya-pay-sheet] .nz-hint')||{}).innerText||''")
        ok("150 000" in hint, f"it shows what will be left ({hint!r})")
        await shot("pay_390", 390, 844)
        await click("nasiya-pay-save")
        ok(await wait_for("(document.querySelector('[data-testid=nasiya-toast]')||{}).innerText?.includes(\"To'lov\")"), "💵 part payment recorded")
        ok(await wait_for("(document.querySelector('[data-testid=nasiya-debt]')||{}).innerText?.includes('150 000')"), "150 000 left, 250 000 struck through")
        ok("150 000" in await text("nasiya-total"), "the total at the top follows")

        await click("nasiya-snooze"); await asyncio.sleep(0.4)
        await click("nasiya-snooze-3")
        ok(await wait_for("(document.querySelector('[data-testid=nasiya-toast]')||{}).innerText?.includes('muddat')"), "⏰ +3 days")

        # 3. History and cancel (never delete)
        await click("nasiya-more")
        ok(await wait_for("document.querySelectorAll('[data-testid=nasiya-history] li').length >= 4"), "the history: written, reminded, paid, moved")
        ok(await js("!!document.querySelector('[data-testid=nasiya-cancel]')"), "the owner can cancel a mistake")
        await shot("history_390", 390, 844)
        await key("Escape"); await asyncio.sleep(0.3)
        ok(await js("!document.querySelector('[data-testid=nasiya-more-sheet]') && !!document.querySelector('[data-testid=nasiya]')"), "Esc closes the sheet, the notebook stays")
        await shot("list_390", 390, 844)
        await key("Escape"); await asyncio.sleep(0.3)
        ok(await js("!document.querySelector('[data-testid=nasiya]')"), "a second Esc closes the notebook")

        # 4. From an order: one tap, filled in
        ok(await wait_for("!!document.querySelector('[data-testid=seller-order-nasiya]')"), "orders have «📒 Nasiyaga yozish»")
        await click("seller-order-nasiya"); await asyncio.sleep(0.6)
        name = await js("document.querySelector('[data-testid=nasiya-name]')?.value")
        amount = await js("document.querySelector('[data-testid=nasiya-amount]')?.value")
        sub = await js("(document.querySelector('[data-testid=nasiya-form] .nz-sheet-sub')||{}).innerText||''")
        ok(name == "Dilnoza opa" and amount and amount != "0" and str(order["order_number"]) in sub, f"filled from order #{order['order_number']}: {name}, {amount}")
        await click("nasiya-save")
        ok(await wait_for("document.querySelectorAll('[data-testid=nasiya-customer]').length === 2"), "the order is now in the notebook")

        # 5. The buyer presses «💵 To'ladim» in the bot; the stall answers «Olmadim», then «Oldim» (Davlatbek's father)
        async def claim_and_reopen():
            sql("UPDATE debts SET paid_claim_at = ? WHERE customer_name = 'Karim aka'", (datetime.utcnow().isoformat(sep=" "),))
            await click("nasiya-close"); await cmd("Page.reload"); await asyncio.sleep(2.5)
        await claim_and_reopen()
        ok(await wait_for("(document.querySelector('[data-testid=nasiya-claims]')||{}).innerText?.includes('1')"), "the notebook card shows «💵 To'ladim · 1»")
        await click("nasiya-entry")
        ok(await wait_for("!!document.querySelector('[data-testid=nasiya-claim]')"), "the entry asks: did you get the money?")
        ok(await js("document.querySelector('[data-testid=nasiya-remind]').disabled") is True, "no reminder while it waits for the answer")
        await asyncio.sleep(0.5); await shot("claim_390", 390, 844)
        await click("nasiya-claim-no")
        ok(await wait_for("(document.querySelector('[data-testid=nasiya-toast]')||{}).innerText?.includes('Mijozga')"), "«Olmadim»: the buyer is told")
        ok(await wait_for("!document.querySelector('[data-testid=nasiya-claim]')"), "and the question goes away, the debt stays")
        await claim_and_reopen(); await click("nasiya-entry")
        ok(await wait_for("!!document.querySelector('[data-testid=nasiya-claim-yes]')"), "the buyer says it again")
        await click("nasiya-claim-yes")
        ok(await wait_for("(document.querySelector('[data-testid=nasiya-toast]')||{}).innerText?.includes('yopildi')"), "«Oldim»: closed")
        ok(await wait_for("document.querySelectorAll('[data-testid=nasiya-customer]').length === 1"), "it leaves the open list")
        await click("nasiya-tab-closed")
        ok(await wait_for("(document.querySelector('[data-testid=nasiya-debt]')||{}).innerText?.includes(\"To'landi\")"), "and is kept under «Yopilgan»")
        await click("nasiya-tab-open")

        # 5. 320 px and desktop, Russian
        await cmd("Emulation.setDeviceMetricsOverride", {"width": 320, "height": 640, "deviceScaleFactor": 1, "mobile": True})
        await asyncio.sleep(0.5)
        over = await js("document.documentElement.scrollWidth - innerWidth")
        ok(over <= 0, f"nothing sticks out at 320 px ({over})")
        await shot("list_320", 320, 640)
        await cmd("Emulation.setDeviceMetricsOverride", {"width": 1440, "height": 900, "deviceScaleFactor": 1, "mobile": False})
        await cmd("Page.navigate", {"url": f"{B}/?lang=ru&tab=seller_cabinet&nasiya=1"})
        ok(await wait_for("(document.querySelector('[data-testid=nasiya]')||{}).innerText?.includes('Тетрадь насии')", 8), "?nasiya=1 from the bot opens it, in Russian")
        await asyncio.sleep(0.6)
        await shot("list_1440", 1440, 900)

asyncio.run(main())
