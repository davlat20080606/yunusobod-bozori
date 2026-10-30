import asyncio, json, urllib.request, websockets
async def main():
    t=[x for x in json.loads(urllib.request.urlopen("http://127.0.0.1:9333/json").read()) if x["type"]=="page"][0]
    async with websockets.connect(t["webSocketDebuggerUrl"], max_size=None, ping_interval=None) as ws:
        n=[0]
        async def cmd(m,p={}):
            n[0]+=1;i=n[0];await ws.send(json.dumps({"id":i,"method":m,"params":p}))
            while True:
                r=json.loads(await ws.recv())
                if r.get("id")==i: return r
        async def js(e): return (await cmd("Runtime.evaluate",{"expression":e,"returnByValue":True}))["result"].get("result",{}).get("value")
        await cmd("Page.navigate",{"url":"http://127.0.0.1:8099/"}); await asyncio.sleep(2); await js("localStorage.clear()")
        for url,label in (("/?lang=ru","bot menu ?lang=ru"),("/?tab=orders","order message button (no lang)"),("/","plain reopen"),("/?lang=en","bot menu ?lang=en"),("/?tab=catalog","catalog (no lang)")):
            await cmd("Page.navigate",{"url":"http://127.0.0.1:8099"+url}); await asyncio.sleep(3.5)
            print(f"{label:34s} -> html lang={await js('document.documentElement.lang')} | {(await js('document.querySelector(\".med-brand-name\")?.innerText'))}")
asyncio.run(main())
