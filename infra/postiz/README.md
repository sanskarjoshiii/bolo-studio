# Postiz (self-hosted scheduler)

Postiz publishes to Instagram, Facebook, LinkedIn, YouTube, X and Threads through official OAuth.
The Publisher agent talks to its public API; nothing else in Bolo Studio needs Postiz.

```bash
bash infra/postiz/setup.sh          # clones the official compose stack into ./upstream
cd infra/postiz/upstream && docker compose up -d
```

The stack runs Postiz on <http://localhost:4007> plus Postgres, Redis and Temporal
(Temporal UI on <http://localhost:8080>). See `setup.sh` output for the remaining steps.

## Platform notes

| Platform | Note |
|---|---|
| Instagram | API publishing needs a Business/Professional account and media (image or video) on every post |
| Instagram | ~50 API-published posts per account per 24h; a carousel counts as one |
| Facebook Pages | Scheduled posts supported |
| LinkedIn | Company pages need app approval — a personal profile is easiest for the demo |
| YouTube | Needs a Google Cloud project; Shorts are vertical videos under 60s |

## Without Postiz

If `POSTIZ_API_KEY` is empty, or a channel has no `postizIntegrationId`, the Publisher runs in
**dry-run mode**: approvals are recorded and posts show as scheduled, but nothing is sent.
The dashboard labels these posts "dry run".

Media upload (`uploadMedia` in `@bolo/core`) is ready for the Visual Designer and Reel Producer
renders; until those land, Instagram posts will be rejected by Postiz for having no media.
