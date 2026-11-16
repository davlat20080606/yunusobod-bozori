"""Most suites test other screens: mark the platform rules as accepted in this fresh Chrome first.
The «DIQQAT!» window itself is tested in terms_ui.py (run with RULES_FRESH=1)."""
import asyncio, json, re, urllib.request, websockets
from pathlib import Path

B = "http://127.0.0.1:8099"
VERSION = re.search(r"TERMS_VERSION = '([^']+)'", (Path(__file__).resolve().parents[1] / "frontend/src/services/terms.js").read_text()).group(1)


async def main():
    t = [x for x in json.loads(urllib.request.urlopen("http://127.0.0.1:9333/json").read()) if x["type"] == "page"][0]
    async with websockets.connect(t["webSocketDebuggerUrl"], max_size=None, ping_interval=None) as ws:
        n = [0]

        async def cmd(m, p={}):
            n[0] += 1; i = n[0]; await ws.send(json.dumps({"id": i, "method": m, "params": p}))
            while True:
                r = json.loads(await ws.recv())
                if r.get("id") == i: return r
        await cmd("Page.enable")
        await cmd("Page.navigate", {"url": f"{B}/robots.txt"}); await asyncio.sleep(1)
        await cmd("Runtime.evaluate", {"expression": f"localStorage.setItem('terms_accepted', '{VERSION}')"})
        await cmd("Page.navigate", {"url": "about:blank"}); await asyncio.sleep(0.5)

asyncio.run(main())
