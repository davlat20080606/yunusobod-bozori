"""Scale weight (±5% hard limit), sold out lines, the handoff code, the taxi at the gate and the cold chain."""
import asyncio
import sqlite3

from conftest import DB_FILE


def test_adjustments(api, ok, admin, sellers, make_staff):
    S1, S2 = sellers[0], sellers[1]
    P = make_staff("porter"); T = make_staff("taxi")
    base={"customer_name":"Test","customer_phone":"+998901234567","delivery_time_slot":"Morning (09:00-11:00)","payment_method":"cash"}
    # beef 95 000/kg x1 (store 2), patir 12 000 x2 (store 3), tomato 22 000 x1 (store 1)
    items=[{"product_id":11,"store_id":2,"quantity":1},{"product_id":13,"store_id":3,"quantity":2},{"product_id":6,"store_id":1,"quantity":1}]
    c,o=api("POST","/orders",{**base,"fulfillment":"courier","handoff_point":"main_gate","delivery_address":"Yunusobod 4","delivery_lat":41.36,"delivery_lng":69.29,"items":items})
    ok(c==200 and o["handoff_code"] and len(o["handoff_code"])==4, f"order has a 4-digit handoff code ({o.get('handoff_code')})")
    total0=o["total_amount"]; num=o["order_number"]; oid=o["id"]
    beef=[i for i in o["items"] if i["product_id"]==11][0]; patir=[i for i in o["items"] if i["product_id"]==13][0]; tom=[i for i in o["items"] if i["product_id"]==6][0]
    po=api("GET","/porter/orders",h=P)[1]
    ok(all("handoff_code" not in x for x in po["available"]) and any(x.get("needs_code") for x in po["available"]), "porter does not see the code, only that one is needed")
    api("POST",f"/porter/orders/{oid}/take",{},P)
    c,r=api("PATCH",f"/porter/items/{beef['id']}/weight",{"actual_quantity":1.05},P)
    b=[i for s in r["stops"] for i in s["items"] if i["id"]==beef["id"]][0]
    ok(c==200 and b["weight_status"] is None and b["is_picked"], "1.05 kg beef (+5%) accepted by itself, ticked")
    o2=api("GET",f"/orders/{num}")[1]
    ok(o2["total_amount"]==total0+4750, f"total +4 750 for the extra 50 g ({o2['total_amount']-total0:+.0f})")
    c,r=api("PATCH",f"/porter/items/{beef['id']}/weight",{"actual_quantity":0.96},P)
    ok(c==200 and [i for i in api("GET",f"/orders/{num}")[1]["items"] if i["id"]==beef["id"]][0]["weight_status"] is None, "0.96 kg (−4%) accepted by itself")
    for w,label in ((1.07,"+7%"),(0.9,"−10%"),(1.25,"+25%")):
        c,r=api("PATCH",f"/porter/items/{beef['id']}/weight",{"actual_quantity":w},P)
        ok(c==400 and "0.95" in str(r) and "1.05" in str(r), f"{w} kg ({label}) refused with the allowed range: {str(r)[:60]}")
    c,r=api("PATCH",f"/seller/items/{beef['id']}/weight",{"actual_quantity":1.2},S2)
    ok(c==400, "the stall's own seller is refused too")
    o3=api("GET",f"/orders/{num}")[1]; b3=[i for i in o3["items"] if i["id"]==beef["id"]][0]
    ok(b3["actual_quantity"]==0.96 and b3["weight_status"] is None and o3["total_amount"]==total0-3800, f"last good weight 0.96 kg kept, customer never asked ({o3['total_amount']-total0:+.0f})")
    c,r=api("POST",f"/seller/items/{patir['id']}/missing",{"missing":True},S2)
    ok(c==404, "another stall cannot touch this line")
    c,r=api("POST",f"/porter/items/{patir['id']}/missing",{"missing":True},P)
    o5=api("GET",f"/orders/{num}")[1]
    ok(o5["status"]=="picking" and o5["total_amount"]==total0-3800-24000, f"patir ran out: only that line dropped (−24 000), order goes on")
    c,r=api("POST",f"/seller/items/{tom['id']}/missing",{"missing":True},S1)
    prod=[p for p in api("GET","/products")[1] if p["id"]==6]
    ok(c==200 and (not prod or not prod[0]["is_available"]), "seller «Mahsulot tugadi»: line dropped and the product hidden from the shop")
    api("POST",f"/seller/items/{tom['id']}/missing",{"missing":False},S1)
    o6=api("GET",f"/orders/{num}")[1]
    ok([i for i in o6["items"] if i["id"]==tom["id"]][0]["item_status"]=="ok", "seller can undo «tugadi»")
    for st in api("GET","/porter/orders",h=P)[1]["mine"][0]["stops"]:
        for it in st["items"]:
            if not it["is_picked"]: api("PATCH",f"/porter/items/{it['id']}/picked",{"is_picked":True},P)
    c,r=api("PATCH",f"/porter/orders/{oid}/status",{"status":"handed_over"},P)
    ok(c==200 and r["handed_over_at"], "porter called a taxi, waiting time starts")
    c,r=api("POST",f"/taxi/orders/{oid}/take",{"eta_minutes":7},T)
    ok(c==200 and r["taxi_eta_at"], "taxi took it, said 7 minutes")
    api("PATCH",f"/taxi/orders/{oid}/status",{"status":"on_the_way"},T)
    ok(api("PATCH",f"/taxi/orders/{oid}/status",{"status":"delivered","code":"0000" if o["handoff_code"]!="0000" else "1111"},T)[0]==403, "wrong code: taxi cannot mark delivered")
    c,r=api("PATCH",f"/taxi/orders/{oid}/status",{"status":"delivered","code":o["handoff_code"]},T)
    ok(c==200 and r["status"]=="delivered", "right code from the customer: delivered")
    # cold chain
    c,o7=api("POST","/orders",{**base,"fulfillment":"courier","handoff_point":"parking","delivery_address":"Yunusobod 4","delivery_lat":41.36,"delivery_lng":69.29,"items":[{"product_id":11,"store_id":2,"quantity":1}]})
    api("POST",f"/porter/orders/{o7['id']}/take",{},P)
    for st in api("GET","/porter/orders",h=P)[1]["mine"][0]["stops"]:
        for it in st["items"]: api("PATCH",f"/porter/items/{it['id']}/picked",{"is_picked":True},P)
    api("PATCH",f"/porter/orders/{o7['id']}/status",{"status":"handed_over"},P)
    db=sqlite3.connect(DB_FILE); db.execute("update orders set handed_over_at=datetime('now','-20 minutes') where id=?",(o7["id"],)); db.commit()
    from app.services import maintenance
    n=asyncio.run(maintenance.check_cold_chain()); n2=asyncio.run(maintenance.check_cold_chain())
    ok(n==1 and n2==0, "20 minutes at the gate: one alert, not repeated")
    # all missing cancels
    c,o8=api("POST","/orders",{**base,"fulfillment":"self","items":[{"product_id":12,"store_id":2,"quantity":1}]})
    it=o8["items"][0]["id"]; c,r=api("POST",f"/seller/items/{it}/missing",{"missing":True},S2)
    ok(r.get("order_status")=="cancelled", "the only item ran out: order cancelled, not left hanging")
    ok(api("GET","/orders/mine")[1]==[], "/orders/mine without Telegram returns nothing")
