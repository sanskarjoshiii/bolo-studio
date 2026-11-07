# Bolo Studio: demo video script ([Team name])

**Length:** 3:00 maximum. **Voice-over pace:** about 150 words a minute (each block fits its slot when read calmly).
**Language:** English narration. Captions on screen all the way through (judges often watch muted).
**Rule for everything on screen:** it comes from the real app, the real Switch rooms or the real Telegram group. No mock-ups.

**How the video covers the judging criteria:**

| Criterion | Weight | Where it's answered |
|---|---|---|
| Use of Switch | 30% | §4 (how Switch is used), §5 (Switch rooms live in the demo), §6 (what stops without Switch) |
| Technical execution | 25% | §4 (architecture + AWS deployment), §6 (one-command setup, tests, README) |
| Creativity and impact | 25% | §2 (a real agency problem), §3 (the idea), §5 (one spoken idea → bilingual post → approved → live) |
| Presentation | 20% | The whole flow, captions, and the README link at the end |

| # | Section | Time | Length | Who |
|---|---|---|---|---|
| 1 | Team introduction | 0:00 – 0:15 | 15 s | Sanskar, Kamran, [Member 3] |
| 2 | The problem | 0:15 – 0:32 | 17 s | Presenter + screen |
| 3 | The idea | 0:32 – 0:45 | 13 s | Presenter + screen |
| 4 | How it works: Switch at the centre, on AWS | 0:45 – 1:20 | 35 s | Presenter + architecture diagram |
| 5 | Live demo: one spoken idea → live post | 1:20 – 2:30 | 70 s | Screen recording + voice-over |
| 6 | Why it works and why it matters | 2:30 – 2:48 | 18 s | [Member 3] |
| 7 | Outro | 2:48 – 3:00 | 12 s | All three |

---

## 1. Team introduction · 0:00 – 0:15

Each person on camera (or a face card + name), about 5 s each. Lower-third: **name · role**.

| Time | Speaker | Line |
|---|---|---|
| 0:00 – 0:05 | **Sanskar Joshi** | "We're [Team name], and this is Bolo Studio. I'm Sanskar — I built **[confirm: e.g. the studio and the approval workflow]**." |
| 0:05 – 0:10 | **Kamran Pathan** | "I'm Kamran. I built **[confirm: e.g. the Switch agents — bolo-writer and bolo-designer — and the Publisher]**." |
| 0:10 – 0:15 | **[Member 3]** | "I'm [name]. I deployed it on AWS with Docker, set up MongoDB Atlas, and wrote the automated tests." |

> The roles in brackets are placeholders: put in what each of you actually built before recording.

---

## 2. The problem · 0:15 – 0:32 (17 s)

**Screen:** a busy WhatsApp chat with a client ("change the price", "send again", "where is the Marathi one?"), then four app icons: Canva, Instagram, Facebook, LinkedIn.
**Voice:**
> "A small social media agency in India writes every post twice — in English, and in Marathi or Hindi — designs it, chases the client for approval on WhatsApp, and then posts it on four different apps. One post can take a whole day, and most of it is copying and chasing."

---

## 3. The idea · 0:32 – 0:45 (13 s)

**Screen:** the Bolo Studio landing page, then the studio calendar.
**Voice:**
> "Bolo means *speak*. With Bolo Studio you speak an idea once. A team of AI agents writes it in your languages, designs it in your brand, checks your rules, gets the client's approval on Telegram, and publishes it."

---

## 4. How it works: Switch at the centre, on AWS · 0:45 – 1:20 (35 s)

**Screen:** one architecture diagram, built up step by step as each line is spoken:

```
 Wispr Flow (voice)                         Client's Telegram group
        │                                              ▲   │ "approve #ref"
        ▼                                              │   ▼
 ┌──────────── SWITCH ─────────────────────────────────────────────┐
 │  #client-work room (team + agents)      Client Approvals room    │
 │   ├─ bolo-writer   (Claude Code agent)   └─ Telegram bridge      │
 │   ├─ bolo-designer (Claude Code agent)                           │
 │   └─ bolo-publisher (custom agent, Switch agent WebSocket) ──────┤
 └───────────────┬──────────────────────────────────────────────────┘
                 │  bolo CLI / API
                 ▼
 ┌──────── AWS (EC2, Mumbai) ── Docker · HTTPS ─────────────────────┐
 │  BOLO STUDIO — Brand Kit · Brand Guard · designs & reels          │
 │                (Sarvam voice) · Drafts · scheduler                │
 └───────────────┬───────────────────────────────── MongoDB Atlas ──┘
                 ▼
       Instagram · Facebook · LinkedIn
```

| Time | Diagram step | Voice |
|---|---|---|
| 0:45 – 0:53 | Switch box + the two rooms appear | "In Switch, each client gets two rooms: a work room for us and our AI agents, and an approvals room linked to their Telegram." |
| 0:53 – 1:02 | The three agents light up | "bolo-writer and bolo-designer are Claude Code agents in Switch that write and design from the client's Brand Kit. bolo-publisher is our own Switch agent." |
| 1:02 – 1:08 | Telegram arrow + Publisher | "It sends each post to the client's Telegram, and their *approve* comes back through Switch." |
| 1:08 – 1:12 | Wispr Flow at the top | "With Wispr Flow, we just speak our ideas." |
| 1:12 – 1:20 | The AWS box appears around the studio | "It runs on AWS: one EC2 server in Mumbai with Docker and HTTPS, and MongoDB Atlas for the data." |

