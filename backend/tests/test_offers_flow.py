"""Stall offers in the quote and every handover step for self pickup and an aravachi to a point."""


def test_offers_and_handover(api, ok, admin, sellers, make_staff, relaxed_limits):
    S1, S2 = sellers[0], sellers[1]
    A = admin
    st1=api("GET","/seller/my-store",headers=S1)[1]; st2=api("GET","/seller/my-store",headers=S2)[1]
    p1=[p for p in st1["products"] if p["is_available"]][0]; p2=[p for p in st2["products"] if p["is_available"]][0]
    sid1,sid2=p1["store_id"],p2["store_id"]
    for H in (S1,S2):
        for pr in api("GET","/seller/promos",headers=H)[1]: api("DELETE",f"/seller/promos/{pr['id']}",headers=H)
    api("POST","/seller/promos",{"kind":"delivery","min_amount":400000,"amount":18000},S1)
    api("POST","/seller/promos",{"kind":"delivery","min_amount":400000,"amount":18000},S2)
    api("POST","/seller/promos",{"kind":"discount","min_amount":400000,"percent":5},S1)
    api("POST","/seller/promos",{"kind":"gift","min_amount":400000,"gift_text":"1 kg sabzi"},S2)
    ok(api("POST","/seller/promos",{"kind":"discount","min_amount":1000},S1)[0]==400, "discount without percent rejected")
    q1=lambda p: int(400000//p["price"])+1
    items=[{"product_id":p1["id"],"store_id":sid1,"quantity":q1(p1)},{"product_id":p2["id"],"store_id":sid2,"quantity":q1(p2)}]
    q=api("POST","/orders/quote",{"fulfillment":"courier","items":items})[1]
    taxi=[b for b in q["bonuses"] if b["kind"]=="free_taxi"]
    ok(any(b["kind"]=="gift" for b in q["bonuses"]) and any(b["kind"]=="discount" and b["amount"]==round(p1["price"]*q1(p1)*0.05) for b in q["bonuses"]), "gift and 5% discount applied")
    qs=api("POST","/orders/quote",{"fulfillment":"self","items":items})[1]
    small=[{"product_id":p1["id"],"store_id":sid1,"quantity":1}]
    qh=api("POST","/orders/quote",{"fulfillment":"courier","items":small})[1]

    base={"customer_name":"Test Xaridor","customer_phone":"+998901234567","delivery_time_slot":"Morning (09:00-11:00)","payment_method":"cash"}
    ok(api("POST","/orders",{**base,"fulfillment":"point","items":small})[0]==400, "point without handoff point rejected")
    c,o=api("POST","/orders",{**base,"fulfillment":"courier","handoff_point":"main_gate","delivery_address":"Yunusobod 4, 12","delivery_lat":41.36,"delivery_lng":69.29,"items":items})

    c,o=api("POST","/orders",{**base,"fulfillment":"courier","handoff_point":"main_gate","delivery_address":"Yunusobod 4, 12","delivery_lat":41.36,"delivery_lng":69.29,"items":items}); ok(c==200,"courier order created")
    # self pickup flow
    c,so=api("POST","/orders",{**base,"fulfillment":"self","items":items}); ok(c==200, "self order created")
    ok(api("POST",f"/orders/{so['order_number']}/received")[0]==409, "customer cannot confirm before sellers hand over")
    api("POST",f"/seller/orders/{so['id']}/ready",headers=S1); r=api("POST",f"/seller/orders/{so['id']}/ready",headers=S2)[1]
    ok(r["status"]=="ready", "all stalls ready -> order ready")
    api("POST",f"/seller/orders/{so['id']}/handed",headers=S1); r=api("POST",f"/seller/orders/{so['id']}/handed",headers=S2)[1]
    ok(r["status"]=="delivered", "all stalls handed -> delivered")
    c,r=api("POST",f"/orders/{so['order_number']}/received"); ok(c==200 and r["customer_confirmed_at"], "customer confirmed")
    ok(api("POST",f"/reviews/{so['order_number']}",{"rating":5,"comment":"Zo'r"})[0]==200, "review after confirm")

    # porter flow for point
    P = make_staff("porter", "Test Aravachi")
    c,po=api("POST","/orders",{**base,"fulfillment":"point","handoff_point":"parking","items":small}); ok(c==200,"point order created")
    avail=api("GET","/porter/orders",headers=P)[1]["available"]
    ok(any(x["id"]==po["id"] for x in avail) and not any(x["id"]==so["id"] for x in avail), "porter sees point order, not self order")
    ok(api("POST",f"/seller/orders/{po['id']}/handed",headers=S1)[0]==409, "seller cannot hand before porter takes")
    t=api("POST",f"/porter/orders/{po['id']}/take",headers=P)[1]
    ok(api("POST",f"/seller/orders/{po['id']}/handed",headers=S1)[0]==200, "seller handed to porter")
    for st in t["stops"]:
        for it in st["items"]: api("PATCH",f"/porter/items/{it['id']}/picked",{"is_picked":True},P)
    ok(api("PATCH",f"/porter/orders/{po['id']}/status",{"status":"handed_over"},P)[0]==409, "point order cannot go to taxi")
    c,r=api("PATCH",f"/porter/orders/{po['id']}/status",{"status":"at_point"},P); ok(c==200 and r["stops"][0]["items"][0]["seller_handed"], "porter at point, seller_handed visible")
    c,r=api("POST",f"/orders/{po['order_number']}/received"); ok(c==200 and r["status"]=="delivered","customer received at point")
    so_list=api("GET","/seller/orders",headers=S2)[1]
    mine=[x for x in so_list if x["id"]==o["id"]][0]
    ok(any(x["id"]==po["id"] for x in api("GET","/admin/orders",headers=A)[1]), "admin orders list ok")
    ok(len(api("GET","/stores/promos/active")[1])>=4, "public promos list")
