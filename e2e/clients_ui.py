import asyncio, json, urllib.request, websockets, base64, sys, hmac, hashlib, time
from urllib.parse import urlencode
S=sys.argv[1]; B="http://127.0.0.1:8099"; TOKEN="123456:TESTtokenTESTtokenTESTtokenTESTtok"
def init_data(uid, first):
    f={"auth_date":str(int(time.time())),"user":json.dumps({"id":uid,"first_name":first},separators=(",",":")),"query_id":"AA"}
    chk="\n".join(f"{k}={v}" for k,v in sorted(f.items())); sec=hmac.new(b"WebAppData",TOKEN.encode(),hashlib.sha256).digest()
    f["hash"]=hmac.new(sec,chk.encode(),hashlib.sha256).hexdigest(); return urlencode(f)
FAKE="""(initData) => { const WebApp = { platform: 'ios', initData, initDataUnsafe: {}, version: '8.0', isVersionAtLeast: () => true,
  ready(){}, expand(){}, onEvent(){}, offEvent(){}, setHeaderColor(){}, setBackgroundColor(){}, HapticFeedback: { impactOccurred(){}, notificationOccurred(){}, selectionChanged(){} },
  BackButton: { show(){}, hide(){}, onClick(){}, offClick(){} }, MainButton: { show(){}, hide(){}, setText(){}, onClick(){}, offClick(){} } };
  const TG = {}; Object.defineProperty(TG, 'WebApp', { value: WebApp, writable: false, enumerable: true });
  Object.defineProperty(window, 'Telegram', { value: TG, writable: false }); }"""
def owner_signs_in_once():
    """The stall owner (Telegram 1001) has signed in with the PIN once, so Telegram alone lets him in now."""
    req=urllib.request.Request(B+"/api/seller/login",method="POST",data=json.dumps({"phone_or_slug":"+998 93 222-33-44","pin":"2222"}).encode(),
                               headers={"Content-Type":"application/json","x-telegram-init-data":init_data(1001,"Karen")})
    urllib.request.urlopen(req).read()

def ok(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg, flush=True)


async def main():
    """👥 Mijozlarim (Shuhrat, 2026-11-28): empty state, add a customer, personal invite QR, the stall's invite QR,
    and the nasiya form fills the phone from the list."""
    owner_signs_in_once()
    t=[x for x in json.loads(urllib.request.urlopen("http://127.0.0.1:9333/json").read()) if x["type"]=="page"][0]
    async with websockets.connect(t["webSocketDebuggerUrl"], max_size=None, ping_interval=None) as ws:
        n=[0]; errs=[]
        async def cmd(m,p={}):
            n[0]+=1;i=n[0];await ws.send(json.dumps({"id":i,"method":m,"params":p}))
            while True:
                r=json.loads(await ws.recv())
                if r.get("id")==i: return r
                if r.get("method")=="Runtime.exceptionThrown": errs.append(r["params"]["exceptionDetails"].get("exception",{}).get("description","")[:200])
        async def js(e): return (await cmd("Runtime.evaluate",{"expression":e,"awaitPromise":True,"returnByValue":True}))["result"].get("result",{}).get("value")
        async def shot(name, full=False):
            r=await cmd("Page.captureScreenshot",{"format":"png","captureBeyondViewport":full}); open(f"{S}/{name}","wb").write(base64.b64decode(r["result"]["data"]))
        setv = """(sel, v) => { const el = document.querySelector(sel); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); }"""
        click = lambda tid: js(f"(()=>{{const b=document.querySelector('[data-testid={tid}]');if(!b)return false;b.click();return true}})()")
        await cmd("Page.enable"); await cmd("Runtime.enable")
        await cmd("Page.addScriptToEvaluateOnNewDocument",{"source":f"({FAKE})({json.dumps(init_data(1001,'Karen'))})"})
        await cmd("Emulation.setDeviceMetricsOverride",{"width":390,"height":844,"deviceScaleFactor":1,"mobile":True})
        await cmd("Page.navigate",{"url":B+"/?lang=uz&tab=seller_cabinet"}); await asyncio.sleep(6)
        ok(await js("!!document.querySelector('[data-testid=seller-clients]')"), "«👥 Mijozlarim» is in the seller cabinet")
        ok(await js("!!document.querySelector('[data-testid=cl-empty]')"), "an empty list says why and what to do")
        await click("cl-add"); await asyncio.sleep(0.4)
        ok(await js("document.querySelector('[data-testid=cl-save]').disabled"), "Save is off until a name is written")
        await js(f"({setv})('[data-testid=cl-name]', 'Dilnoza opa')")
        await js(f"({setv})('[data-testid=cl-phone]', '+998 90 777 66 55')")
        await js(f"({setv})('[data-testid=cl-note]', 'har juma keladi')"); await asyncio.sleep(0.3)
        await click("cl-save"); await asyncio.sleep(1.2)
        items = await js("[...document.querySelectorAll('[data-testid=cl-item]')].map(r=>r.innerText).join(' | ')")
        ok("Dilnoza opa" in items and "har juma keladi" in items and "90 777 66 55" in items, f"added: {items[:90]}")
        await click("cl-invite"); await asyncio.sleep(1.2)
        link = await js("(document.querySelector('[data-testid=cl-invite-dialog] [data-testid=cl-link]')||{}).innerText||''")
        ok("start=cl_" in link and await js("!!document.querySelector('[data-testid=cl-invite-dialog] img.cl-qr')"), f"«📲 Botga taklif» shows a personal QR: {link}")
        await shot("clients_invite_390.png")
        await cmd("Input.dispatchKeyEvent", {"type": "keyDown", "key": "Escape", "code": "Escape", "windowsVirtualKeyCode": 27}); await asyncio.sleep(0.5)
        ok(not await js("!!document.querySelector('[data-testid=cl-invite-dialog]')"), "Esc closes it")
        await click("cl-shop"); await asyncio.sleep(1.2)
        shop = await js("(document.querySelector('[data-testid=cl-shop-dialog] [data-testid=cl-link]')||{}).innerText||''")
        ok("start=shop_" in shop, f"«🛒 Rastamga taklif» shows the stall's QR and link: {shop}")
        await cmd("Input.dispatchKeyEvent", {"type": "keyDown", "key": "Escape", "code": "Escape", "windowsVirtualKeyCode": 27}); await asyncio.sleep(0.5)
        await js("document.querySelector('[data-testid=seller-clients]').scrollIntoView({block:'start'})"); await js("window.scrollBy(0,-70)")
        await shot("clients_390.png")
        # the nasiya form: a name from the list brings its phone
        await click("nasiya-entry"); await asyncio.sleep(1.5)
        await click("nasiya-new"); await asyncio.sleep(0.8)
        opts = await js("[...document.querySelectorAll('#nz-clients option')].map(o=>o.value)")
        ok("Dilnoza opa" in (opts or []), f"the nasiya name field offers the stall's customers: {opts}")
        await js(f"({setv})('[data-testid=nasiya-name]', 'Dilnoza opa')"); await asyncio.sleep(0.3)
        ph = await js("document.querySelector('[data-testid=nasiya-phone]').value")
        ok("90 777 66 55" in ph, f"picking her fills in the phone: {ph}")
        w = await js("document.documentElement.scrollWidth")
        ok(w <= 391, f"fits the phone ({w})")
        ok(not errs, f"no js errors {errs}")
asyncio.run(main())
