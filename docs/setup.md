# Bolo Studio — Setup & daily use

Everything runs on this computer. Credentials go in the repo-root **`.env`** (never in a chat).
**Studio → Connections** shows what's connected and what's still missing, with the fix for each.

---

## 1. Start it

Needs Node 20.12+ and Switch Console running its local server.

```bash
npm install
npx playwright install chromium     # image renderer (once per machine)
npm run studio                      # web app :3000 + Publisher :4100 — Ctrl+C stops both
```

Open **http://localhost:3000/dashboard**. The first visit creates the **admin account** — add your
Telegram username (e.g. `@pathankamran_03`) so you can approve from the dashboard when you're an approver.

---

## 2. Credentials checklist

| # | What | Where to get it | Put it in `.env` | Verify |
|---|---|---|---|---|
| 1 | **Switch agent** (Publisher) | `npm run switch:register -- --local` — run it yourself | written automatically | Connections → Switch: *Connected* |
| 2 | **Telegram bot token** — previews (image/video) in the approval group | The token BotFather gave you (same one Switch uses) | `TELEGRAM_BOT_TOKEN=` | Connections → Telegram previews: *Ready* |
| 3 | **Google Drive** — references + archive | Google Cloud OAuth client (steps below) | `GOOGLE_CLIENT_ID=` `GOOGLE_CLIENT_SECRET=` | Connections → *Connect Google Drive* |
| 4 | **Sarvam AI** — reel/story voiceover | dashboard.sarvam.ai → API keys | `SARVAM_API_KEY=` | Generate a reel with voiceover on |
| 5 | **Postiz** — publishing | `bash infra/postiz/setup.sh` (steps below) | `POSTIZ_API_KEY=` | Connections → Postiz: *Connected* |

