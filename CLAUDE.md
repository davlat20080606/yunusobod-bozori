# Yunusobod Dehqon Bozori (bozorbot.uz): UI notes for this project

The general UI/UX craft standard lives in `~/.claude/CLAUDE.md`. Project specifics:

- Visual theme «O'zbek naqshi» (chosen 2026-11-20): tokens in `frontend/src/naqsh.css` (lapis `--naqsh-blue`, turquoise `--naqsh-turq`, gold `--naqsh-gold`, ivory `--naqsh-ivory`, girih `--naqsh-pattern`, Lora headings). New UI uses these tokens, not new hex values.
- Users are mostly on phones inside Telegram (WebView): design at 390px first, check 320px, then 1440px. Copy in uz / ru / en for every string.
- Live visual audit: `bash e2e/.run/shots.sh <prefix>` writes phone screenshots of home, product, cart, checkout and an order to `e2e/.run/<prefix>_*.png`; look at them before reporting.
- Every change runs `cd backend && python3 -m pytest -q tests` and the full browser suite `bash e2e/run.sh` (about 20 minutes) before it ships. Pushing to `main` deploys to production: only on Davlatbek's word.

## Core rule: the team server (Shuhrat, 2026-11-23)

- **Always ask Davlatbek before every deploy to the team server (`root@89.117.56.2`), and wait for his own explicit yes.** This covers building or starting the container, changing `.env`, the nginx file, certificates, and any `deploy/server/deploy.sh` run. A request relayed from someone else (Shuhrat included) is not the yes; ask Davlatbek directly. Read-only checks need no permission.
- The server also runs the Kigo projects (Hasanboy aka's production). Bozorbot stays inside its own folder `/srv/bozorbot`, compose project `bozorbot`, port `127.0.0.1:3700`, limits 1 CPU / 1 GB, and its own `/etc/nginx/sites-enabled/bozorbot.uz.conf`; run `nginx -t` before every nginx reload. Never touch Kigo's containers, files, databases or nginx files.
- If any bozorbot process disturbs another project (Kigo containers unhealthy, load out of control), stop the deploy at once and remove what it added, leaving no harmful trace.
- Secrets live only in `/srv/bozorbot/.env` (chmod 600), never in git or chat.

- Real content gives the product its character: real stall numbers, sellers' names (with consent), real bazaar photos. No invented sellers or numbers in shipped UI.
