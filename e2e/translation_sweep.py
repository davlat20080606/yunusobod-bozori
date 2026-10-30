"""Open every screen in ru and en and list visible lines that are still Uzbek."""
import asyncio, json, urllib.request, websockets, sys, re, random
S = sys.argv[1]; LANGS = sys.argv[2].split(","); B = "http://127.0.0.1:8099"
def api(m, p, body=None, h=None):
    r = urllib.request.Request(B + p, data=json.dumps(body).encode() if body is not None else None, headers={"Content-Type": "application/json", **(h or {})}, method=m)
    return json.loads(urllib.request.urlopen(r).read())
A = {"x-admin-token": api("POST", "/api/admin/login", {"pin": "909090"})["token"]}
admin_login = api("POST", "/api/admin/login", {"pin": "909090"})
seller = api("POST", "/api/seller/login", {"phone_or_slug": "+998 93 222-33-44", "pin": "2222"})
staff = {}
for role in ("porter", "taxi", "pattachi"):
    ph = f"+99894{random.randint(1000000, 9999999)}"
    api("POST", "/api/staff/register", {"role": role, "name": "Test " + role, "phone": ph, "pin": "1234", "car": "Cobalt" if role == "taxi" else None})
    sid = [x for x in api("GET", "/api/admin/staff", h=A) if x["phone"].replace(" ", "").endswith(ph[-9:])][0]["id"]
    api("POST", f"/api/admin/staff/{sid}/status", {"status": "approved"}, A)
    staff[role] = api("POST", "/api/staff/login", {"phone": ph, "pin": "1234"})
