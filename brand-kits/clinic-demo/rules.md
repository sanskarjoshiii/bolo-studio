# Rules (Brand Guard checks every item)

## Never
- Cure or guaranteed-result claims ("permanent cure", "100% result")
- Before/after images
- Patient faces without a consent note
- Comparing with other clinics

## Always
- Doctor registration number in captions that give medical advice
- Max 8 hashtags on Instagram
- Emergency line on festival-safety posts

## Automated checks
```bolo-checks
{
  "banned": ["guaranteed", "100% result", "permanent cure", "best eye hospital"],
  "replace": { "cures": "helps with", "cure": "relief for" },
  "maxHashtags": { "instagram": 8 },
  "requireText": [{ "text": "Reg. No.", "label": "Doctor registration no. in caption" }]
}
```
