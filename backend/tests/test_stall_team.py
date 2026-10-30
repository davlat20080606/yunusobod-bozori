"""Stall team by QR: the owner shows a one-time code, a helper scans it and works in the same cabinet."""
import asyncio
import hashlib
import hmac
import json
import os
import sqlite3
import time
from urllib.parse import urlencode

from conftest import BOT_TOKEN, DB_FILE, SENT_LOG


def init_data(uid, first, last=""):
    """Telegram Mini App sign-in data, signed the way Telegram does it."""
    fields = {"auth_date": str(int(time.time())), "query_id": "AA",
              "user": json.dumps({"id": uid, "first_name": first, "last_name": last}, separators=(",", ":"))}
    check = "\n".join(f"{k}={v}" for k, v in sorted(fields.items()))
    secret = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
    fields["hash"] = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    return urlencode(fields)


def test_stall_team(api, ok, admin, relaxed_limits):
    OWNER, HELPER, STRANGER = 1001, 2002, 3003
    c,r=api("POST","/seller/login",{"phone_or_slug":"+998 93 222-33-44","pin":"2222"},{"x-telegram-init-data":init_data(OWNER,"Karen","Aka")})
    ok(c==200 and r["role"]=="owner", "owner signs in once with PIN inside Telegram")
    c,r=api("POST","/seller/tg-login",None,{"x-telegram-init-data":init_data(OWNER,"Karen","Aka")}); OT={"x-seller-token":r.get("token","")}
    ok(c==200 and r["role"]=="owner", "next time the owner gets in by Telegram alone, no PIN")
    ok(api("POST","/seller/tg-login",None,{"x-telegram-init-data":init_data(HELPER,"Aziz")})[0]==404, "a stranger's Telegram is not let in")
    ok(api("POST","/seller/tg-login",None,{"x-telegram-init-data":init_data(HELPER,"Aziz").replace("hash=","hash=0")})[0]==401, "forged Telegram data is refused")
    c,inv=api("POST","/seller/invite",None,OT)
    ok(c==200 and inv["link"].startswith("https://t.me/TestBozorBot?start=join_"), f"owner gets a one-time QR link")
    token=inv["link"].split("join_")[1]
    # the helper scans the QR: Telegram sends the bot /start join_<token>
    from app.bot.bot import join_stall
    class U:
        def __init__(s, uid, first): s.id=uid; s.first_name=first; s.last_name=None; s.username=None; s.language_code="ru"
    class Msg:
        def __init__(s, uid, first): s.from_user=U(uid, first); s.text=f"/start join_{token}"; s.replies=[]
        async def answer(s, text, **kw): s.replies.append((text, kw.get("reply_markup")))
    m=Msg(HELPER,"Aziz"); asyncio.run(join_stall(m, token))
    btn=m.replies[0][1].inline_keyboard[0][0] if m.replies and m.replies[0][1] else None
    ok(m.replies and "помощником" in m.replies[0][0], f"bot answers the helper: «{m.replies[0][0][:60]}…»")
    m2=Msg(STRANGER,"Begona"); asyncio.run(join_stall(m2, token))
    ok(m2.replies and "устарел" in m2.replies[0][0], "the same QR does not work a second time")
    c,r=api("POST","/seller/tg-login",None,{"x-telegram-init-data":init_data(HELPER,"Aziz")}); HT={"x-seller-token":r.get("token","")}
    ok(c==200 and r["role"]=="helper" and r["store"]["stall_number"]=="Rasta 14, Joy №2", "helper opens the bot and is in the same stall's cabinet")
    ok(api("GET","/seller/my-store",None,HT)[0]==200 and api("GET","/seller/orders",None,HT)[0]==200, "helper sees products and orders")
    ok(api("PATCH","/seller/stores/me",{"pin":"9999"},HT)[0]==403, "helper cannot change the PIN or the stall profile")
    ok(api("POST","/seller/invite",None,HT)[0]==403, "helper cannot invite others")
    c,team=api("GET","/seller/members",None,OT)
    ok(c==200 and sorted(m["role"] for m in team["members"])==["helper","owner"], f"owner sees the team: {[m['name'] for m in team['members']]}")
    # a new order reaches both phones
    open(os.environ["SENT_LOG"],"w").close()
    api("POST","/orders",{"customer_name":"Test","customer_phone":"+998901234567","delivery_time_slot":"Morning (09:00-11:00)","payment_method":"cash","fulfillment":"self","items":[{"product_id":10,"store_id":2,"quantity":1}]})
    time.sleep(1.5)
    chats={json.loads(l)["chat"] for l in open(os.environ["SENT_LOG"]) if "Yangi buyurtma" in l}
    ok({str(OWNER),str(HELPER)} <= chats, f"new order message went to owner and helper ({sorted(chats)})")
    helper_id=[m["id"] for m in team["members"] if m["role"]=="helper"][0]
    ok(api("DELETE",f"/seller/members/{helper_id}",None,OT)[0]==200, "owner removes the helper")
    ok(api("GET","/seller/my-store",None,HT)[0]==401, "the removed helper is signed out at once")
    owner_id=[m["id"] for m in team["members"] if m["role"]=="owner"][0]
    ok(api("DELETE",f"/seller/members/{owner_id}",None,OT)[0]==409, "the owner cannot be removed")
    # expired code
    db=sqlite3.connect(DB_FILE)
    c,inv2=api("POST","/seller/invite",None,OT); t2=inv2["link"].split("join_")[1]
    db.execute("update store_invites set expires_at=datetime('now','-1 minutes') where token=?",(t2,)); db.commit()
    m3=Msg(HELPER,"Aziz"); asyncio.run(join_stall(m3, t2))
    ok(m3.replies and "устарел" in m3.replies[0][0], "a QR older than 15 minutes is refused")
