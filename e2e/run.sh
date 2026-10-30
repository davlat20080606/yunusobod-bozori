#!/bin/bash
# Browser tests: the real site in headless Chrome, as a phone inside Telegram (Telegram itself is faked).
# Every suite gets a fresh demo database. Needs Google Chrome; run from anywhere:  bash e2e/run.sh
# Screenshots and logs go to e2e/.run/
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; BE="$ROOT/backend"; S="$ROOT/e2e/.run"; PY="${PYTHON:-python3}"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
FAKE_TOKEN=123456:TESTtokenTESTtokenTESTtokenTESTtok
mkdir -p "$S"
(cd "$ROOT/frontend" && npm run build > "$S/build.log" 2>&1) || { echo "frontend build failed, see $S/build.log"; exit 1; }

stop() { pkill -f "uvicorn .*--port 8099"; pkill -f "remote-debugging-port=9333"; sleep 1; }
server() { # $1 suite name: fresh database, real app with a fake bot
  rm -f "$S/$1.db" "$S/sent.log"; touch "$S/sent.log"
  (cd "$BE" && PYTHONPATH=".:tests" SENT_LOG="$S/sent.log" BOT_MODE=webhook TELEGRAM_BOT_TOKEN=$FAKE_TOKEN \
    DATABASE_URL="sqlite+aiosqlite:///$S/$1.db" ADMIN_PIN=909090 nohup "$PY" -m uvicorn fake_bot_app:app --port 8099 > "$S/$1.log" 2>&1 &)
  for _ in $(seq 60); do curl -sf http://127.0.0.1:8099/api/health > /dev/null && { relax_limits; return; }; sleep 0.5; done
  echo "server did not start, see $S/$1.log"; exit 1
}
relax_limits() { # the journeys place many orders from one test phone; the limits have their own API tests
  local token; token=$(curl -s -X POST http://127.0.0.1:8099/api/admin/login -H 'Content-Type: application/json' -d '{"pin":"909090"}' | sed 's/.*"token":"\([^"]*\)".*/\1/')
  curl -s -o /dev/null -X PUT http://127.0.0.1:8099/api/admin/settings -H 'Content-Type: application/json' -H "x-admin-token: $token" \
    -d '{"max_open_orders":20,"new_customer_max_open":20,"new_customer_max_total":100000000,"orders_per_10_min":1000}'
}
chrome() { rm -rf "$S/chrome"; "$CHROME" --headless=new --remote-debugging-port=9333 --user-data-dir="$S/chrome" --no-first-run about:blank > /dev/null 2>&1 & sleep 3; }
report() { # $1 name, $2 output with PASS/FAIL lines
  p=$(grep -c "^PASS" "$2"); f=$(grep -c "^FAIL" "$2")
  printf "%-42s %3d / %-3d %s\n" "$1" "$p" "$((p+f))" "$( [ "$f" -eq 0 ] && [ "$p" -gt 0 ] && echo OK || echo "<-- FAIL" )"
  grep "^FAIL" "$2" | sed 's/^/      /'
  [ "$f" -eq 0 ] && [ "$p" -gt 0 ] || FAILED=1
}
FAILED=0; E="$ROOT/e2e"

stop; server journey; chrome; "$PY" "$E/journey.py" "$S" > "$S/journey.txt" 2>&1
report "Full journey, 3 ways of getting it" "$S/journey.txt"

stop; server live; chrome; "$PY" "$E/live_batching.py" "$S" > "$S/live.txt" 2>&1
report "Instant status (SSE) + batching" "$S/live.txt"

stop; server team; chrome; "$PY" "$E/stall_team_ui.py" "$S" > "$S/team.raw" 2>&1
sed 's/^cabinet opened without PIN: True/PASS cabinet opens without PIN/; s/^cabinet opened without PIN: False/FAIL cabinet opens without PIN/; s/^QR shown: True/PASS QR code shown/; s/^QR shown: False/FAIL QR code shown/' "$S/team.raw" > "$S/team.txt"
report "Stall team screen" "$S/team.txt"

stop; server geo; chrome; "$PY" "$E/location.py" "$S" > "$S/geo.raw" 2>&1
awk '/Mac Telegram\] map opened: Telegram asked for location 0/{print "PASS Mac: map opens without asking"} /Mac Telegram\] «my location» button on the map: False/{print "PASS Mac: no location button"} /iPhone.*map opened: Telegram asked for location 0/{print "PASS iPhone: map opens without asking"} /iPhone.*settings opened: 1/{print "PASS iPhone: «Allow location» opens settings"}' "$S/geo.raw" > "$S/geo.txt"
[ "$(grep -c PASS "$S/geo.txt")" -eq 4 ] || echo "FAIL location checks (see $S/geo.raw)" >> "$S/geo.txt"
report "Location on Mac and iPhone" "$S/geo.txt"

stop; server guard; chrome; "$PY" "$E/customer_guard_ui.py" "$S" > "$S/guard.txt" 2>&1
report "Blocking a customer (Bozorkom + shop)" "$S/guard.txt"

stop; server stock; chrome; "$PY" "$E/stock_ui.py" "$S" > "$S/stock.txt" 2>&1
report "Counted stock (seller + shop)" "$S/stock.txt"

"$PY" "$E/language_kept.py" > "$S/persist.raw" 2>&1
awk '/lang=ru \| Юнус/{c++} /lang=en \| Yunusobod Farmers/{e++} END{print (c==3?"PASS":"FAIL")" Russian kept after reopening ("c"/3)"; print (e==2?"PASS":"FAIL")" English kept after reopening ("e"/2)"}' "$S/persist.raw" > "$S/persist.txt"
report "Language is remembered" "$S/persist.txt"

stop; server lang; chrome; "$PY" "$E/translation_sweep.py" "$S" ru,en > "$S/lang.txt" 2>&1
echo "Translation sweep (Uzbek text left on ru/en screens, see $S/lang.txt):"; tail -1 "$S/lang.txt" | sed 's/^/   /'
stop
exit $FAILED
