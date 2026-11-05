# 🎙️ Bolo Studio
### Speak once. Ship everywhere.

> **Flip the Switch Hackathon** — WeMakeDevs × DevTools Academy × Switch
> **Dates:** Nov 4–7, 2026 (submission closes Nov 7, 11:59 PM IST)
> **Tracks:** Track 01 (Business) + Track 02 (Personal) · **Side tracks:** Code with Wispr · Best Blog · #HowISwitch

### Quick start

```bash
npm install
npx playwright install chromium   # image renderer, once
npm run studio                    # studio http://localhost:3000 + Publisher :4100
npm test
```

Create a post, carousel, story or reel → Brand Guard → the client approves on Telegram (with the actual
image/video) → published via Postiz. Runs in dry-run mode until credentials are added.
Credentials, Switch agents and daily use: **[docs/setup.md](docs/setup.md)** · progress: [STATUS.md](STATUS.md).

---

## Table of Contents
1. [One-line pitch](#1-one-line-pitch)
2. [Problem](#2-problem)
3. [Solution](#3-solution)
4. [Architecture](#4-architecture)
5. [Rooms](#5-rooms)
6. [Agents](#6-agents)
7. [Brand Kit system (MD files per client)](#7-brand-kit-system-md-files-per-client)
8. [Visual agent options](#8-visual-agent-options)
9. [Reel generation](#9-reel-generation)
10. [Connecting social media accounts](#10-connecting-social-media-accounts)
11. [Telegram client approval flow](#11-telegram-client-approval-flow)
12. [Scheduling & publishing flow](#12-scheduling--publishing-flow)
13. [End-to-end example](#13-end-to-end-example)
14. [Safety & permissions](#14-safety--permissions)
15. [Wispr Flow usage](#15-wispr-flow-usage)
16. [Tech stack](#16-tech-stack)
17. [Repo structure](#17-repo-structure)
18. [4-day build plan](#18-4-day-build-plan)
19. [Demo video script](#19-demo-video-script)
20. [Judging fit](#20-judging-fit)
21. [Submission checklist](#21-submission-checklist)
22. [Future scope](#22-future-scope)

---

## 1. One-line pitch
Speak a content idea → AI agents in a Switch room write, design, make reels and brand-check it → the client approves on Telegram → it auto-schedules to Instagram, Facebook, LinkedIn and YouTube.

**Works for:**
- **Business** — a marketing agency (7P Infomedia) running content for many clients
- **Personal** — your own brand: LinkedIn, Instagram, hackathon posts, blogs

---

## 2. Problem
| Pain | Today |
|---|---|
| Ideas get lost | Founder says an idea on a call, nobody writes it down |
| Slow production | Copywriter → designer → editor → back-and-forth = 1–2 days per post |
| Brand mistakes | Wrong colours, missing RERA number, banned claims slip through |
| Approval chaos | Clients approve on WhatsApp, buried in 200 messages |
| Scheduling by hand | Someone logs into 4 platforms and posts manually |
| No language support | Most AI tools are English-only; Pune audience wants Marathi + English |

---

## 3. Solution
A team of **6 AI agents + humans** working together inside **Switch rooms**:

- **Team** talks to agents in **Mattermost** (internal, built into Switch)
- **Clients** approve in **Telegram** (the app they already use)
- **Each client** has a **Brand Kit** (MD files) every agent reads automatically
- **Postiz** (open-source scheduler) publishes to all social platforms

**Result:** idea → live post in ~15 minutes of active work instead of 1–2 days.

---

## 4. Architecture

```
  👤 Team member (speaks with Wispr Flow)
            │
            ▼
┌───────────────────────── SWITCH SERVER (Docker) ─────────────────────────┐
│                                                                          │
│   MATTERMOST (internal)                    TELEGRAM (clients)            │
│   ├── #studio-hq                           ├── "Pushpam × 7P Approvals"  │
│   ├── #pushpam-work   ◄──── linked ────►   │                             │
│   ├── #clinic-work    ◄──── linked ────►   ├── "Clinic × 7P Approvals"   │
│   └── #my-brand (personal)                 └──                           │
│                                                                          │
│   AGENTS                                                                 │
│   Strategist · Copywriter · Visual Designer · Reel Producer ·            │
│   Brand Guard · Publisher                                                │
│                                                                          │
│   PACKAGES (one Brand Kit per client)                                    │
│   brand.md · rules.md · protocol.md · products.md · tokens.json ...      │
└──────────────────────────────────────────────────────────────────────────┘
            │  (Publisher agent → REST API)
            ▼
     POSTIZ (self-hosted scheduler, Docker)
            │  (official OAuth)
            ▼
  Instagram · Facebook · LinkedIn · YouTube Shorts · X · Threads
```

### Why Switch is central
Without Switch, there is no shared room for agents from different laptops, no Telegram ↔ Mattermost bridge, no shared Brand Kit context, no roles, and no human approval in the same thread. **The product does not work without Switch.**

---

## 5. Rooms

| Room | App | Members | Purpose |
|---|---|---|---|
| `#studio-hq` | Mattermost | Whole team + all agents | Agency-wide planning, weekly calendar |
| `#<client>-work` | Mattermost | Team + agents | Production: drafts, revisions, internal discussion |
| `<Client> × 7P Approvals` | Telegram group | Client + account manager + Brand Guard + Publisher | Client sees **only final, checked** drafts and approves |
| `#my-brand` | Mattermost | You + agents | Personal content (LinkedIn, IG, blogs) |

### Switch features used
| Feature | How we use it |
|---|---|
| **Rooms** | Each channel/group becomes a room with shared history |
| **Room instructions** | Briefing every agent reads on join ("this room produces content for Pushpam") |
| **Packages** | One Brand Kit package per client, attached to that client's rooms |
| **References** | Google Drive folder with logos, site photos, renders |
| **Roles** | Strategist, Brand Guard, Publisher = single-holder; Copywriter, Visual = shared |
| **Linked rooms** | `#pushpam-work` ↔ `Pushpam Approvals` so agents know where finals go and feedback comes from |
| **Groups** | All client rooms filed under a "Clients" group |
| **Templates** | Capture `#pushpam-work` as a template → new client onboarded in one click |
| **Multi-app bridge** | Team on Mattermost, clients on Telegram, same server |
| **Agent protocol** | Publisher is a custom TypeScript agent (`services/publisher`) |
| **Owner permissions** | Only approvers named in `protocol.md` can instruct Publisher |

---

## 6. Agents

### Overview
| # | Agent | Role type | Job | Built with |
|---|---|---|---|---|
| 1 | **Strategist** | Single-holder | Voice dump → structured brief. Plans weekly calendar | Claude Code |
| 2 | **Copywriter** | Shared | Platform-wise captions, hashtags, CTA, Marathi/Hindi/English | Claude Code |
| 3 | **Visual Designer** | Shared | Static posts + carousels from `tokens.json` | Claude Code + Playwright |
| 4 | **Reel Producer** | Single-holder | Script → voice → render → subtitles → MP4 | Claude Code + Remotion/FFmpeg |
| 5 | **Brand Guard** | Single-holder | Checks every output against `rules.md` before client sees it | Codex (different model = independent review) |
| 6 | **Publisher** | Single-holder | Schedules approved posts in Postiz, posts live links back | Custom TypeScript agent (`services/publisher`) |
| + | **Analyst** *(optional)* | Single-holder | Weekly reach/engagement summary to client | Custom agent |

**Hackathon minimum (4 agents):** Strategist+Copywriter merged · Visual · Reel · Publisher (Brand Guard as a check step). Keep 6 if time allows — it shows deeper Switch use.

**Why single-holder roles matter:**
- Only **one** Publisher at a time → a post can never be scheduled twice
- If the laptop running Brand Guard closes, another agent takes the role → the room keeps working

**Machine split:** each of the 4 team members runs 1–2 agents on their own laptop → demonstrates "agents from different machines in one room".

### Agent instructions (summary)

**Strategist**
```
You turn raw ideas into briefs. For every idea:
1. Read the client's Brand Kit (protocol.md, products.md, audience.md).
2. Output a brief: goal, audience, platforms, formats, language, deadline, post time.
3. Tag @Copywriter, @Visual-Designer, @Reel-Producer with their tasks.
Every Monday, propose the week's calendar using protocol.md best times and upcoming festivals.
```

**Copywriter**
```
Write captions for each platform in the brief.
- Follow tone in brand.md and limits in rules.md.
- Give 3 options. Instagram: hook + body + CTA + max 8 hashtags. LinkedIn: professional, no hashtag spam.
- Languages as requested (Marathi / Hindi / English / mix).
```

**Visual Designer**
```
Build visuals as HTML/CSS using ONLY colours and fonts from tokens.json.
Render with Playwright at the correct size. Logo placement per brand.md.
Never let AI-generated images contain text — all text comes from HTML.
Post PNGs in the work room.
```

**Reel Producer**
```
Follow reel-style.md. Write a scene plan with timestamps (hook in first 2 sec).
Use assets from the Drive reference or stock (Pexels). Generate voiceover, render 1080x1920 MP4 under 60 sec,
burn subtitles in brand font. Compress to fit Telegram limits.
```

**Brand Guard**
```
Check every draft against rules.md, brand.md, and products.md.
Fix small issues yourself (missing "onwards", RERA no.) and list what you fixed.
Send back to the right agent for bigger issues.
Only when ALL checks pass: post the final package in the linked Telegram approvals room.
Handle client feedback: route "change: ..." to the right agent, re-check, re-send.
```

**Publisher**
```
Act ONLY on "approve" from the approver listed in protocol.md.
Create a scheduled post in Postiz (time, platforms, media, per-platform captions).
Confirm schedule in the Telegram room. When Postiz webhook reports live, post the link.
Never publish without approval. Never expose API keys.
```

---

## 7. Brand Kit system (MD files per client)

Each client = one **Switch package** (created in the Gateway by a person) holding library documents + references. Attach it to all of that client's rooms. Every agent in the room reads it — **a new agent is useful immediately.**

### Folder
```
brand-kits/
├── pushpam/
│   ├── brand.md        # colours, fonts, logo rules, tone
│   ├── rules.md        # do / don't, compliance, banned words
│   ├── protocol.md     # approver, platforms, post times, SLA
│   ├── audience.md     # who we talk to
│   ├── products.md     # project facts (price, RERA no., USPs)
│   ├── examples.md     # 5 best past posts (style reference)
│   ├── reel-style.md   # pacing, music mood, subtitle style
│   └── tokens.json     # machine-readable design tokens
├── clinic-demo/
│   └── ... same files
└── my-brand/
    └── ... same files (personal)
```

### `brand.md` — sample
```md
# Pushpam Infra — Brand

## Colours
- Primary: #1F3A5F (deep blue)
- Accent: #C9A227 (gold)
- Background: #F7F5F0 (cream)
- Text: #1A1A1A

## Fonts
- Headings: Playfair Display
- Body: Inter

## Logo
- Top-left or bottom-right, min width 120px
- White version on dark/photo backgrounds
- Never on busy areas of a photo

## Tone
- Premium, warm, family-first
- Short sentences, no jargon
- Marathi + English mix allowed (Pune audience)
```

### `rules.md` — sample
```md
# Rules (Brand Guard checks every item)

## Never
- "Guaranteed returns", "investment doubles", "best in Pune"
- Price without "onwards" and "*T&C apply"
- Competitor names
- More than 2 lines of text on an image

## Always
- RERA registration number on every project creative
- Max 8 hashtags on Instagram
- Site visit CTA on project posts

## Healthcare clients (separate kit)
- No cure or guaranteed-result claims
- No before/after images
- No patient faces without consent note
```

### `protocol.md` — sample
```md
# Protocol

## Approval
- Approver: Mr. X (Telegram @username)
- Backup approver: Ms. Y (Telegram @username)
- Only "approve" from these two triggers scheduling

## Platforms
- Instagram (post, carousel, reel), Facebook, LinkedIn

## Best posting times (IST)
- Instagram / Facebook: 7:30 PM
- LinkedIn: 10:00 AM, Tue–Thu

## SLA
- Reminder if no reply in 4 hours
- Escalate to account manager after 24 hours
- Festive posts: send for approval 3 days early
```

### `products.md` — sample
```md
# Products

## Luxe 28
- Type: 2 & 3 BHK
- Location: <area>, Pune
- Starting price: ₹XX L onwards*
- RERA: <number>
- USPs: <3 bullet points>
- Possession: <date>
```

### `reel-style.md` — sample
```md
# Reel style
- Length: 15–30 sec
- Hook in first 2 sec (question or bold visual)
- Cuts every 2–3 sec
- Music: warm, acoustic, no trending copyrighted tracks
- Subtitles: Inter Bold, white with blue (#1F3A5F) box, bottom third
- End card: logo + RERA no. + CTA (3 sec)
```

### `tokens.json` — sample
```json
{
  "primary": "#1F3A5F",
  "accent": "#C9A227",
  "bg": "#F7F5F0",
  "text": "#1A1A1A",
  "fontHead": "Playfair Display",
  "fontBody": "Inter",
  "logoLight": "drive://pushpam/logo-white.png",
  "logoDark": "drive://pushpam/logo-blue.png",
  "safeMargin": 64,
  "radius": 16
}
```

---

## 8. Visual agent options

| Option | How it works | Best for | Use? |
|---|---|---|---|
| **A. HTML templates → PNG** | Agent writes HTML/CSS with `tokens.json`; Playwright screenshots it | Carousels, offers, quotes, announcements — brand-perfect, text always correct | ✅ Main method |
| **B. AI image + HTML overlay** | AI image model generates background; HTML adds text + logo on top | Festive / mood / lifestyle posts | ✅ Add-on |
| **C. Client's real photos** | Pull site photos/renders from Drive reference or Telegram uploads | Construction updates, events, testimonials | ✅ Very authentic |
| **D. Figma / Canva templates** | Fill existing design templates via API | Agencies with existing template libraries | 🔜 Later |

**Rule:** AI images often misspell text → **text always comes from HTML**, never from the image model.

### Size presets
| Format | Size |
|---|---|
| Instagram post | 1080 × 1350 |
| Instagram story / reel | 1080 × 1920 |
| Facebook post | 1080 × 1080 |
| LinkedIn post | 1200 × 1500 |
| YouTube Shorts | 1080 × 1920 |

---

## 9. Reel generation

**Yes — Bolo Studio makes reels.**

### Pipeline
```
Brief → Script (hook first 2s) → Scene plan → Assets → Voiceover → Render → Subtitles → Compress → MP4
```

| Step | Tool options |
|---|---|
| Script + scene plan | Claude Code (reads `reel-style.md`) |
| Visual assets | Client videos/photos (Drive) · Pexels stock API (free) · Option A slides as frames |
| Voiceover | TTS service with Hindi/Marathi voices, or a team member records |
| Render | **Remotion** (React → MP4, brand-exact) or **FFmpeg** (simpler) |
| Subtitles | Generated from script, styled in brand font/colours |
| Output | 1080 × 1920 MP4, < 60 sec, compressed |

### Example scene plan (posted by Reel Producer)
```
Reel: "Luxe 28 — Diwali at home" (20 sec)
0–2s   Hook: "Is Diwali ghari ka?" — drone shot of tower
2–8s   Balcony render + diya overlay
8–15s  3 USPs as text pops (gold on blue)
15–20s Logo + RERA no. + "Site visit this weekend"
Voice: warm female, Marathi-English
Music: soft acoustic
```

---

## 10. Connecting social media accounts

### Recommended: Postiz (open-source, self-hosted)
- Runs in Docker next to the Switch server
- Connects Instagram, Facebook, LinkedIn, YouTube, X, Threads and more via **official OAuth**
- **Public REST API** → the Publisher agent calls it
- Free to self-host (pay only for your server)

### Setup steps
1. Run Postiz in Docker (Postgres + Redis included in compose).
2. Create developer apps:
   - **Meta** (Instagram + Facebook) — development mode works for your own test accounts
   - **LinkedIn** developer app
   - **Google Cloud** project for YouTube (optional)
3. In Postiz → **Add channel** → log in to each client account (one-time OAuth).
4. Create a Postiz API key → store as a secret for the Publisher agent. **Never paste it in a room.**

### Platform facts
| Platform | Note |
|---|---|
| Instagram | API publishing needs a **Business/Professional** account |
| Instagram | Daily cap on API-published posts per account (~50 per 24h; carousel counts as one) — plenty for an agency |
| Instagram | No native "schedule" in the API → Postiz holds the post and publishes at the set time |
| Instagram | Single videos published via API go out as reels |
| Facebook Pages | Supports scheduled posts |
| LinkedIn | Needs app approval for company pages; personal profile easier for demo |

### Alternative
Paid unified APIs (e.g. Ayrshare) — faster setup, monthly cost.

---

## 11. Telegram client approval flow

### Setup (≈10 min per client)
1. Create **one bot** via **@BotFather** (`/newbot`) → save the token in a password manager.
2. **Turn Group Privacy OFF** (`/mybots` → Bot Settings → Group Privacy → Turn off) **before** adding the bot to any group.
3. Connect Telegram in **Switch Console → Messaging apps → Connect → Telegram**.
4. Create group **"Pushpam × 7P Approvals"** → add client, account manager, bot → Switch auto-creates the room.
5. Ask the client to set a **Telegram @username** (Switch identifies people by it).
6. In **Brand Guard** and **Publisher** agent settings → allow the client to instruct them (default: agents answer only their owner).

### What the client sees
```
Pushpam × 7P Approvals

Brand Guard: Diwali campaign ready ✅
             Checked: RERA no., colours, no banned words
             [album: 5 carousel slides]
             [file: luxe28-diwali-reel.mp4]
             Caption:
             "Is Diwali, tumchya navin gharat 🪔 ..."
             Schedule: IG + FB Fri 7:30 PM · LinkedIn Sat 10 AM
             Reply: approve / change: <what>

Client:      change: slide 3 price should say "onwards"

Brand Guard: Noted → sent to Visual Designer.
             Updated slide 3 [photo]. Approve?

Client:      approve

Publisher:   Scheduled ✅ IG + FB Fri 7:30 PM · LinkedIn Sat 10 AM

(Friday 7:30 PM)
Publisher:   Live 🎉 instagram.com/p/xxxx
```

### Telegram behaviour to design for
| Behaviour | Design choice |
|---|---|
| One bot represents all agents; name shown at start of each message | Keep agent names short and clear |
| Agent names don't autocomplete | Use simple commands: `approve`, `change: ...` |
| Tables don't render | Agents use one short line per item |
| Images relay as photos; other files (MP4) as documents; multiple files as an album | Send carousel as album, reel as file |
| Incoming files capped at 20 MB | Large client media via Drive link |
| Messages over 4096 chars are split | Keep approval messages short |
| 👀 reaction + "Working…" status while an agent works | Client knows it's in progress |

### Bonus: client voice notes
Client sends a **Marathi voice note** with feedback → speech-to-text step transcribes it → Brand Guard routes it like text. Strong demo moment.

---

## 12. Scheduling & publishing flow

```
Monday  ─► Strategist proposes week calendar (#studio-hq) ─► Account manager approves
   │
   ▼
Each item ─► Copywriter + Visual + Reel ─► Brand Guard ─► Telegram approval
   │
   ▼
"approve" ─► Publisher ─► Postiz API (scheduled post) ─► confirm in Telegram
   │
   ▼
Post time ─► Postiz publishes ─► webhook ─► Publisher posts live link
   │
   ▼
Weekly  ─► (optional) Analyst posts "top 3 posts this week" to client
```

### Publisher → Postiz (pseudo-code)
```python
def on_approve(msg, draft):
    if msg.author not in protocol.approvers:
        return reply("Only approvers listed in protocol.md can approve.")
    post = postiz.create_post(
        channels=draft.platforms,          # ["instagram", "facebook", "linkedin"]
        media=draft.media_urls,            # PNGs / MP4
        captions=draft.captions_by_platform,
        schedule_at=draft.post_time,       # from protocol.md best times
    )
    reply(f"Scheduled ✅ {draft.schedule_summary}")
    save_decision(draft.id, approved_by=msg.author, postiz_id=post.id)

def on_postiz_webhook(event):
    if event.status == "published":
        post_to_room(event.client_room, f"Live 🎉 {event.permalink}")
```

---

## 13. End-to-end example

```
1. Akshay (Wispr → #pushpam-work):
   "Diwali campaign for Luxe 28, family feel, one carousel and one reel,
    Marathi plus English, post Friday evening"

2. Strategist:     Brief → Carousel (5 slides) + Reel (20s) · IG/FB/LinkedIn · Fri 7:30 PM
                   @Copywriter @Visual-Designer @Reel-Producer — go.

3. Copywriter:     3 caption options (MR/EN), 8 hashtags.

4. Visual:         5 slides rendered with Pushpam tokens.json.

5. Reel Producer:  Script → voice → render → 20s MP4.

6. Brand Guard:    Fixed 1 issue (missing "onwards"). All checks pass.
                   → Final package sent to linked Telegram room.

7. Client:         "approve" (Telegram)

8. Publisher:      Scheduled in Postiz → live link posted Friday.
```

⏱️ **~15 min of active work vs 1–2 days of WhatsApp back-and-forth.**

---

## 14. Safety & permissions
| Risk | Control |
|---|---|
| Wrong person approves | Publisher accepts "approve" only from approvers in `protocol.md` |
| Agent posts without approval | Publisher never publishes directly; only schedules after approval |
| Duplicate posts | Publisher is a single-holder role |
| Brand / compliance mistakes | Brand Guard checks `rules.md` before client sees anything |
| Leaked secrets | Bot token + Postiz key stored as secrets, never in rooms |
| Client sees internal mess | Clients are only in the Telegram approvals room; drafts stay in Mattermost |
| Client data across clients | Each client's Brand Kit attached only to that client's rooms (private rooms) |
| Demo data | Use demo/approved content only — no real buyer data |

---

## 15. Wispr Flow usage
Target the **Code with Wispr ($500)** side track.

**Dictate with Wispr:**
- Content ideas into Mattermost rooms
- Room instructions for every room
- Every Brand Kit MD file
- Prompts to Claude Code while building agents
- README + blog draft

**Submission:** add the Wispr Insights screenshot (usage scorecard).

**Meta bonus:** use Bolo Studio itself to create our **#HowISwitch posts** and **blog** → one build competes for 4 prizes:
1. Track 01 / 02 ($2,000)
2. Code with Wispr ($500)
3. Best Blog (AirPods 5)
4. #HowISwitch (Logitech keyboard)

---

## 16. Tech stack
| Layer | Tool |
|---|---|
| Agent collaboration | **Switch** (server in Docker + Switch Console) |
| Internal chat | Mattermost (ships with Switch) |
| Client chat | Telegram (Switch bridge) |
| Agents | Claude Code, Codex, custom TypeScript Publisher (`services/publisher`, Hono) |
| Shared engine | `@bolo/core` — Brand Kit parser, Brand Guard rules, approval workflow, Postiz client |
| Web + dashboard | Next.js 15 (App Router), Tailwind v4, Motion |
| Storage | JSON store in `data/` (atomic writes) — zero services to clone and run |
| Visuals | HTML/CSS + Playwright, optional AI image model |
| Reels | Remotion or FFmpeg, TTS, Pexels API |
| Speech-to-text | For client voice notes |
| Scheduler | Postiz (self-hosted, Docker — official compose via `infra/postiz/setup.sh`) |
| Assets | Google Drive (Switch reference) |
| Dictation | Wispr Flow |
| Tooling | npm workspaces, TypeScript, `node:test` |

---

## 17. Repo structure
```
bolo-studio/
├── README.md
├── package.json                # npm workspaces + root scripts
├── .env.example                # Postiz URL/key, Publisher port + webhook secret
├── apps/
│   └── web/                    # Next.js: landing page + studio dashboard + API routes
│       └── src/
│           ├── app/
│           │   ├── page.tsx                    # landing
│           │   ├── studio/[clientId]/          # calendar · approvals · brand-kit · agents · publishing
│           │   └── api/                        # ideas, posts (edit/submit/reply/live), client settings
│           └── components/{landing,studio,ui}/
├── packages/
│   └── core/                   # @bolo/core — shared by web + Publisher
│       └── src/
│           ├── brand-kit.ts    # reads brand-kits/*, parses protocol.md / products.md / rules.md
│           ├── brand-guard.ts  # deterministic checks + auto-fixes from the bolo-checks block
│           ├── workflow.ts     # idea → draft → brand-check → awaiting → scheduled → live
│           ├── postiz.ts       # Postiz public API client (dry-run without a key)
│           ├── store.ts        # JSON store with atomic, serialised writes
│           └── *.test.ts
├── services/
│   └── publisher/              # custom agent: Switch room relay + Postiz webhook (Hono)
├── brand-kits/                 # one folder per client = one Switch package
│   ├── pushpam-demo/           # client.json, brand.md, rules.md, protocol.md, products.md, …
│   ├── clinic-demo/
│   └── my-brand/
├── agents/                     # instructions pasted into each agent in Switch Console
├── switch/                     # room setup guide + room instructions
├── infra/postiz/               # fetches the official Postiz docker-compose stack
├── docs/setup.md
└── data/                       # runtime store (git-ignored)

# Planned next: render/ (Remotion stills + reels for the Visual and Reel agents), blog/
```

---

## 18. 4-day build plan

| Day | Member A | Member B | Member C | Member D |
|---|---|---|---|---|
| **Day 1 — Nov 4** | Switch Console + Mattermost + Telegram bot | Postiz in Docker + Meta/LinkedIn dev apps | Brand Kits for 2 demo clients (via Wispr) | Strategist + Copywriter instructions |
| **Day 2 — Nov 5** | Rooms, links, groups, permissions, template | Publisher agent (Switch protocol + Postiz API) | Visual agent: HTML templates → PNG | Brand Guard checks |
| **Day 3 — Nov 6** | Telegram approval flow + voice-note transcription | Postiz webhook → live link reply | Reel Producer (Remotion/FFmpeg + TTS) | End-to-end testing, bug fixes |
| **Day 4 — Nov 7** | Demo video | README + architecture diagram | Blog post | #HowISwitch posts + Wispr scorecard |

**Cut-line if behind:** drop Analyst → drop YouTube/X → merge Strategist + Copywriter. **Never cut:** Telegram approval + live post (core demo).

---

## 19. Demo video script (2–3 min)
| Time | Scene |
|---|---|
| 0:00–0:20 | **Problem:** agency drowning in WhatsApp approvals, manual posting |
| 0:20–0:40 | **Setup:** show rooms, agents, Brand Kit package in Switch Console |
| 0:40–1:30 | **Live:** speak idea with Wispr → agents work in Mattermost → visuals + reel appear |
| 1:30–1:50 | **Client:** Telegram — "change: …" → fix → "approve" |
| 1:50–2:10 | **Live post:** Instagram post goes live, link posted back |
| 2:10–2:40 | **Why Switch:** rooms · roles · packages · linked rooms · Mattermost ↔ Telegram · custom agent |

---

## 20. Judging fit
| Criteria | How Bolo Studio hits it |
|---|---|
| **Use of Switch** | Multi-room, linked rooms, single-holder roles, Brand Kit packages, templates, Mattermost + Telegram bridge, custom protocol agent — breaks without Switch |
| **Technical execution** | Docker Compose, cloneable repo, demo Brand Kits, clear setup guide |
| **Creativity & impact** | Real agency pain, Indian-language support, solves client approval chaos |
| **Presentation** | Clear "15 min vs 2 days" story, live publish in demo, README shows Switch usage |

---

## 21. Submission checklist
- [ ] Public GitHub repo
- [ ] README: problem, architecture, **how Switch is used**, setup steps
- [ ] Demo video (2–3 min)
- [ ] Demo Brand Kits included
- [ ] Wispr Insights scorecard screenshot
- [ ] Blog post published (Best Blog)
- [ ] #HowISwitch social posts
- [ ] Star the Switch repo
- [ ] Submitted before **Nov 7, 11:59 PM IST**

---

## 22. Future scope
- **Analyst agent:** weekly performance reports + content suggestions from what worked
- **Ads loop:** best organic post → boosted as a Meta ad with approval
- **WhatsApp bridge** for clients who don't use Telegram
- **Client self-serve:** client drops raw photos/voice note in Telegram → full campaign
- **White-label SaaS** for other agencies (template = onboard new agency in one click)
- **More languages:** Gujarati, Tamil, Telugu, Kannada
