# Bolo Studio — Project Status

## 6 Nov — what changed

- **Companies and teams:** anyone can sign up (`/signup`), then create a company or accept an invite. Users see only their own companies; platform admins see all. Team → Add member takes an existing account's email or username and sends an invite, which shows up in that person's notifications (bell + `/notifications`).
- **Telegram is Switch-first:** Switch Console bridges each client's Telegram group into the company's approvals room; the Publisher agent posts the package (Bolo sends the image/video through the same bot) and turns `approve #ref` / `change #ref: …` / `reject #ref` into actions. Approvers can be Telegram usernames with no Bolo account (Team → Telegram approvers), or anyone in the group. Admins set each company's room names on the Platform page.
- **Approvals:** setting approvers is optional. With none set, the owner approves. Approve / Request changes / Reject all work in the studio, and on Telegram via buttons.
- **Sections:** Calendar shows published posts only. **Drafts** holds approved posts waiting to go out (with Post now). Approvals holds everything generated but not approved.
- **Every post, carousel, story and reel:** 10 size presets plus Custom (width × height), and 6 language plans (Marathi + English, Hindi + English, Hindi + Marathi, Marathi, Hindi, English).
- **Generation:** runs in the background with a progress dock that follows you across sections. Click it to open the editor; Cancel stops it. A notification arrives when it's done.
- **Connections (client):** Telegram (one-click group link), Instagram & Facebook and LinkedIn (log in, then Bolo posts directly at the scheduled time), Google Drive (per company), Sarvam AI key, AI agent (Claude or OpenAI key). Each has plain-language steps. Keys are tested, then stored encrypted.
- **Platform (admin only):** Switch, Postiz, Wispr Flow and the agents moved here, with a checklist of the platform keys.
- **Brand Kit editing** in the studio: company details, colours, fonts, rules, posting times, and every file.
- **Designs:** layouts adapt to any size and use the AI's highlight word and CTA, with contrast checks and brand fonts loaded properly.
- **Fixed:** the reel error "window.getStaticCompositions is not defined". Remotion's server was landing on the studio's port 3000; it now always picks a free port.
- **Speed:** cached store and parsing, a loading screen plus top progress bar between sections, Lenis smooth scrolling, and Turbopack for `npm run dev`.
- **Deploy:** one AWS EC2 server + MongoDB Atlas (Mumbai), see [docs/deploy-aws.md](docs/deploy-aws.md).
- **Google Drive:** `drive.file` only — every generated design is saved to `Bolo Studio / <Company> / Designs`, approved posts to `Published`. The Drive picker is gone; photos are uploaded from the computer.
- **Onboarding:** after creating a company, step 2 connects Telegram (a group, or "just me") — or skip.

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
| **Claude writes it** — idea → Claude (Brand Kit) → media → Brand Guard → Telegram, automatically | ✅ Verified live: post 31 s, carousel 42 s (7 slides), Marathi reel with Sarvam voice |
| Editor — captions per language, carousel slides, reel/story scenes, live phone preview | ✅ |
| Media — 6 designed layouts (hero, split, editorial, offer, bold, festive) from tokens.json with reference photos placed in; carousel cover / numbered inner slides / CTA slide; Claude picks the layout | ✅ Verified renders |
| Reels — kinetic word-by-word text, swipe transitions, moving backgrounds, Ken Burns on photos, count-up price badge, karaoke subtitles, animated end card, optional `brand-kits/<client>/music.mp3` | ✅ Verified (31 s Marathi reel with Sarvam voice) |
| Brand Guard — auto-fixes before rendering, blocks real problems, stale-media check | ✅ |
| Telegram approval — package via Switch + **actual media** via Bot API, `approve #ref` / `change #ref:` | ✅ Text + approval verified live · bot token set, media upload to be confirmed on the first real post |
| Publishing — Postiz (Instagram post/story, Facebook, LinkedIn carousel, YouTube) | 🟡 Built + unit-tested · needs Postiz running and keys |
| Google Drive — references in Create/editor, archive of approved media | 🟡 Built + unit-tested · needs OAuth client + Connect |
| Voiceover — Sarvam, per scene, synced subtitles | ✅ Verified live (32 s Marathi reel, voice + subtitles) |
| Content agents — `bolo-writer`, `bolo-designer` (Claude Code in Switch) + `bolo` CLI | 🟡 CLI + workspaces ready · agents to be created in Switch Console |
| Login, roles, team, approver-only approvals | ✅ |
| Switch Publisher agent (WebSocket, rooms, identity from Telegram bridge) | ✅ Verified live |
| Wispr Flow | ✅ No setup — dictation into Create, editor, Mattermost, Telegram |
| One-command start | ✅ `npm run studio` |

---

## 2. Verified on 4–5 Nov

- **Tests:** 41 unit tests pass (core 39 + publisher 2). Type checks pass on every package, lint is clean, and the production build passes.
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
- **Claude pipeline, live on throwaway data (5 Nov):** Create → "Claude writes it now" → live progress in the
  editor → image rendered → Brand Guard 7/7 → sent for approval; carousel with auto-send off → 7 slides
  rendered, left as a draft; Marathi reel → 32 s MP4 with Sarvam voice and Devanagari subtitles.
- **Not run live yet:** Telegram media upload, Postiz publish, Drive. Each has unit tests with a mocked API.

---

## 3. What you do now

1. **Drive** — keys are in `.env`; click Connections → **Connect Google Drive** (redirect URI
   `http://localhost:3000/api/drive/callback` must be in the OAuth client).
2. **First real post** — Create → *Claude writes it now* → watch the Telegram group for the image + approval message.
3. **Switch** — create `pushpam-work`, `!invite-agent bolo-publisher` there; create `bolo-writer` and
   `bolo-designer` (setup guide §3) and invite them.
4. **Postiz** — Meta + LinkedIn apps, ngrok, `infra/postiz/setup.sh`, `POSTIZ_API_KEY`, channel ids into `client.json`.
5. Tell me after each one — I'll verify it live (Connections page + one real post).

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
