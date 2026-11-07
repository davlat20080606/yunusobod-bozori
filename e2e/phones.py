"""The customer's screens on phones from the smallest to the largest: nothing runs off the side, nothing is cut,
and the language can be changed from the home screen."""
import asyncio, base64, json, sys, urllib.request, websockets
S = sys.argv[1]
B = "http://127.0.0.1:8099"
PHONES = [(320, 568, "iPhone SE 1"), (360, 640, "small Android"), (375, 667, "iPhone 8"), (390, 844, "iPhone 14"),
          (412, 915, "Pixel"), (430, 932, "iPhone Pro Max")]
SCREENS = [("market", ""), ("catalog", "&tab=catalog"), ("saved", "&tab=saved"), ("orders", "&tab=orders"), ("seller", "&tab=seller")]
OVERFLOW = """(()=>{const w=document.documentElement.clientWidth;const bad=[];
for(const e of document.querySelectorAll('body *')){const r=e.getBoundingClientRect();
 if(r.width<=0||r.height<=0)continue;const st=getComputedStyle(e);if(st.visibility==='hidden'||st.display==='none')continue;
 let p=e.parentElement,scroll=false;while(p&&p!==document.body){const o=getComputedStyle(p);if(['auto','scroll','hidden'].includes(o.overflowX)){scroll=true;break}p=p.parentElement}
 if(!scroll&&(r.right>w+1||r.left<-1)&&!e.closest('[aria-hidden=true]')&&!e.closest('.maplibregl-map'))bad.push(e.tagName+'.'+String(e.className).slice(0,30)+' '+Math.round(r.left)+'..'+Math.round(r.right))}
return {page:document.documentElement.scrollWidth,w,bad:bad.slice(0,4)}})()"""
CUT = """[...document.querySelectorAll('.med-lang-button,.med-nav-text,.med-brand-name')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.innerText)"""


def ok(cond, msg):
    print(("PASS " if cond else "FAIL ") + msg, flush=True)


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

        await cmd("Page.enable"); await cmd("Runtime.enable")
        for lang in ("uz", "ru"):
            for w, h, name in PHONES:
                await cmd("Emulation.setDeviceMetricsOverride", {"width": w, "height": h, "deviceScaleFactor": 2, "mobile": True})
                for screen, q in SCREENS:
                    await cmd("Page.navigate", {"url": f"{B}/?lang={lang}{q}"}); await asyncio.sleep(1.6)
                    r = await js(OVERFLOW)
                    cut = await js(CUT)
                    corner = await js("(()=>{const b=document.querySelector('header [data-testid=language-switcher]');if(!b)return null;const r=b.getBoundingClientRect();return {right:Math.round(innerWidth-r.right),top:Math.round(r.top)}})()")
                    ok(corner and corner["right"] <= 20 and corner["top"] <= 30, f"{lang} {w}px {screen}: language button in the top right corner {corner}")
                    ok(r and r["page"] <= r["w"] + 1 and not r["bad"] and not cut, f"{lang} {w}px {name} {screen}: {r} cut={cut}")
                    if screen == "market":
                        r2 = await cmd("Page.captureScreenshot", {"format": "png"})
                        open(f"{S}/phone_{lang}_{w}.png", "wb").write(base64.b64decode(r2["result"]["data"]))

        # The way to an order, on the narrowest phones with all three ways of getting it open
        for w, h in ((320, 568), (360, 640)):
            await cmd("Emulation.setDeviceMetricsOverride", {"width": w, "height": h, "deviceScaleFactor": 2, "mobile": True})
            await cmd("Page.navigate", {"url": f"{B}/?lang=ru"}); await asyncio.sleep(3)
            await js(f"""(()=>{{for(const b of document.querySelectorAll('button')){{if(!b.querySelector('svg.lucide-plus'))continue;b.scrollIntoView({{block:'center'}});b.click();return true}}return false}})()""")
            await asyncio.sleep(1)
            await js("(()=>{const b=[...document.querySelectorAll('button.animate-fade')].find(b=>getComputedStyle(b).position==='fixed');b&&b.click()})()")
            await asyncio.sleep(2)
            r = await js(OVERFLOW)
            ok(r["page"] <= w + 1 and not r["bad"], f"cart {w}px: {r}")
            shot = await cmd("Page.captureScreenshot", {"format": "png"}); open(f"{S}/phone_cart_{w}.png", "wb").write(base64.b64decode(shot["result"]["data"]))
            went = await js("(()=>{const b=[...document.querySelectorAll('button')].find(b=>/Оформ/.test(b.innerText));if(!b)return false;b.click();return true})()")
            await asyncio.sleep(3)
            r = await js(OVERFLOW)
            text = await js("document.body.innerText")
            ok(went and "Аравачи" in text and r["page"] <= w + 1 and not r["bad"], f"checkout {w}px: went={went} {r}")
            shot = await cmd("Page.captureScreenshot", {"format": "png"}); open(f"{S}/phone_checkout_{w}.png", "wb").write(base64.b64decode(shot["result"]["data"]))
            await js("localStorage.clear()")

        await cmd("Emulation.setDeviceMetricsOverride", {"width": 320, "height": 568, "deviceScaleFactor": 2, "mobile": True})
        await cmd("Page.navigate", {"url": f"{B}/?lang=uz"}); await asyncio.sleep(2.5)
        await js("document.querySelector('.med-lang-button').click()"); await asyncio.sleep(0.6)
        menu = await js("(()=>{const m=document.querySelector('.med-lang-list');if(!m)return null;const r=m.getBoundingClientRect();return {left:Math.round(r.left),right:Math.round(innerWidth-r.right)}})()")
        ok(menu and menu["left"] >= 0 and menu["right"] >= 0, f"the language menu opens inside the screen at 320 px: {menu}")
        await js("[...document.querySelectorAll('.med-lang-option')].find(b=>b.innerText.includes('Русский')).click()"); await asyncio.sleep(1)
        ok(await js("document.documentElement.lang") == "ru" or "Выберите адрес" in (await js("document.body.innerText")), "the header menu changes the language to Russian")
        ok("Выберите адрес" in (await js("document.body.innerText")), "the home screen is in Russian at once")
        await cmd("Page.navigate", {"url": f"{B}/?tab=seller"}); await asyncio.sleep(2)
        ok(await js("document.querySelector('.med-lang-button').innerText.includes('RU')") and not await js("document.querySelector('.med-lang-list')"), "the button now says RU and the menu has closed")
        ok("Язык" not in (await js("document.body.innerText")), "no second language block in «Продавец»")

asyncio.run(main())
