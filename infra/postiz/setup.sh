#!/usr/bin/env bash
# Fetches the official Postiz docker-compose stack (Postiz + Postgres + Redis + Temporal).
# Postiz recommends pulling the file from its repo instead of copying a snapshot,
# so we keep it out of git (infra/postiz/upstream is ignored) and pull on demand.
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
dest="$here/upstream"

if [ -d "$dest/.git" ]; then
  git -C "$dest" pull --ff-only
else
  git clone --depth 1 https://github.com/gitroomhq/postiz-docker-compose.git "$dest"
fi

cat <<'MSG'

Postiz compose fetched into infra/postiz/upstream.

Next:
  1. Edit infra/postiz/upstream/docker-compose.yaml:
       - set JWT_SECRET to a long random string
       - change the default Postgres/Temporal passwords
       - fill the Meta / LinkedIn / Google app credentials you created
  2. cd infra/postiz/upstream && docker compose up -d
  3. Open http://localhost:4007, create the admin user, connect each client's channels.
  4. Settings → Public API → create a key, then put it in the repo-root .env:
       POSTIZ_API_URL=http://localhost:4007/api/public/v1
       POSTIZ_API_KEY=...
  5. npm run dev:publisher, then GET http://localhost:4100/integrations
     and copy each channel id into brand-kits/<client>/client.json → postizIntegrationId.
MSG
