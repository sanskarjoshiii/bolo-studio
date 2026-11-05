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

## Automated checks
Brand Guard (and the dashboard) run these before a client ever sees a draft.
Anything not listed here is reviewed by the Brand Guard agent itself.

```bolo-checks
{
  "banned": ["guaranteed returns", "investment doubles", "best in pune"],
  "competitors": ["Skyline Habitat", "Greenleaf Homes"],
  "price": { "requireWord": "onwards", "alsoAccept": ["पासून", "से शुरू"], "footnote": "*T&C apply" },
  "requireRera": true,
  "maxHashtags": { "instagram": 8 },
  "requireCta": ["site visit"]
}
```
