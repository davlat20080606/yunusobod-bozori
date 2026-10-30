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
async def main():
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
        async def shot(name): r=await cmd("Page.captureScreenshot",{"format":"png"}); open(f"{S}/{name}","wb").write(base64.b64decode(r["result"]["data"]))
        await cmd("Page.enable"); await cmd("Runtime.enable")
        await cmd("Page.addScriptToEvaluateOnNewDocument",{"source":f"({FAKE})({json.dumps(init_data(1001,'Karen'))})"})
        await cmd("Emulation.setDeviceMetricsOverride",{"width":390,"height":844,"deviceScaleFactor":2,"mobile":True})
        await cmd("Page.navigate",{"url":B+"/?lang=uz&tab=seller_cabinet"}); await asyncio.sleep(6)
        print("cabinet opened without PIN:", await js("document.body.innerText.includes('Rasta jamoasi')"))
        await js("[...document.querySelectorAll('h3')].find(h=>h.innerText.includes('Rasta jamoasi'))?.scrollIntoView({block:'start'})"); await js("window.scrollBy(0,-70)")
        await js("[...document.querySelectorAll('button')].find(b=>b.innerText.includes(\"Yordamchi qo'shish\"))?.click()"); await asyncio.sleep(2)
        await js("document.querySelector('img[alt=QR]')?.scrollIntoView({block:'center'})"); await asyncio.sleep(0.5)
        print("QR shown:", await js("!!document.querySelector('img[alt=QR]')?.src?.startsWith('data:image/png')"))
        await shot("team_qr.png")
        print("js errors:", errs)
asyncio.run(main())
