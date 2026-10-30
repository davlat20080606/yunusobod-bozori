"""Delivery bonuses from several stalls: taxi first, then the aravachi, the rest is a discount (the bazaar's table)."""


def test_bonus_cascade(api, ok, admin, sellers, relaxed_limits):
    api("PUT","/admin/settings",{"porter_fee":12500,"taxi_fee":18000},admin)
    H = sellers
    items=[]; sub={}
    for i,h in enumerate(H):
        for pr in api("GET","/seller/promos",headers=h)[1]: api("DELETE",f"/seller/promos/{pr['id']}",headers=h)
        prods=[p for p in api("GET","/seller/my-store",headers=h)[1]["products"] if p["is_available"]]
        p=prods[0]; q=int(450000//p["price"])+1+i*3  # store 1 smallest... sizes differ
        items.append({"product_id":p["id"],"store_id":p["store_id"],"quantity":q}); sub[p["store_id"]]=p["price"]*q
        ok(api("POST","/seller/promos",{"kind":"delivery","min_amount":450000,"amount":18000},h)[0]==200, f"store {p['store_id']} delivery bonus 18000")
    gift_prod=[p for p in api("GET","/seller/my-store",headers=H[1])[1]["products"] if p["is_available"]][-1]
    ok(api("POST","/seller/promos",{"kind":"gift","min_amount":450000,"gift_product_id":gift_prod["id"],"gift_qty":1},H[1])[0]==200, "gift product promo")
    ok(api("POST","/seller/promos",{"kind":"delivery","min_amount":1000},H[0])[0]==400, "delivery without amount rejected")
    order=sorted(sub, key=lambda s:-sub[s]); print("by size:", [(s, sub[s]) for s in order])
    q=api("POST","/orders/quote",{"fulfillment":"courier","items":items})[1]
    rows=[(b["store_id"],b["kind"],b["amount"]) for b in q["bonuses"] if b["kind"]!="gift"]; print(rows)
    ok((order[0],"covers_taxi",18000) in rows, "1st (biggest) stall pays taxi 18000")
    ok((order[1],"covers_porter",12500) in rows and (order[1],"delivery_discount",5500) in rows, "2nd pays porter 12500 + 5500 discount")
    ok((order[2],"delivery_discount",18000) in rows, "3rd -> 18000 discount")
    ok(q["delivery_fee"]==0 and q["discount"]==23500 and q["total"]==q["subtotal"]-23500, f"fees 0, discount 23500, total {q['total']}")
    qs=api("POST","/orders/quote",{"fulfillment":"self","items":items})[1]
    ok(qs["delivery_fee"]==0 and qs["discount"]==54000 and all(b["kind"] in ("delivery_discount","gift") for b in qs["bonuses"]), "self pickup: each bonus -18000 discount (54000)")
    qp=api("POST","/orders/quote",{"fulfillment":"point","items":items})[1]
    ok(qp["delivery_fee"]==0 and qp["discount"]==18000*3-12500, f"point: porter covered, rest discount {qp['discount']}")
    ok(any(b["kind"]=="gift" for b in q["bonuses"]), "gift row in quote")
    c,o=api("POST","/orders",{"customer_name":"Test","customer_phone":"+998901234567","delivery_time_slot":"Morning (09:00-11:00)","payment_method":"cash","fulfillment":"courier","handoff_point":"main_gate","delivery_address":"Yunusobod 4","delivery_lat":41.36,"delivery_lng":69.29,"items":items})
    gift_lines=[i for i in o.get("items",[]) if i["price"]==0]
    ok(c==200 and len(gift_lines)==1 and gift_lines[0]["product_name"].startswith("🎁"), "gift added as 0 so'm item")
    ok(o["total_amount"]==q["total"] and o["delivery_fee"]==0 and o["discount_amount"]==23500, "order saved with cascade")
    mine=[x for x in api("GET","/seller/orders",headers=H[1])[1] if x["id"]==o["id"]][0]
    ok(sum(b["amount"] for b in mine["bonuses"])==18000, "each stall gives exactly its 18000")
    small=[items[0] | {"quantity":1}]
    qh=api("POST","/orders/quote",{"fulfillment":"courier","items":small})[1]
    ok(any(h["kind"]=="delivery" for h in qh["hints"]) and qh["delivery_fee"]==30500, f"small order: full fees 30500 + hint")
