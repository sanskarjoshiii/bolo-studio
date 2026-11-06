# Bolo Studio — one image for the web app (and, optionally, the Switch Publisher).
# Based on Playwright's image: Chromium and every library it needs are already in it, so image
# rendering (Playwright) and reel rendering (Remotion) both work inside the container.
FROM mcr.microsoft.com/playwright:v1.48.2-noble

# Devanagari + emoji fonts so Marathi/Hindi text renders correctly in images and reels
RUN apt-get update \
 && apt-get install -y --no-install-recommends fonts-noto-core fonts-noto-color-emoji \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies first (cached between deploys when only code changes)
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/core/package.json packages/core/
COPY packages/cli/package.json packages/cli/
COPY packages/reels/package.json packages/reels/
COPY services/publisher/package.json services/publisher/
RUN npm ci --no-audit --no-fund

COPY . .

# Remotion's headless Chrome, downloaded now instead of on the first reel
RUN node --input-type=module -e "import('@remotion/renderer').then((r) => r.ensureBrowser())"

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    BOLO_DATA_DIR=/data \
    BOLO_INTERNAL_URL=http://127.0.0.1:3000
RUN npm run build

EXPOSE 3000
CMD ["npm", "run", "start", "-w", "@bolo/web"]
