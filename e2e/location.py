import asyncio, json, urllib.request, websockets, base64, sys
S=sys.argv[1]; B="http://127.0.0.1:8099"
FAKE="""(platform, requested, granted) => { window.__getLocationCalls = 0; window.__settingsOpened = 0;
  const WebApp = { platform, initData: '', initDataUnsafe: {}, version: '8.0', isVersionAtLeast: () => true,
    ready(){}, expand(){}, onEvent(){}, offEvent(){}, setHeaderColor(){}, setBackgroundColor(){}, HapticFeedback: { impactOccurred(){}, notificationOccurred(){}, selectionChanged(){} },
    BackButton: { show(){}, hide(){}, onClick(){}, offClick(){} }, MainButton: { show(){}, hide(){}, setText(){}, onClick(){}, offClick(){} },
    LocationManager: { isInited: true, isLocationAvailable: true, isAccessRequested: requested, isAccessGranted: granted,
      init(cb){ cb && cb(); }, getLocation(cb){ window.__getLocationCalls++; cb(null); }, openSettings(){ window.__settingsOpened++; } } };
  const TG = {}; Object.defineProperty(TG, 'WebApp', { value: WebApp, writable: false, enumerable: true });
  Object.defineProperty(window, 'Telegram', { value: TG, writable: false }); }"""
async def run(platform, requested, granted, label):
    t=[x for x in json.loads(urllib.request.urlopen("http://127.0.0.1:9333/json").read()) if x["type"]=="page"][0]
    async with websockets.connect(t["webSocketDebuggerUrl"], max_size=None, ping_interval=None) as ws:
        n=[0]
        async def cmd(m,p={}):
            n[0]+=1;i=n[0];await ws.send(json.dumps({"id":i,"method":m,"params":p}))
            while True:
                r=json.loads(await ws.recv())
                if r.get("id")==i: return r
        async def js(e): return (await cmd("Runtime.evaluate",{"expression":e,"awaitPromise":True,"returnByValue":True}))["result"].get("result",{}).get("value")
        await cmd("Page.enable")
        s=await cmd("Page.addScriptToEvaluateOnNewDocument",{"source":f"({FAKE})({json.dumps(platform)},{json.dumps(requested)},{json.dumps(granted)})"})
        await cmd("Emulation.setDeviceMetricsOverride",{"width":390,"height":844,"deviceScaleFactor":1,"mobile":True})
        await cmd("Page.navigate",{"url":B+"/?lang=ru"}); await asyncio.sleep(4)
        await js("(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Выберите адрес')||b.innerText.includes('Доставка'));b&&b.click()})()"); await asyncio.sleep(4)
        calls_open=await js("window.__getLocationCalls")
        print(f"[{label}] map opened: Telegram asked for location {calls_open} time(s) (want 0)")
        has_btn=await js("!!document.querySelector('button[aria-label=\"my location\"]')")
        print(f"[{label}] «my location» button on the map: {has_btn}")
        await js("document.querySelector('button[aria-label=\"my location\"]')?.click()"); await asyncio.sleep(2)
        text=await js("document.body.innerText")
        msg=[l for l in text.split('\n') if 'местоположен' in l.lower()]
        print(f"[{label}] after tapping «my location»: {msg[:2]}")
        btn=await js("!![...document.querySelectorAll('button')].find(b=>b.innerText.includes('Разрешить местоположение'))")
        if btn:
            await js("[...document.querySelectorAll('button')].find(b=>b.innerText.includes('Разрешить местоположение')).click()"); await asyncio.sleep(0.5)
        print(f"[{label}] «Разрешить» button shown: {btn}, Telegram settings opened: {await js('window.__settingsOpened')}")
        r=await cmd("Page.captureScreenshot",{"format":"png"}); open(f"{S}/geo_{platform}.png","wb").write(base64.b64decode(r["result"]["data"]))
        await cmd("Page.removeScriptToEvaluateOnNewDocument",{"identifier":s["result"]["identifier"]})
asyncio.run(run("macos", False, False, "Mac Telegram"))
asyncio.run(run("ios", True, False, "iPhone, refused before"))
