# Agents

Each file is the instruction set pasted into that agent's settings in Switch Console.
The header lines (`Role`, `Built with`, `Job`) are also read by the dashboard's Agents view.

| Agent | Role | Runs on |
|---|---|---|
| Strategist | Single-holder | Claude Code |
| Copywriter | Shared | Claude Code |
| Visual Designer | Shared | Claude Code + Playwright |
| Reel Producer | Single-holder | Claude Code + Remotion |
| Brand Guard | Single-holder | Codex (independent review) |
| Publisher | Single-holder | `services/publisher` (custom agent) |

Single-holder roles guarantee one owner at a time — a post can never be scheduled twice,
and if a laptop running Brand Guard closes, another agent picks the role up.
