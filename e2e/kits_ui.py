"""📄 QR sheets in the Bozorkom panel (Shuhrat, 2026-11-26): the founder makes and prints blank sheets, registers a stall
at the bazaar with a sheet's code, sees it bound; the stall waits for the bozorkom. Screenshots: phone and desktop."""
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
    founder = api("POST", "/api/admin/login", {"pin": "717171"})
    t = [x for x in json.loads(urllib.request.urlopen("http://127.0.0.1:9333/json").read()) if x["type"] == "page"][0]
    async with websockets.connect(t["webSocketDebuggerUrl"], max_size=None, ping_interval=None) as ws:
        n = [0]

        async def cmd(m, p={}):
            n[0] += 1; i = n[0]; await ws.send(json.dumps({"id": i, "method": m, "params": p}))
            while True:
                r = json.loads(await ws.recv())
                if r.get("id") == i: return r

        async def js(e): return (await cmd("Runtime.evaluate", {"expression": e, "awaitPromise": True, "returnByValue": True}))["result"].get("result", {}).get("value")

        async def shot(name, full=False):
            r = await cmd("Page.captureScreenshot", {"format": "png", "captureBeyondViewport": full})
            open(f"{S}/kits_{name}.png", "wb").write(base64.b64decode(r["result"]["data"]))

        async def size(w, h):
            await cmd("Emulation.setDeviceMetricsOverride", {"width": w, "height": h, "deviceScaleFactor": 1, "mobile": w < 600})

        # React-controlled inputs need the native setter
        set_value = """(sel, v) => { const el = document.querySelector(sel); const proto = el.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
            Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v); el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); }"""

        await cmd("Page.enable"); await cmd("Runtime.enable")
        await size(390, 844)
        await cmd("Page.navigate", {"url": f"{B}/?lang=uz"}); await asyncio.sleep(2)
        await js(f"localStorage.setItem('admin_session', {json.dumps(json.dumps({'token': founder['token'], 'role': 'founder'}))})")
        await cmd("Page.navigate", {"url": f"{B}/?lang=uz&tab=admin"}); await asyncio.sleep(3)
        await js("[...document.querySelectorAll('button')].find(b=>/QR varaqlar/.test(b.innerText)).click()"); await asyncio.sleep(1.5)
        ok(await js("!!document.querySelector('[data-testid=kits-panel]')"), "the founder opens «📄 QR varaqlar»")
        empty = await js("document.querySelector('[data-testid=kits-panel]').innerText")
        ok("Hali varaq yo'q" in empty, "no sheets yet: says why and what to do")
        await shot("empty_390")

        await js(f"({set_value})('[data-testid=kit-count]', '2')")
        await js("document.querySelector('[data-testid=kit-make]').click()"); await asyncio.sleep(2.5)
        sheets = await js("document.querySelectorAll('.kit-sheet').length")
        imgs = await js("[...document.querySelectorAll('.kit-sheet-qr img')].filter(i=>i.complete && i.naturalWidth>0).length")
        ok(sheets == 2 and imgs == 2, f"2 sheets made, each with its QR ({sheets}, {imgs})")
        text = await js("document.querySelector('.kit-sheet').innerText")
        ok("BZR-" in text and "FAOLLASHTIRISH KODI" in text and "osib qo'ymang" in text and "TestBozorBot" in text,
           "a sheet: code, activation code, «do not stick it on the stall»")
        await shot("print_390", True)
        await cmd("Emulation.setEmulatedMedia", {"media": "print"}); await asyncio.sleep(0.5)
        hidden = await js("getComputedStyle(document.getElementById('root')).display")
        ok(hidden == "none", f"on paper only the sheets are printed (panel: {hidden})")
        await cmd("Emulation.setEmulatedMedia", {"media": ""})
        # the real printout: A4, one sheet per page
        pdf = await cmd("Page.printToPDF", {"preferCSSPageSize": True, "printBackground": True})
        open(f"{S}/kits_print.pdf", "wb").write(base64.b64decode(pdf["result"]["data"]))
        pages = base64.b64decode(pdf["result"]["data"]).count(b"/Type /Page\n") or base64.b64decode(pdf["result"]["data"]).count(b"/Type/Page")
        ok(pages in (0, 2), f"printed: one A4 page per sheet ({pages})")
        await js("[...document.querySelectorAll('.kit-print-bar button')].find(b=>/Yopish/.test(b.innerText)).click()"); await asyncio.sleep(1)

        code = api("GET", "/api/admin/kits", headers={"x-admin-token": founder["token"]})["kits"][-1]["code"]
        await js(f"({set_value})('[data-testid=kit-code]', '{code.lower()}')"); await asyncio.sleep(1.2)
        status = await js("(document.querySelector('[data-testid=kit-status]')||{}).innerText||''")
        ok(code in status and "bo'sh" in status, f"the typed code is found: {status}")
        cat = api("GET", "/api/stores/categories")[0]["slug"]
        for sel, v in [("kit-name_uz", "Chorsu mevalari"), ("kit-stall_number", "M-21"), ("kit-owner_name", "Jasur"),
                       ("kit-owner_phone", "+998 93 444-55-66"), ("kit-helper-0", "+998 93 444-55-77"), ("kit-category", cat)]:
            await js(f"({set_value})('[data-testid={sel}]', {json.dumps(v)})")
        await asyncio.sleep(0.5)
        ok(await js("!document.querySelector('[data-testid=kit-register]').disabled"), "the form is complete, the button is on")
        await shot("form_390", True)
        await js("document.querySelector('[data-testid=kit-register]').click()"); await asyncio.sleep(2)
        result = await js("(document.querySelector('[data-testid=kit-result]')||{}).innerText||''")
        ok(code in result and "Bozorkom tasdiqlagach" in result and "PIN" in result, f"registered, waits for the bozorkom: {result[:90]}")
        rows = await js("[...document.querySelectorAll('[data-testid=kit-row]')].map(r=>r.innerText).join(' | ')")
        ok("M-21" in rows, f"the sheet now shows its stall ({rows[:120]})")
        w = await js("document.documentElement.scrollWidth")
        ok(w <= 391, f"fits the phone ({w})")
        await shot("after_390", True)

        admin = api("POST", "/api/admin/login", {"pin": "909090"})
        pending = [s for s in api("GET", "/api/admin/stores", headers={"x-admin-token": admin["token"]}) if s["stall_number"] == "M-21"]
        ok(pending and pending[0]["status"] == "pending", "the bozorkom sees it in «Arizalar»")

        await size(1440, 900); await asyncio.sleep(1)
        await shot("desktop_1440")
        w = await js("document.documentElement.scrollWidth")
        ok(w <= 1440, f"desktop fits ({w})")

asyncio.run(main())