> Say the AWS line only once the deployment is really live (`docs/deploy-aws.md`). Show the live https address for a second while saying it.

---

## 5. Live demo: one spoken idea → live post · 1:20 – 2:30 (70 s)

**Screen recording of the real system**, cut tight (speed up every wait; never show a spinner for more than a second). Cursor highlights and gentle zooms on what's being said.

| Time | Screen | Voice-over |
|---|---|---|
| 1:20 – 1:35 | **Switch work room** (on the live AWS site's client). Hold the Wispr shortcut; the idea appears as you speak: *"@bolo-writer Diwali offer post for [client], Marathi and English, twenty percent off this weekend."* Send. | "Let's see it live. Here's our client's work room in Switch. I hold one key, speak the idea with Wispr Flow, and send it to bolo-writer." |
| 1:35 – 1:47 | Same room, sped up: bolo-writer replies (brief + captions ready), hands over to bolo-designer, which replies "design rendered, sent to Brand Guard". | "The writer reads the Brand Kit and writes the brief and captions in Marathi and English. Then it hands over to the designer, which creates the design in the brand's colours." |
| 1:47 – 1:57 | **Bolo Studio editor** for that post: the design in the phone preview, captions tabs मराठी / EN, size picker, Brand Guard "7/7 passed". | "Everything shows up live in Bolo Studio: the design, every caption, ten sizes to choose from, and Brand Guard checking the client's rules." |
| 1:57 – 2:10 | **Client's Telegram group** (phone recording): the image arrives, then the approval message with its #code. The client replies `approve #pXXXXX`; within a second: "Scheduled ✅". | "The client sees the real design in their Telegram group — no login, no app. They reply approve, and Switch passes it back to our Publisher." |
| 2:10 – 2:22 | **Drafts** in the studio → the approved card → **Post now** → the post appears on **LinkedIn** (cut to the live post). | "Approved posts wait in Drafts until their time — or we post right now. And it's live." |
| 2:22 – 2:30 | **Calendar** with the post on it, the **notification** bell showing "Posted", then a 2-second glimpse of a **reel** with Marathi voiceover and subtitles. | "It lands on the calendar, the team gets notified — and the same flow makes reels with a Marathi voiceover." |

> **If Facebook/Instagram are connected before recording**, show the post going live there too in 2:10 – 2:22 and say: "…live on LinkedIn, Facebook and Instagram."

---

## 6. Why it works and why it matters · 2:30 – 2:48 (18 s)

**Presenter: [Member 3]** (deployment, database and tests, so this section is theirs).
**Screen:** split: left [Member 3]; right, in turn: the GitHub README (setup section), the test results (`npm test` all green), the Connections page.

| Time | Screen | Voice |
|---|---|---|
| 2:30 – 2:37 | README + green tests | "It runs with one command, and sixty-seven tests pass." |
| 2:37 – 2:48 | [Member 3] | "Switch holds it all together. What took an agency a day now takes one sentence and one tap." |

---

## 7. Outro · 2:48 – 3:00 (12 s)

**Screen:** team in frame, then the end card: Bolo Studio logo, "Speak once. Ship everywhere.", `github.com/sanskarjoshiii/bolo-studio`, "Built with Switch", [Team name]: Sanskar · Kamran · [Member 3].

| Time | Speaker | Line |
|---|---|---|
| 2:48 – 2:56 | Sanskar | "That's Bolo Studio. Our goal: every small business in India gets content in its own language, without an agency's day of work." |
| 2:56 – 3:00 | All three | "We're [Team name]. Thank you!" |

---

## Recording checklist

- **Everything on one computer:** Switch Console open, `npm run demo` running, ngrok running (`docs/demo-setup.md`).
- **Switch rooms ready:** the client's work room with `!invite-agent bolo-writer`, `bolo-designer` and `bolo-publisher`; the client's Telegram group bridged as the approvals room, with the Publisher invited; its name entered in Bolo → Platform → Switch rooms.
- **Agents running:** bolo-writer and bolo-designer started in Switch Console (their folders from `npm run agents:setup`), with Claude Code signed in.
- **Rehearse the Switch-room part twice.** If the agents are slow, record it and speed it up in editing; if they fail on the day, record §5 with the studio's **"AI writes and designs it now"** button instead and keep the same voice-over from 1:47.
- **Prepare a reel beforehand** for the 2:22 glimpse (rendering takes a minute or two).
- **LinkedIn connected** (Connections → Continue with LinkedIn) before the take; post something harmless the client won't mind staying online.
- **Telegram:** the approver's Telegram username is in Team → Telegram approvers (or "Anyone in the group can approve" is on).
- **Captions** for the whole voice-over; zoom on Telegram text so it's readable.
- **Check the test count** before recording (`npm test`; core + Publisher) and say the real number.
- Export 1920×1080, under 3:00, upload, and put the link in `README.md`.
