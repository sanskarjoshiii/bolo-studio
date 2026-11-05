# Bolo Studio — Project Status

**Last updated:** Thu 5 Nov 2026 (Day 2 of 4) · **Submission:** Sat 7 Nov, 11:59 PM IST
**Branch:** `main` — all work is **uncommitted**.
**Setup and daily use:** [docs/setup.md](docs/setup.md)

---

## 1. Where it stands

The product is complete end to end in code. What's left is **credentials and creating two agents in
Switch Console**. Each missing piece shows on **Studio → Connections** with its fix.

| Area | State |
|---|---|
| Create any content — Post · Carousel · Story · Reel (composer page) | ✅ Built, e2e-tested in a real browser |
| Editor — captions per language, carousel slides, reel/story scenes, live phone preview | ✅ |
| Media — brand-template PNGs (post / story / each slide), reel & story MP4 (Remotion), uploads | ✅ Verified renders |
| Brand Guard — auto-fixes before rendering, blocks real problems, stale-media check | ✅ |
| Telegram approval — package via Switch + **actual media** via Bot API, `approve #ref` / `change #ref:` | ✅ Text + approval verified live · media needs `TELEGRAM_BOT_TOKEN` |
| Publishing — Postiz (Instagram post/story, Facebook, LinkedIn carousel, YouTube) | 🟡 Built + unit-tested · needs Postiz running and keys |
| Google Drive — references in Create/editor, archive of approved media | 🟡 Built + unit-tested · needs OAuth client + Connect |
| Voiceover — Sarvam, per scene, synced subtitles | 🟡 Built · needs `SARVAM_API_KEY` (silent reels verified) |
| Content agents — `bolo-writer`, `bolo-designer` (Claude Code in Switch) + `bolo` CLI | 🟡 CLI + workspaces ready · agents to be created in Switch Console |
| Login, roles, team, approver-only approvals | ✅ |
| Switch Publisher agent (WebSocket, rooms, identity from Telegram bridge) | ✅ Verified live |
| Wispr Flow | ✅ No setup — dictation into Create, editor, Mattermost, Telegram |
| One-command start | ✅ `npm run studio` |

---

## 2. Verified on 4–5 Nov

- **Tests:** 37 unit tests pass (core 35 + publisher 2). Type checks pass on every package, lint is clean, and the production build passes.
- **Real-browser end to end** (throwaway data, 10/10 pass, no console errors):
  - first-run setup
  - **Carousel:** Create → editor → 3 slides → 3 PNGs → Brand Guard → approve → scheduled
  - **Story:** text on the creative → 1080×1920 image → Brand Guard passes
  - **Reel:** 2 scenes → MP4 plays in the preview
  - **Connections** page renders
- **Live with your Switch + Telegram:**
  - the Publisher posts the approval package in *Pushpam × 7P Approvals*
  - your `approve #ref` → **Scheduled ✅**
  - a non-approver is refused
  - the group's chat ID is learned automatically
- **Not run live yet** (need your credentials): Telegram media upload, Postiz publish, Drive, Sarvam voice. Each has unit tests with a mocked API.

---

## 3. What you do now

1. **Drive** — Google Cloud OAuth client (setup guide §2) → `GOOGLE_CLIENT_ID/SECRET` → Connections → Connect.
2. **Telegram previews** — `TELEGRAM_BOT_TOKEN` (the same BotFather token Switch uses).
3. **Voice** — `SARVAM_API_KEY`.
4. **Switch** — create `pushpam-work`, `!invite-agent bolo-publisher` there; create `bolo-writer` and
   `bolo-designer` (setup guide §3) and invite them.
5. **Postiz** — Meta + LinkedIn apps, ngrok, `infra/postiz/setup.sh`, `POSTIZ_API_KEY`, channel ids into `client.json`.
6. Tell me after each one — I'll verify it live (Connections page + one real post).

---

## 4. Known limits

| Limit | Note |
|---|---|
| Postiz provider settings (`post_type: "story"`, YouTube fields) | From Postiz's docs; confirm on the first real publish of each kind |
| Postiz "published" webhook payload | Postiz doesn't document it; the endpoint accepts the common field names, and "Mark live" covers dry runs |
| Telegram bot upload limits | Photos 10 MB, videos 50 MB — larger files are reported, share via Drive |
| One caption per platform | The first caption is used (LinkedIn trimmed to 3 hashtags); per-platform captions not yet separate |
| Approver reminder after 4 h, cadence | Settings are stored; nothing acts on them yet |
| Single-machine store | JSON files in `data/` — right for one agency machine |
| Remotion licence | Free for individuals and companies ≤ 3 people; larger companies need a licence for client work |
| Mobile layout of the studio | Not checked |

---

## 5. Architecture (short)

```
apps/web            Next.js — landing, login, studio (create, editor, calendar, approvals,
                    brand kit, agents, connections, team), API routes, /render (template)
packages/core       Brand Kits, Brand Guard, workflow, store, accounts, media,
                    Switch / Telegram / Postiz / Google Drive clients
packages/reels      Remotion reel/story video + Sarvam voiceover
packages/cli        `bolo` — what the Claude Code agents run
services/publisher  Switch agent: approvals rooms ↔ workflow, Postiz webhook
brand-kits/ agents/ switch/ infra/postiz/ docs/ scripts/studio.mjs
```
