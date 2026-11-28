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
    """The owner adds a helper by name and Telegram number in the cabinet, no QR (Shuhrat, 2026-11-28)."""
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
        await cmd("Page.enable"); await cmd("Runtime.enable")
        await cmd("Page.addScriptToEvaluateOnNewDocument",{"source":f"({FAKE})({json.dumps(init_data(1001,'Karen'))})"})
        await cmd("Emulation.setDeviceMetricsOverride",{"width":390,"height":844,"deviceScaleFactor":1,"mobile":True})
        await cmd("Page.navigate",{"url":B+"/?lang=uz&tab=seller_cabinet"}); await asyncio.sleep(6)
        ok(await js("!!document.querySelector('[data-testid=helper-by-phone]')"), "the owner sees «📱 Yordamchini raqami bilan qo'shish»")
        ok(await js("document.querySelector('[data-testid=helper-save]').disabled"), "Save is off until name and phone are filled")
        await js(f"({setv})('[data-testid=helper-name]', 'Bekzod')")
        await js(f"({setv})('[data-testid=helper-phone]', '+998 90 111 22 33')"); await asyncio.sleep(0.3)
        await js("document.querySelector('[data-testid=helper-save]').click()"); await asyncio.sleep(1.5)
        saved = await js("(document.querySelector('[data-testid=helper-saved]')||{}).innerText||''")
        ok("Bekzod" in saved, f"saved: {saved[:60]}")
        rows = await js("[...document.querySelectorAll('[data-testid=helper-phone-row]')].map(r=>r.innerText).join(' | ')")
        ok("Bekzod" in rows and "skanerlamagan" in rows, f"listed as «not scanned yet»: {rows[:80]}")
        await js("document.querySelector('[data-testid=helper-by-phone]').scrollIntoView({block:'start'})"); await js("window.scrollBy(0,-70)")
        await shot("helper_phone_390.png")
        w = await js("document.documentElement.scrollWidth")
        ok(w <= 391, f"fits the phone ({w})")
        ok(not errs, f"no js errors {errs}")
asyncio.run(main())