`.env` changes are picked up without restarting (except the Publisher's Switch login — restart `npm run studio` after `switch:register`).

### Google Drive (≈10 min)
1. https://console.cloud.google.com → create a project (e.g. "Bolo Studio").
2. **APIs & Services → Library** → enable **Google Drive API**.
3. **OAuth consent screen** → External → app name "Bolo Studio" → add your Gmail
   (`kamranpathan0307@gmail.com`) under **Test users** → save.
4. **Credentials → Create credentials → OAuth client ID** → *Web application* →
   Authorized redirect URI: `http://localhost:3000/api/drive/callback` → Create.
5. Copy the Client ID and Client secret into `.env` (`GOOGLE_DRIVE_ACCOUNT` pre-selects your Gmail).
6. Studio → **Connections → Connect Google Drive** → sign in → allow.
   Bolo creates `My Drive / Bolo Studio / <Client> / References` and `/ Published`.

Drop logos, site photos, renders and clips into **References** — they appear in Create and in the editor
(*From Drive*). Approved media is copied to **Published/<date> <title>** automatically.

### Postiz (real publishing)
1. **Instagram** → switch the account to Professional (Business) and link it to a **Facebook Page**.
2. **Meta app**: developers.facebook.com → Create app (Business) → note App ID + secret.
3. **LinkedIn app**: linkedin.com/developers → Sign In with LinkedIn (OpenID) + Share on LinkedIn → Client ID + secret.
4. **Public HTTPS URL** for Postiz (Meta needs it): free **ngrok** static domain → `ngrok http --url=<domain> 4007`.
5. `bash infra/postiz/setup.sh` → put the app keys + your URL in `infra/postiz/upstream/docker-compose.yaml` → `docker compose up -d`.
6. Postiz UI → connect Instagram / Facebook / LinkedIn → **Settings → Public API** → key into `POSTIZ_API_KEY`.
7. Connections → Postiz lists your Postiz channels with ids → copy each id into
   `brand-kits/<client>/client.json` → `channels[].postizIntegrationId`.

Until then everything runs in **dry-run**: approvals are real, posts are marked scheduled, nothing is published.
First real publish of each kind (story, carousel, reel, YouTube): check it in Postiz — provider settings are set
from Postiz's public API docs.

---

## 3. Switch rooms and agents

Already done: local server, Mattermost, Telegram bot, group **Pushpam × 7P Approvals**, Publisher in it.

1. **Work room** — Switch Console → Your Rooms → Create room → Mattermost → `pushpam-work`.
   In that channel type `!invite-agent bolo-publisher` (no `@`, press Esc if autocomplete pops up).
2. **Agent workspaces** — `npm run agents:setup` (already run; re-run after changing `agents/team.json`).
3. **Create the content agents** — Switch Console → Your Agents → **+**, twice:

   | | bolo-writer | bolo-designer |
   |---|---|---|
   | Agent instructions | `Follow CLAUDE.md in your directory.` | same |
   | Run location | This computer | This computer |
   | Directory | `<repo>\agents\workspace\bolo-writer` | `<repo>\agents\workspace\bolo-designer` |
   | Provider | Claude Code | Claude Code |
   | Who can talk to your agent | include agents | include agents |

4. In #pushpam-work: `!invite-agent bolo-writer` and `!invite-agent bolo-designer`.

Other clients: create their rooms with the names in `brand-kits/<client>/client.json` (`rooms.work`,
`rooms.approvals`) and invite the same three agents.

---

## 4. Daily use

1. **Create** (top right) → pick **Post · Carousel · Story · Reel** → speak the idea with **Wispr Flow**
   (click the box, hold your Wispr shortcut) → platforms + time → references from Drive or your computer.
2. **Who writes it?**
   - *AI agents* — `bolo-writer` gets the idea in #pushpam-work, writes the brief, captions, slides or
     scene script; `bolo-designer` renders the media and sends it for approval. Watch it fill in.
   - *I'll write it* — the editor opens: captions (one per language), slides for carousels, scenes for
     reels/stories (on-screen line + voice line), then **Generate** the image/slides/video.
3. **Check & send to client** — Brand Guard fixes small things (RERA no., "onwards", hashtags) and blocks real
   problems. When it passes, the client's Telegram group gets the **actual image/slides/video** and the
   approval message with a ref like `#p3f9a2`.
4. The client replies **`approve #p3f9a2`** or **`change #p3f9a2: make the price bigger`** (they can dictate with
   Wispr too). Approve → scheduled in Postiz, "Scheduled ✅" in the group, media archived to Drive.
   Change → back to the writer agent in the work room.
5. Postiz publishes at the time → "Live 🎉" with the link.

**Formats**

| Format | Size | Goes to | How the media is made |
|---|---|---|---|
| Post | 1080 × 1350 | Instagram, Facebook, LinkedIn | Generate image / upload |
| Carousel | 1080 × 1350 × up to 10 | Instagram, Facebook, LinkedIn | Generate slides / upload |
| Story | 1080 × 1920 | Instagram, Facebook | Story image, or Story video from scenes |
| Reel | 1080 × 1920 MP4 | Instagram, Facebook, YouTube | Generate reel (scenes + Sarvam voice) / upload |

---

## 5. Commands

```bash
npm run studio                       # everything (web + Publisher)
npm test                             # unit tests
npm run typecheck && npm run lint && npm run build
npm run switch:register -- --local   # once per Switch server
npm run agents:setup                 # agent workspaces
npm run bolo -- help                 # the agents' CLI (show, brief, captions, slides, reel-script, image, reel, check, submit)
npm run data:reset                   # demo posts for the current week (keeps accounts)
```

## 6. Troubleshooting

| Symptom | Fix |
|---|---|
| Publisher not in a room | Type `!invite-agent bolo-publisher` in that room (Switch only lets admins add agents) |
| No image in Telegram, text only | `TELEGRAM_BOT_TOKEN` missing, or the post has no media — the post's Activity says which |
| "Renderer unavailable" | `npx playwright install chromium` |
| Reel has no voice | `SARVAM_API_KEY` missing, or the voiceover box was unticked |
| Brand Guard: "image doesn't match the text" | Text changed after rendering — click Generate again |
| Port 3000/4100 in use (Windows) | A previous run is still alive: close it, or end the `node` processes running `next` / `tsx` |
| Switch port changed after restarting Switch Console | Nothing to do — the Publisher reads the local server's port automatically |

Publisher diagnostics (this computer only): http://localhost:4100/debug/switch
