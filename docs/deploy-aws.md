# Deploy Bolo Studio on AWS

One EC2 server runs everything: the studio, image and reel rendering, the publishing scheduler and
the Telegram bot. HTTPS is automatic. The data is in MongoDB Atlas; images and reels are on the
server's disk (backed up by daily snapshots) and in each client's Google Drive. About 40 minutes
the first time; updates are one command.

## 1. Create the server (AWS Console, ~10 min)

1. **EC2 → Launch instance**
   - Name: `bolo-studio` · Image: **Ubuntu Server 24.04 LTS**
   - Type: **t3.large** (2 vCPU, 8 GB — reels need the memory; t3.medium works for light use)
   - Key pair: create one and download it
   - Network: allow **SSH (22)** from your IP, and **HTTP (80)** and **HTTPS (443)** from anywhere
   - Storage: **40 GB gp3**
2. **Elastic IP** → Allocate → Associate with the instance (the address never changes).
3. At your DNS provider, add an **A record**: `studio.yourcompany.com` → the Elastic IP.

## 2. Database: MongoDB Atlas (~10 min)

All data — companies, posts, accounts, notifications, the clients' encrypted keys — lives in
MongoDB Atlas. (Images and reels stay on the server disk, with copies in each client's Google Drive.)

1. **mongodb.com/atlas** → sign up → **Create cluster**. Provider **AWS**, region **Mumbai
   (ap-south-1)** — the same region as the EC2 server. M0 (free) is fine to start; move up later
   with one click.
2. **Database Access** → Add new database user → username `bolo`, a long generated password →
   role **Read and write to any database**.
3. **Network Access** → Add IP address → your EC2 **Elastic IP** (and your office IP if you want to
   run the studio locally against it).
4. **Connect → Drivers** → copy the connection string and put your password in it:
   `mongodb+srv://bolo:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority`
5. The deploy script asks for it on the first run (it goes into `.env` as `MONGODB_URI`).

On first start the studio fills the empty database by itself — with your existing `data/` if it's
on the server, otherwise with the demo companies. Backups: Atlas → your cluster → **Backup**
(daily snapshots are included on paid tiers; on M0, run `mongodump` from the server occasionally).

**Running the studio on your laptop against Atlas:** use a separate database name so tests never
touch real clients' data — in your local `.env` add `MONGODB_DB=bolo_studio_dev`.

## 3. Install and start (~10 min)

```bash
ssh -i bolo.pem ubuntu@<elastic-ip>
git clone <your repo url> bolo-studio && cd bolo-studio
bash infra/aws/deploy.sh          # asks for the domain; installs Docker; builds and starts
```

The first run creates `.env` with the domain and fresh secrets. Open `https://studio.yourcompany.com`
and create the admin account.

## 4. Platform keys (`nano .env`, then `bash infra/aws/deploy.sh` again)

These switch on the client connections — each is described in `.env`:

| Key | Turns on | Redirect URI to register |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Telegram previews (images/videos) | — the same bot Switch Console bridges |
| `META_APP_ID` / `META_APP_SECRET` | Instagram & Facebook | `https://<domain>/api/connect/meta/callback` |
| `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET` | LinkedIn | `https://<domain>/api/connect/linkedin/callback` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google Drive | `https://<domain>/api/drive/callback` |

Studio → **Platform** (admins only) shows what's set and what's missing. Clients then connect their own
accounts and keys in Studio → **Connections** — no help from you needed.

**Meta review:** until Meta approves your app (App Review for `instagram_content_publish` and
`pages_manage_posts`), only people added as testers in your Meta app can connect. Submit for review
once the app works for you.

## 5. Backups (~2 min)

EC2 → **Lifecycle Manager** → Create policy → EBS snapshot policy → target the instance's volume →
every 24 h, keep 7. That keeps the images and reels; the rest is in Atlas (step 2).

## Updating

```bash
cd bolo-studio && bash infra/aws/deploy.sh
```

Pulls the code, rebuilds, restarts. Data stays.

## Useful

- Logs: `sudo docker compose -f infra/aws/docker-compose.yml logs -f web`
- Restart: `sudo docker compose -f infra/aws/docker-compose.yml restart web`
- **Switch** (approvals and the agents): set `SWITCH_BRIDGE_URL`, `SWITCH_AGENT_ID` and
  `SWITCH_AGENT_API_KEY` in `.env` — the deploy script then also starts the `publisher` container.
  The server must be able to reach Switch: a hosted Switch, or a Switch Console on a machine the
  server can reach (a local Switch Console at 127.0.0.1 on someone's laptop is not reachable from AWS).
- Without Atlas (leave `MONGODB_URI` empty) everything is kept in files on the server instead.