orders = [o["order_number"] for o in api("GET", "/api/admin/orders", h=A)]
# Uzbek giveaways: o'/g' apostrophes and common Uzbek words
UZ = re.compile(r"\b\w*[oOgG][ʻ'‘’`]\w*|\b(va|uchun|bilan|yoki|emas|kerak|hozircha|buyurtma\w*|mahsulot\w*|savat\w*|yetkaz\w*|sotuvchi\w*|aravachi\w*|taksichi\w*|rasta\w*|joy\w*|tanlang|kiriting|qo'sh\w*|olish|olaman|bekor|tayyor\w*|yangi|barcha|hamma|bozor\w*|narx\w*|chegirma\w*|to'lov|naqd|kirish|chiqish|saqla\w*|tahrir\w*|yopiq|ochiq|qidir\w*|daq|kun\w*|soat|bugun|ertaga|kechqurun|ertalab|manzil\w*|xarita\w*|ism\w*|telefon\w*\s+raqam\w*|raqam\w*|kod\w*|ariza\w*|tasdiq\w*|xodim\w*|sozlama\w*|patta\w*|Yuborish|Ochish|Orqaga|Mening|Sizning|Saralangan|Katalog|Asosiy|Yana)\b", re.I)
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
        async def click(text):
            return await js(f"(()=>{{const b=[...document.querySelectorAll('button,a')].find(b=>b.innerText.includes({json.dumps(text)}));if(b){{b.click();return true}}return false}})()")
        await cmd("Network.enable"); await cmd("Network.setCacheDisabled", {"cacheDisabled": True})
        await cmd("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
        await cmd("Page.navigate", {"url": B}); await asyncio.sleep(3)
        found = {}
        async def scan(lang, name):
            text = await js("document.body.innerText")
            for line in (text or "").split("\n"):
                line = line.strip()
                if line and UZ.search(line):
                    found.setdefault((lang, line), name)
        for lang in LANGS:
            async def nav(q, wait=4):
                await js(f"localStorage.setItem('yunusobod_lang','{lang}')")
                await cmd("Page.navigate", {"url": f"{B}/?lang={lang}{q}"}); await asyncio.sleep(wait)
            await js("localStorage.clear()")
            await js(f"localStorage.setItem('yunusobod_addresses', JSON.stringify([{{main:'Amir Temur 108',details:'',district:'Yunusobod',lat:41.362,lng:69.287}}]))")
            await nav(""); await scan(lang, "home")
            await js("window.scrollTo(0, document.body.scrollHeight)"); await asyncio.sleep(1.5); await scan(lang, "home-bottom/footer")
            await nav("&tab=catalog"); await scan(lang, "catalog")
            await nav("&tab=saved"); await scan(lang, "saved")
            await nav("")
            await js("(()=>{const img=[...document.querySelectorAll('img')].find(i=>i.closest('div')&&i.width>100);img&&img.click()})()"); await asyncio.sleep(2); await scan(lang, "product page")
            await nav("")
            await js("(()=>{for(const b of document.querySelectorAll('button')){if(b.querySelector('svg.lucide-plus')){b.click();return}}})()"); await asyncio.sleep(1)
            await js("(()=>{const b=[...document.querySelectorAll('button.animate-fade')].find(b=>getComputedStyle(b).position==='fixed');b&&b.click()})()"); await asyncio.sleep(2); await scan(lang, "cart")
            await js("(()=>{const b=[...document.querySelectorAll('button')].find(b=>/Rasmiylash|Оформить|Checkout/.test(b.innerText));b&&b.click()})()"); await asyncio.sleep(3); await scan(lang, "checkout courier")
            for i in range(3):
                await js(f"(()=>{{const g=[...document.querySelectorAll('button')].filter(b=>b.querySelector('span')&&b.innerText.split('\\n').length>=3&&b.offsetWidth<200);g[{i}]&&g[{i}].click()}})()"); await asyncio.sleep(1.5); await scan(lang, f"checkout mode {i}")
            await js(f"localStorage.setItem('yunusobod_my_orders', JSON.stringify({json.dumps(orders[:6])}))")
            await nav("&tab=orders"); await scan(lang, "my orders")
            for num in orders[:4]:
                await nav(f"&tab=orders&order={num}"); await scan(lang, f"tracker {num}")
            await nav("&tab=seller"); await scan(lang, "seller hub")
            await js(f"localStorage.setItem('seller_session', {json.dumps(json.dumps({'token': seller['token'], 'store': seller['store']}))})")
            await nav("&tab=seller_cabinet", 6); await scan(lang, "seller cabinet")
            await js("window.scrollTo(0, document.body.scrollHeight/2)"); await asyncio.sleep(1); await scan(lang, "seller cabinet mid")
            await js("window.scrollTo(0, document.body.scrollHeight)"); await asyncio.sleep(1); await scan(lang, "seller cabinet bottom")
            for role, tab in (("porter", "porter"), ("taxi", "taxi"), ("pattachi", "pattachi")):
                await js("localStorage.removeItem('staff_session')")
                await nav(f"&tab={tab}"); await scan(lang, f"{tab} login")
                await js(f"localStorage.setItem('staff_session', {json.dumps(json.dumps({'token': staff[role]['token'], 'staff': staff[role]['staff']}))})")
                await nav(f"&tab={tab}", 5); await scan(lang, f"{tab} panel")
                await click("Mening") or await click("Мои") or await click("My"); await asyncio.sleep(1.5); await scan(lang, f"{tab} mine")
            await js("localStorage.removeItem('admin_session')")
            await nav("&tab=admin"); await scan(lang, "admin login")
            await js(f"localStorage.setItem('admin_session', {json.dumps(json.dumps(admin_login))})")
            await nav("&tab=admin", 5); await scan(lang, "admin panel")
            for i in range(6):
                await js(f"(()=>{{const tabs=[...document.querySelectorAll('button')].filter(b=>b.offsetParent&&b.innerText.length<30&&b.innerText.length>2);const top=tabs.filter(b=>b.getBoundingClientRect().top<260);top[{i}]&&top[{i}].click()}})()"); await asyncio.sleep(1.5); await scan(lang, f"admin tab {i}")
        byscreen = {}
        for (lang, line), screen in found.items():
            byscreen.setdefault((lang, screen), []).append(line)
        for (lang, screen), lines in byscreen.items():
            print(f"\n[{lang}] {screen}:")
            for l in lines[:40]: print("   ", l[:140])
        print("\nTOTAL lines:", len(found))
asyncio.run(main())
