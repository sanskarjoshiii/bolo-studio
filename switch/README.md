# Switch setup

Bolo Studio runs inside Switch rooms. This folder holds what you paste into Switch Console.

## Rooms

| Room | App | Members | Room instructions |
|---|---|---|---|
| `#studio-hq` | Mattermost | Whole team + all agents | [studio-hq.md](room-instructions/studio-hq.md) |
| `#<client>-work` | Mattermost | Team + agents | [client-work.md](room-instructions/client-work.md) |
| `<Client> × 7P Approvals` | Telegram group | Client, account manager, Brand Guard, Publisher | [client-approvals.md](room-instructions/client-approvals.md) |
| `#my-brand` | Mattermost | You + agents | [client-work.md](room-instructions/client-work.md) |

## Per client (about 10 minutes)

1. **Package** — create a package named after the client and upload every file from
   `brand-kits/<client>/` as library documents. Add the client's Google Drive folder as a reference.
2. **Rooms** — create `#<client>-work` (Mattermost) and the Telegram group `<Client> × 7P Approvals`
   (add the client, the account manager and the bot; Switch creates the room automatically).
3. **Link** `#<client>-work` ↔ `<Client> × 7P Approvals` so agents know where finals go.
4. **Attach** the client package to both rooms and paste the room instructions.
5. **Roles** — Strategist, Reel Producer, Brand Guard, Publisher: single-holder. Copywriter, Visual Designer: shared.
6. **Permissions** — in Brand Guard and Publisher settings, allow the approvers named in `protocol.md`
   to instruct them (default: agents answer only their owner).
7. **Group** the rooms under "Clients", then capture `#<client>-work` as a template for the next client.

The approvals room name must match `rooms.approvals` in `brand-kits/<client>/client.json` —
that is how the Publisher knows which client a Telegram reply belongs to.

## Telegram

1. `@BotFather` → `/newbot`, keep the token in a password manager (never in this repo or a room).
2. `/mybots` → Bot Settings → Group Privacy → **Turn off** — before adding the bot to any group.
3. Switch Console → Messaging apps → Connect → Telegram.
4. Ask every client approver to set a Telegram @username — Switch identifies people by it,
   and it must match `protocol.md`.

## Publisher agent

The Publisher (`services/publisher`) is a custom Switch agent named `bolo-publisher`. It connects
over Switch's agent WebSocket, listens in every room it's invited to, and acts on approvals-room
messages:

| Client types | Publisher does |
|---|---|
| `approve` (one post waiting) or `approve #ref` | Checks the sender's Telegram username against `protocol.md`, schedules in Postiz, replies “Scheduled ✅” |
| `change #ref: <what>` | Sends the post back to production, replies “Noted …” |
| anything else | Nothing |

Setup (once): `npm run switch:register -- --local`, restart the Publisher, then in the group
`!invite-agent @bolo-publisher`. Full steps: [docs/setup.md](../docs/setup.md#4-connect-switch-telegram--publisher).

For testing without Telegram there's an HTTP relay:

```bash
curl -X POST http://localhost:4100/switch/messages \
  -H "content-type: application/json" \
  -H "x-bolo-secret: $PUBLISHER_WEBHOOK_SECRET" \
  -d '{"room":"Pushpam × 7P Approvals","author":"@pathankamran_03","text":"approve"}'
```
