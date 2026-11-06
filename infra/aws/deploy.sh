#!/usr/bin/env bash
# Deploy (or update) Bolo Studio on an Ubuntu EC2 server. Run it on the server, from the repo:
#   bash infra/aws/deploy.sh
# First run: installs Docker, asks for your domain, creates .env from .env.example if missing.
# Every later run: pulls the latest code, rebuilds and restarts — data is kept.
set -euo pipefail
cd "$(dirname "$0")/../.."

if ! command -v docker >/dev/null 2>&1; then
  echo "→ Installing Docker…"
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker "$USER" || true
fi
DOCKER="docker"
docker info >/dev/null 2>&1 || DOCKER="sudo docker"

if [ ! -f infra/aws/.env ]; then
  read -rp "Domain for the studio (e.g. studio.yourcompany.com): " DOMAIN
  echo "DOMAIN=$DOMAIN" > infra/aws/.env
fi
set -a; . infra/aws/.env; set +a

if [ ! -f .env ]; then
  echo "MongoDB Atlas connection string (Atlas → your cluster → Connect → Drivers), e.g."
  echo "  mongodb+srv://bolo:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority"
  read -rp "MONGODB_URI (Enter to skip and keep data in files on this server): " MONGODB_URI
  cp .env.example .env
  if [ -n "$MONGODB_URI" ]; then
    # swap the empty line from .env.example — no sed: passwords can contain & / | \
    grep -v '^MONGODB_URI=' .env > .env.tmp
    printf 'MONGODB_URI=%s\n' "$MONGODB_URI" >> .env.tmp
    mv .env.tmp .env
  fi
  # Production defaults: the public address, and secrets generated once on this server
  sed -i "s#^BOLO_WEB_URL=.*#BOLO_WEB_URL=https://$DOMAIN#" .env
  {
    echo "BOLO_PUBLIC_URL=https://$DOMAIN"
    echo "AUTH_SECRET=$(openssl rand -hex 32)"
    echo "BOLO_ENCRYPTION_KEY=$(openssl rand -hex 32)"
    # No Claude Code login on the server — every company uses its own AI key
    echo "BOLO_LOCAL_CLAUDE=off"
  } >> .env
  echo "→ Created .env — add the platform keys (Telegram bot, Meta, LinkedIn, Google) now or later, then run this script again."
fi

if [ -d .git ]; then git pull --ff-only || echo "(git pull skipped)"; fi

PROFILES=""
grep -q '^SWITCH_AGENT_ID=.\+' .env && PROFILES="--profile switch"

echo "→ Building and starting…"
$DOCKER compose -f infra/aws/docker-compose.yml --env-file infra/aws/.env $PROFILES up -d --build
$DOCKER image prune -f >/dev/null
echo "✓ Bolo Studio is running at https://$DOMAIN (first HTTPS certificate takes ~30 s)."
