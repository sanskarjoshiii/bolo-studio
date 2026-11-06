# Demo setup — posting for real from Bolo Studio

Run everything on the computer that has **Switch Console** (it relays Telegram approvals).
About 45 minutes the first time. No Meta/LinkedIn review is needed: the app's own admins can
connect their own accounts right away.

## 0. Get the code

```bash
git pull
npm install
npx playwright install chromium     # once — renders the designs
```

In Switch Console: keep the Telegram bot connected (don't remove it). `/setprivacy` → **Disable** in
@BotFather is correct — leave it.

## 1. A fixed public https address (ngrok, ~10 min)

Facebook and LinkedIn send people back to an https address after login; Instagram downloads the
image from it.

1. Sign up at **ngrok.com** (free) → **Domains** → claim your free static domain
   (e.g. `bolo-demo.ngrok-free.app`).
2. Install ngrok, run `ngrok config add-authtoken <token>` once, then keep this running:
   `ngrok http --url=bolo-demo.ngrok-free.app 3000`
3. In `.env` (repo root):
   ```
   BOLO_WEB_URL=https://bolo-demo.ngrok-free.app
   BOLO_PUBLIC_URL=https://bolo-demo.ngrok-free.app
   BOLO_INTERNAL_URL=http://127.0.0.1:3000
   ```

## 2. Facebook + Instagram (~15 min)

Needed first: a **Facebook Page**, and an **Instagram Business or Creator account linked to that
Page** (Instagram app → Settings → Account type and tools; then link the Page).

1. **developers.facebook.com** → My Apps → **Create app** → type **Business**.
2. Add the product **Facebook Login for Business** → Settings → **Valid OAuth Redirect URIs**:
   `https://bolo-demo.ngrok-free.app/api/connect/meta/callback`
3. If it asks for permissions, add: `pages_show_list`, `pages_manage_posts`,
   `pages_read_engagement`, `business_management`, `instagram_basic`, `instagram_content_publish`.
4. **App settings → Basic** → copy App ID and App Secret into `.env`:
   ```
   META_APP_ID=...
   META_APP_SECRET=...
   ```
   Business apps: **Facebook Login for Business → Configurations → Create configuration**
   (login variation *General*, token *User access token*, the permissions above) → copy its ID:
   ```
   META_CONFIG_ID=...
   ```
5. Connect with the **same Facebook account that created the app** (or add the demo account in
   **App roles → Testers**). Strangers can't connect until Meta's App Review — not needed for the demo.

## 3. LinkedIn (~10 min)

1. **linkedin.com/developers** → **Create app** (link it to any LinkedIn company page you own).
2. **Products** tab → add **Sign In with LinkedIn using OpenID Connect** and **Share on LinkedIn**.
3. **Auth** tab → Authorized redirect URL:
   `https://bolo-demo.ngrok-free.app/api/connect/linkedin/callback`
4. Copy Client ID and Client Secret into `.env`:
   ```
   LINKEDIN_CLIENT_ID=...
   LINKEDIN_CLIENT_SECRET=...
   ```
   Posts go to the connected person's own profile.

## 4. Already there (check `.env`)

- `TELEGRAM_BOT_TOKEN` — the bot Switch bridges (Bolo only sends images/videos with it)
- `SWITCH_*` — the Publisher agent
- `SARVAM_API_KEY` — voiceovers for reels
- **Claude Code** logged in on this computer (`claude` once) — then any new company can generate
  designs without its own API key

## 5. Start

```bash
npm run demo        # production build, then studio + Publisher — fast pages
```

Open `https://bolo-demo.ngrok-free.app`. Keep ngrok and Switch Console running.

## 6. Recording flow

1. **Sign up** → create a company → step 2 (Telegram) → **Continue**.
2. **Connections** → **Continue with Facebook** (pick the Page) and **Continue with LinkedIn**.
3. For Telegram approvals: add the bot to a Telegram group → in Switch, `!invite-agent bolo-publisher`
   in that room → Bolo → **Platform** → *Switch rooms* → enter the group's name as the approvals room.
   (Or skip and approve inside the studio.)
4. **Create** → pick a size and languages → **Generate**. Show the progress popup and switch
   sections while it runs (Cancel works too).
5. The approval message + image arrive in the Telegram group → reply `approve #ref`
   (or open **Approvals** and press Approve) → the post moves to **Drafts**.
6. **Drafts** → **Post now** → live on Facebook, Instagram and LinkedIn → it appears on the
   **Calendar**, and a notification says "Posted".

## Before recording

- **Do one full test run first.** Real posting to Facebook/Instagram/LinkedIn hasn't been tried
  with real accounts yet. If anything fails, the reason is in the post's **Activity** panel
  (and in the terminal) — send it over and it gets fixed.
- If the ngrok address ever changes, update `.env` and both redirect URLs, then restart.
