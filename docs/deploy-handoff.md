# Deployment handoff — Bolo Studio on AWS

For whoever takes over the deployment. The app is finished and tested locally (Facebook + Instagram
posting worked end to end on 7 Nov). This page says what to do, what to get from Sanskar, and what to
watch out for. The step-by-step server guide is **[deploy-aws.md](deploy-aws.md)** — follow it; this
page fills in everything around it.

---

## 1. Get the code

```bash
git pull origin main
npm install
npm test          # should say 67 passing (60 core + 7 Publisher)
```

You don't need to run anything locally to deploy — the server builds everything itself.

## 2. What you need from Sanskar (ask him privately — never in Git, a group chat or a screenshot)

These are values from **his** `.env`. Copy them one by one into the server's `.env` (step 4 of
deploy-aws.md).

| Key | What it is | Needed? |
|---|---|---|
| `META_APP_ID`, `META_APP_SECRET`, `META_CONFIG_ID` | Meta app **voxton** (Facebook + Instagram) | Yes |
| `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` | LinkedIn app | Yes |
| `TELEGRAM_BOT_TOKEN` | @bolo_studio_bot | Yes |
| `SARVAM_API_KEY` | Marathi/Hindi voiceovers for reels | Yes |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Drive (optional) | Only if Drive is wanted |

**Also ask for access** (or ask him to do these clicks — section 5):
- **Admin/Developer role** on the Meta app *voxton* (developers.facebook.com → App roles).
- Access to the **LinkedIn app** (linkedin.com/developers → the app → Team members).
- Google Cloud project, if Drive is used.

**Do NOT copy these from his `.env`:**

| Key | Why |
|---|---|
| `AUTH_SECRET`, `BOLO_ENCRYPTION_KEY` | `deploy.sh` makes fresh ones for the server. |
| `BOLO_WEB_URL`, `BOLO_PUBLIC_URL`, `BOLO_INTERNAL_URL` | His are the ngrok address; the server uses the real domain (`deploy.sh` sets them). |
| `SWITCH_BRIDGE_URL`, `SWITCH_AGENT_ID`, `SWITCH_AGENT_API_KEY` | They point at the Switch server on **his laptop**. See section 6. |
| `BOLO_LOCAL_CLAUDE` | Must be `off` on the server (`deploy.sh` sets it). |

His local `data/` folder (test companies and posts) is **not** needed — the server starts clean on
MongoDB Atlas.

## 3. What you set up yourself

1. **AWS**: EC2 **t3.large**, Ubuntu 24.04, 40 GB, Elastic IP, ports 22/80/443 (deploy-aws.md §1).
2. **Domain**: an A record, e.g. `studio.<your-domain>` → the Elastic IP. HTTPS is automatic (Caddy).
3. **MongoDB Atlas**: free cluster, a database user, and the connection string (deploy-aws.md §2).
   `deploy.sh` asks for it as `MONGODB_URI`.

## 4. Deploy

```bash
ssh -i bolo.pem ubuntu@<elastic-ip>
git clone <repo url> bolo-studio && cd bolo-studio
bash infra/aws/deploy.sh        # asks for the domain + MONGODB_URI, installs Docker, builds, starts
nano .env                       # paste the keys from section 2
bash infra/aws/deploy.sh        # again, to apply them
```

Open `https://<domain>` → the **first account you create becomes the admin**. Use the team's shared
email for it, not a personal test account.

## 5. Register the new address with Meta, LinkedIn (and Google)

The logins only send people back to addresses on the list. **Add** the new ones — keep the ngrok ones
too, so local demos still work.

**Meta** (developers.facebook.com → voxton):
- Facebook Login for Business → Settings → **Valid OAuth Redirect URIs**:
  `https://<domain>/api/connect/meta/callback`
- Client OAuth login **ON**, Web OAuth login **ON** → Save.
- App settings → Basic → **App domains**: `<domain>` → Save.

**LinkedIn** (linkedin.com/developers → the app → Auth → Authorized redirect URLs):
`https://<domain>/api/connect/linkedin/callback`

**Google** (only if Drive): Cloud Console → Credentials → the OAuth client → redirect URI
`https://<domain>/api/drive/callback`

Until Meta's App Review is approved, only people with a role on the voxton app (admins/testers) can
connect Facebook/Instagram. LinkedIn works for anyone.

## 6. Switch on the server — read this

Switch (the agents' rooms and the Telegram approvals bridge) runs in **Switch Console on Sanskar's
laptop**. The AWS server can't reach it, and **only one program may read the Telegram bot at a time**.

So on the server, add this line to `.env`:

```
TELEGRAM_UPDATES=off
```

With that:
- The deployed site does **everything except Switch**: sign up, companies, Brand Kit, AI writing and
  designs, approvals **in the studio** (Approvals page), Drafts, Post now, scheduled posting to
  Facebook / Instagram / LinkedIn, reels.
- The **Switch demo** (agents in rooms, approve from Telegram) stays on Sanskar's laptop with ngrok —
  that's what the video shows.

Don't leave `TELEGRAM_UPDATES` unset on the server while Switch Console is running on the laptop —
both would fight over the bot and approvals get lost. (Running Switch itself on AWS is possible later,
but it's not part of this handoff.)

## 7. Check it works (10 min)

- [ ] `https://<domain>` opens with a padlock; sign up works.
- [ ] Studio → **Platform**: every key shows as set.
- [ ] Create a company → **Connections** → Continue with Facebook (pick the Page) and LinkedIn → both
      show connected (no "URL blocked" — if you see it, recheck section 5).
- [ ] In Connections, add an AI key for the company (Claude or OpenAI) — on the server there is no
      Claude Code login, so each company uses its own key.
- [ ] Create → Generate a post → it appears with a design and captions.
- [ ] Approvals → Approve → Drafts → **Post now** → live on Facebook and Instagram.
- [ ] Optional: make a short reel (checks Sarvam + rendering memory).

If a post fails, the reason is in the post's **Activity** panel; server logs:
`docker compose -f infra/aws/docker-compose.yml logs -f --tail=100`

## 8. Good to know

- **Updating** after new commits: `cd bolo-studio && bash infra/aws/deploy.sh`.
- **Backups**: deploy-aws.md §5 (EBS snapshots; the data itself is in Atlas).
- **Disk**: keep an eye on free space (`df -h`); rendered images and reels live on the server disk.
- **Secrets**: `.env` is ignored by Git — it must never be committed.
- When it's live, send the URL to the team: it goes in `README.md` and the video's AWS line.
