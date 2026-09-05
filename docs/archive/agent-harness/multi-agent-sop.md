# Yansha Multi-Agent SOP

## Summary
- Keep an active queue of `3-5` Beads.
- Every implementation task must exist as a Bead before BUILD begins.
- BUILD at most `1-2` Beads per pass, then stop for REVIEW.
- A Bead is only closed after validation passes and **Codex REVIEW** returns PASS.

## Pipeline
**PLAN (Codex) → BUILD (Freebuff / Antigravity CLI) → REVIEW (Codex) → CLOSE (harness head on PASS)**

## Control plane
Harness head is **opt-in per chat**: `/harness_head` to claim, `/harness_off` to release, **new chats default off**. See [cursor-out-playbook.md](./cursor-out-playbook.md) and [`.agents/skills/harness-head/SKILL.md`](../../.agents/skills/harness-head/SKILL.md).

## Companion docs
- Harness config: [`../../.agents/harness.json`](../../.agents/harness.json)
- Research (free-only): [`harness-research.md`](./harness-research.md)
- Worker routing: [`agent-routing-policy.md`](./agent-routing-policy.md)
- Cursor system prompt: [`cursor-orchestrator-prompt.md`](./cursor-orchestrator-prompt.md)
- Phase launcher: [`scripts/run-bead-agent.ps1`](../../scripts/run-bead-agent.ps1)
- Shortcuts: [`scripts/yansha-orch.ps1`](../../scripts/yansha-orch.ps1)

## Roles
- `Codex` (CLI): PLAN, REVIEW, BUILD only with `codex-build` label, **required review gate**.
- `Antigravity` (CLI / `agy`): heavy/hard BUILD, PLAN/REVIEW failover — not the IDE chat.
- `Freebuff` (CLI): preferred cheap BUILD.
- `Harness head` (any IDE + `/harness_head`): `bd` coordination, filing Beads from PLAN, polish, launch `yansha-orch`, close-after-PASS.

The head is **not** the final authority on Quran correctness.

## Daily Loop
1. If the queue is thin: head runs PLAN → files `3-5` atomic Beads from the artifact.
2. Head runs `yansha-orch build -FromReady -Claim` (max 1–2 per pass).
3. Head verifies files + validation output; prepares REVIEW.
4. Head runs `yansha-orch review -BeadId <id>`.
5. Close only on PASS; file follow-ups as new Beads.
6. Immediately after each `bd close`, head runs `yansha-orch qa record -BeadId <id>`.

## Manual QA gate (every 10 closed Beads)

Closing Beads is not the same as knowing the app still works. Every `10` closed Beads (configurable at `policy.manualQaGate.everyNClosedBeads` in [`../../.agents/harness.json`](../../.agents/harness.json)), the launcher **hard-stops new PLAN and BUILD work** until the human runs the app and signs off. **REVIEW is never gated** — reviewing already-built work is always allowed.

- The counter is **not** hooked into `bd`. The head **must** run `yansha-orch qa record -BeadId <id>` right after every `bd close`, or the gate never fires.
- When the gate fires, the head stops queueing work and hands the user [`../qa/manual-qa-gate.md`](../qa/manual-qa-gate.md).
- Sign-off resets the counter and records timestamp, covered Bead IDs, verdict, and notes in `.agents/runs/qa-gate.json`.
- Findings become new Beads before more work is queued.
- `-SkipQaGate` exists as an emergency bypass. It prints a loud warning, does not reset the counter, and is the **user's** call — never the head's.

```powershell
.\scripts\yansha-orch.ps1 qa status
.\scripts\yansha-orch.ps1 qa record -BeadId <id>
.\scripts\yansha-orch.ps1 qa signoff -Notes "what broke / what felt good" [-Verdict issues]
```

### Operator shortcuts
```powershell
.\scripts\yansha-orch.ps1 status
.\scripts\yansha-orch.ps1 plan -PlanTopic "Next slice"
.\scripts\yansha-orch.ps1 build -FromReady -Claim
.\scripts\yansha-orch.ps1 review -BeadId <id>
```

See `cursor-orchestrator-prompt.md` for planning / implementation / batch / review chat snippets.

## Bead Template
```txt
Title:
Short action-oriented task name

Why:
What problem this solves and why it exists now

Acceptance:
- Clear observable outcome 1
- Clear observable outcome 2
- No regressions in named flow

Files likely touched:
- path/a
- path/b

Validation:
- npm run lint -- --quiet
- npx tsc --noEmit --pretty false
- npm test
- any feature-specific command

Do not touch:
- unrelated UI
- auth
- database schema
```

## Review and Closure
- Builds compiling is not sufficient for closure.
- Codex REVIEW must check correctness risks, Quran/Hifz data integrity, scoring accuracy, unintended behavior changes, and missing tests.
- If review finds blocking issues, keep the Bead open and return it for correction unless the repair is clearly a separate task.
- Follow-up work should be filed as new Beads instead of being left implicit.
- Freebuff and Antigravity must never be the final judge on Quran/Hifz correctness.

## Defaults
- Active queue size: `3-5` Beads.
- Required review gate: `Codex REVIEW` PASS.
- `bd` is the single source of truth for task tracking.
- Queue only the next slice of work, not the full roadmap.
- Use conservative closure: PLAN → BUILD → validate → REVIEW → close.
