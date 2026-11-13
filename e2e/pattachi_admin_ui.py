"""Only the bozorkom adds a pattachi: the pattachi screen has no «apply», the Bozorkom has an «add pattachi» form,
and the new pattachi signs in with the phone and PIN the bozorkom gave."""
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


SET = """((sel,v)=>{const i=document.querySelector(sel);const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;
set.call(i,v);i.dispatchEvent(new Event('input',{bubbles:true}));})"""


async def main():
    admin = api("POST", "/api/admin/login", {"pin": "909090"})
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

        await cmd("Page.navigate", {"url": f"{B}/?lang=ru&tab=pattachi"}); await asyncio.sleep(2.5)
        text = await js("document.body.innerText")
        ok("только администрация" in text and "Нет аккаунта" not in text, "pattachi screen: no «register», says the bozorkom adds them")
        await shot("pattachi_login")
        await cmd("Page.navigate", {"url": f"{B}/?lang=ru&tab=porter"}); await asyncio.sleep(2)
        ok("Нет аккаунта" in await js("document.body.innerText"), "aravachi screen still has «register»")

        await js(f"localStorage.setItem('admin_session', {json.dumps(json.dumps({'token': admin['token']}))})")
        await cmd("Page.navigate", {"url": f"{B}/?lang=uz&tab=admin"}); await asyncio.sleep(2.5)
        await js("[...document.querySelectorAll('button')].find(b=>b.innerText.trim()==='Xodimlar').click()"); await asyncio.sleep(1)
        ok(await js("!!document.querySelector('[data-testid=add-pattachi]')"), "Bozorkom → Xodimlar has «Pattachi qo'shish»")
        await js(f"{SET}('[data-testid=add-pattachi] input[name=name]','Odil aka')")
        await js(f"{SET}('[data-testid=add-pattachi] input[name=phone]','+998 94 555-66-77')")
        await js(f"{SET}('[data-testid=add-pattachi] input[name=pin]','4321')")
        await asyncio.sleep(0.4)
        await js("document.querySelector('[data-testid=add-pattachi] button[type=submit]').click()"); await asyncio.sleep(2)
        text = await js("document.body.innerText")
        ok("Pattachi qo'shildi" in text and "Odil aka" in text, "added: shown in the staff list")
        await js("document.querySelector('[data-testid=add-pattachi]').scrollIntoView({block:'start'})"); await shot("pattachi_added")

        await js("localStorage.removeItem('admin_session')")
        c = api("POST", "/api/staff/login", {"phone": "+998945556677", "pin": "4321"})
        ok(c["staff"]["role"] == "pattachi" and c["staff"]["name"] == "Odil aka", "the new pattachi signs in with that phone and PIN")

asyncio.run(main())
