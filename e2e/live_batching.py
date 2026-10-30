import asyncio, json, urllib.request, websockets, base64, sys, random, time
S=sys.argv[1]; B="http://127.0.0.1:8099"
def api(m,p,b=None,h=None):
    r=urllib.request.Request(B+p,data=json.dumps(b).encode() if b is not None else None,headers={"Content-Type":"application/json",**(h or {})},method=m)
    return json.loads(urllib.request.urlopen(r).read())
res=[]
def ok(c,m): res.append(bool(c)); print(("PASS " if c else "FAIL ")+m, flush=True)
A={"x-admin-token":api("POST","/api/admin/login",{"pin":"909090"})["token"]}
ph=f"+99898{random.randint(1000000,9999999)}"
api("POST","/api/staff/register",{"role":"porter","name":"Batch Aravachi","phone":ph,"pin":"1234"})
sid=[x for x in api("GET","/api/admin/staff",h=A) if x["phone"].replace(" ","").endswith(ph[-9:])][0]["id"]
api("POST",f"/api/admin/staff/{sid}/status",{"status":"approved"},A)
login=api("POST","/api/staff/login",{"phone":ph,"pin":"1234"}); P={"x-staff-token":login["token"]}
base={"customer_name":"Test Xaridor","customer_phone":"+998901234567","delivery_time_slot":"Morning (09:00-11:00)","payment_method":"cash"}
async def main():
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
        await cmd("Runtime.enable"); await cmd("Network.enable"); await cmd("Network.setCacheDisabled",{"cacheDisabled":True})
        await cmd("Emulation.setDeviceMetricsOverride",{"width":390,"height":844,"deviceScaleFactor":1,"mobile":True})
        # 1. Instant tracker update
        o=api("POST","/api/orders",{**base,"fulfillment":"point","handoff_point":"parking","items":[{"product_id":7,"store_id":1,"quantity":1}]})
        await cmd("Page.navigate",{"url":B+"/?lang=uz"}); await asyncio.sleep(2)
        await js(f"localStorage.setItem('yunusobod_my_orders', JSON.stringify(['{o['order_number']}']))")
        await cmd("Page.navigate",{"url":B+f"/?lang=uz&tab=orders&order={o['order_number']}"}); await asyncio.sleep(5)
        api("POST",f"/api/porter/orders/{o['id']}/take",{},P)
        t0=time.time(); seen=None
        while time.time()-t0<8:
            if await js("document.body.innerText.includes(\"Bozorda yig'ilmoqda\")"): seen=time.time()-t0; break
            await asyncio.sleep(0.1)
        ok(seen is not None and seen < 2, f"customer screen changed to «Bozorda yig'ilmoqda» by itself in {seen:.1f} s (before: up to 10 s)" if seen else "customer screen did not update")
        api("POST",f"/api/porter/orders/{o['id']}/release",{},P)
        # 2. Batch: three orders from row 1 to the same gate
        nums=[]
        for pid in (6,8,9):
            x=api("POST","/api/orders",{**base,"fulfillment":"point","handoff_point":"main_gate","items":[{"product_id":pid,"store_id":1,"quantity":1},{"product_id":19,"store_id":1,"quantity":1}]})
            nums.append(x["order_number"])
        await js(f"localStorage.setItem('staff_session', {json.dumps(json.dumps({'token':login['token'],'staff':login['staff']}))})")
        await cmd("Page.navigate",{"url":B+"/?lang=uz&tab=porter"}); await asyncio.sleep(5)
        has=await js("document.body.innerText.includes(\"Bitta yo'lda 3 ta buyurtma\")")
        await shot("lb_batch_card.png")
        ok(has, "aravachi sees «🔗 Bitta yo'lda 3 ta buyurtma»")
        r=await js(f"""(()=>{{const b=[...document.querySelectorAll('button')].filter(b=>b.innerText.includes('Hammasini olaman')).find(b=>b.parentElement.innerText.includes('{nums[0]}'));if(!b)return false;b.click();return true}})()"""); await asyncio.sleep(3)
        ok(r, "pressed «Hammasini olaman»")
        mine=api("GET","/api/porter/orders",h=P)["mine"]
        ok(sorted(m["order_number"] for m in mine if m["status"]=="picking")==sorted(nums), "all 3 orders are now this aravachi's")
        combined=await js("document.body.innerText.includes(\"Umumiy yo'nalish\")")
        bags=await js("[...document.querySelectorAll('span')].filter(s=>/^[ABC]$/.test(s.innerText)).map(s=>s.innerText).join('')")
        await shot("lb_combined.png")
        ok(combined and set(bags)=={"A","B","C"}, f"combined route opened, items carry bag letters ({''.join(sorted(set(bags)))})")
        for _ in range(10):
            r=await js("(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.querySelector('svg.lucide-circle')&&!b.disabled);if(!b)return false;b.click();return true})()")
            await asyncio.sleep(1)
            if not r: break
        mine=api("GET","/api/porter/orders",h=P)["mine"]
        ok(all(m["picked_count"]==m["items_count"] for m in mine if m["order_number"] in nums), "ticked everything in one walk: all 3 orders fully collected")
        print("js errors:", errs)
        print(f"TOTAL {sum(res)}/{len(res)}")
asyncio.run(main())
