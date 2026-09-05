# Harness research (free-only)

Short memo for Yansha’s pluggable PLAN→BUILD→REVIEW harness. Patterns only — no restricted dependencies.

## Do not adopt

### workweave/router

- Public GitHub; marketed as a cost-cutting model router (`npx @workweave/router`, localhost proxy).
- License: **Elastic License 2.0 (ELv2)** — not OSI free. Readable source; redistribution/hosting restrictions.
- Layer: OpenAI/Anthropic/Gemini **API proxy** with per-action model scoring.
- Wrong fit for ChatGPT-login Codex + Google-login Antigravity (`agy`) subscription CLIs.
- **Verdict:** ideas OK; **do not vendor or depend on it.**

## Patterns worth copying (ideas only)

1. **Route by action/phase**, not one forever-smart model.
2. **Workers as plugins** — enable/disable without rewriting the orchestrator.
3. **Failover chains** when a provider or quota fails.
4. **Role-locked prompts** — planner ≠ coder; reviewer ≠ implementer.
5. **Observe decisions** — log which worker + model was chosen and why.

## Future optional (not this pass)

- **BitRouter** (Apache-2.0) — interesting if we ever route API keys. Too heavy for subscription-CLI orchestration today.
- Live vendor % scraping that burns quota — skip.
- Orb / daemon stacks — skip.

## What Yansha owns

The harness is **repo-native**:

| Piece | Role |
| --- | --- |
| `.agents/harness.json` | Workers registry + ranked phase chains + models |
| `scripts/run-bead-agent.ps1` | Walk chains, apply models, refuse bad routes |
| `scripts/yansha-orch.ps1` | Operator shortcuts + status |
| `scripts/usage-budget.ps1` | Informational launch telemetry + hard vendor quota locks (no local daily caps) |
| `.agents/skills/harness-head/` | Opt-in `/harness_head` control plane (any IDE) |
| `bd` (Beads) | Durable work queue — not the chat transcript |

**Free-only policy:** no ELv2 routers, no paid gateway required, no auto credit/overage purchases. Stay on existing ~$20 subscription CLIs + Freebuff + opt-in IDE head.
