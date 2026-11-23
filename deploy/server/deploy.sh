#!/bin/sh
# Ship the committed code to the team server and restart only the bozorbot container.
# Run from the repo root on the Mac:  sh deploy/server/deploy.sh
set -eu
HOST=root@89.117.56.2
KEY="$HOME/.ssh/bozorbot_server_ed25519"
SSH="ssh -i $KEY -o IdentitiesOnly=yes"
git diff --quiet HEAD || { echo "Commit first: only committed code goes to the server"; exit 1; }
rm -rf /tmp/bozorbot-ship && git worktree add -f /tmp/bozorbot-ship HEAD >/dev/null
rsync -az --delete -e "$SSH" --exclude .git --exclude node_modules --exclude 'e2e/.run' --exclude 'backend/tests/.run' \
  /tmp/bozorbot-ship/ "$HOST:/srv/bozorbot/src/"
git worktree remove --force /tmp/bozorbot-ship
rsync -az -e "$SSH" deploy/server/docker-compose.yml "$HOST:/srv/bozorbot/docker-compose.yml"
# nice: the build must not slow the Kigo projects down
$SSH "$HOST" 'cd /srv/bozorbot && nice -n 15 docker compose build --pull && docker compose up -d && docker image prune -f --filter label=com.docker.compose.project=bozorbot >/dev/null; sleep 8; curl -fsS http://127.0.0.1:3700/api/health'
