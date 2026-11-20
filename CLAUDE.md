# Yunusobod Dehqon Bozori (bozorbot.uz): UI notes for this project

The general UI/UX craft standard lives in `~/.claude/CLAUDE.md`. Project specifics:

- Visual theme «O'zbek naqshi» (chosen 2026-11-20): tokens in `frontend/src/naqsh.css` (lapis `--naqsh-blue`, turquoise `--naqsh-turq`, gold `--naqsh-gold`, ivory `--naqsh-ivory`, girih `--naqsh-pattern`, Lora headings). New UI uses these tokens, not new hex values.
- Users are mostly on phones inside Telegram (WebView): design at 390px first, check 320px, then 1440px. Copy in uz / ru / en for every string.
- Live visual audit: `bash e2e/.run/shots.sh <prefix>` writes phone screenshots of home, product, cart, checkout and an order to `e2e/.run/<prefix>_*.png`; look at them before reporting.
- Every change runs `cd backend && python3 -m pytest -q tests` and the full browser suite `bash e2e/run.sh` (about 20 minutes) before it ships. Pushing to `main` deploys to production: only on Davlatbek's word.
- Real content gives the product its character: real stall numbers, sellers' names (with consent), real bazaar photos. No invented sellers or numbers in shipped UI.
