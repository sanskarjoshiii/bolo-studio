# Rules

## Never
- Hype words ("game-changer", "revolutionary", "10x")
- More than 3 hashtags on LinkedIn

## Always
- One concrete number or lesson per post

## Automated checks
```bolo-checks
{
  "banned": ["game-changer", "revolutionary", "10x"],
  "maxHashtags": { "linkedin": 3, "instagram": 8 }
}
```
