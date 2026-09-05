# Agent Routing Policy (Yansha)

Opt-in harness head orchestrates. Workers execute by **phase** via `.agents/harness.json` succession chains. Codex reviews before close.

Companion: [cursor-orchestrator-prompt.md](./cursor-orchestrator-prompt.md) · [multi-agent-sop.md](./multi-agent-sop.md) · [harness-research.md](./harness-research.md) · [cursor-out-playbook.md](./cursor-out-playbook.md) · [yansha-orch.ps1](../../scripts/yansha-orch.ps1) · [harness-head skill](../../.agents/skills/harness-head/SKILL.md)

---

## Control plane (opt-in)

| Action | Effect |
| --- | --- |
| `/harness_head` | This chat becomes orchestrator (session only) |
| New chat | Harness **off** — normal IDE |
| `/harness_off` | Release head in current chat |
| Terminal only | `yansha-orch` works with no chat head |

---

## Pipeline

| Phase | Who (chain) | Command | Output |
| --- | --- | --- | --- |
| **PLAN** | Codex → Antigravity CLI plan-only → operator | `-Phase plan` | Plan artifact; head files 3–5 Beads |
| **BUILD** | cheap: Freebuff… · heavy/hard: Antigravity CLI… | `-Phase build` | Code + validation; **never close** |
| **REVIEW** | Codex → Antigravity advisory → operator | `-Phase review` | PASS/FAIL; sacred hold without Codex |
| **CLOSE** | Head after Codex PASS | `bd close` | Done + follow-up Beads if needed |

```text
.\scripts\yansha-orch.ps1 status
.\scripts\yansha-orch.ps1 plan -PlanTopic "..."
.\scripts\yansha-orch.ps1 build -FromReady -Claim
.\scripts\yansha-orch.ps1 review -BeadId <id>
```

---

## Role matrix

| Role | Owns | Does not own |
| --- | --- | --- |
| **Harness head** (any IDE + `/harness_head`) | Orchestration via `bd`, PLAN→Bead filing, micro-edits, launchers, close-after-PASS | Closing without Codex PASS; inventing work outside Beads; auto-claim on new chat |
| **Antigravity CLI (`agy`)** | Heavy/hard BUILD (sparing); PLAN/REVIEW failover | Final Quran/Hifz judgment; Bead closure; replacing IDE-as-builder for bulk work |
| **Freebuff CLI** | **Preferred cheap BUILD** | Sacred-content logic; architecture; REVIEW |
| **Codex CLI** | PLAN, REVIEW; BUILD only if Bead has `codex-build` | Bulk low-risk UI churn; burning quota on cheap tasks |

Antigravity **IDE** ≠ Antigravity **CLI**. Keep the CLI when using the IDE as head.

---

## BUILD route by Bead signal

PLAN and REVIEW walk harness chains (Codex first). Codex **BUILD** is refused unless the Bead includes `codex-build` (or `-EmergencyOverride`).

For BUILD (`-Agent auto`), harness picks **cheap / heavy / hard** chain:

| Signal (label, title, or body) | Chain kind | Preferred |
| --- | --- | --- |
| `quran`, `ayah`, `mushaf`, `hifz`, `scoring`, `aligner`, `asr`, `tajweed`, `whisper`, `recitation`, provenance | **hard** | Antigravity CLI → Freebuff → … then **Codex REVIEW** |
| `architecture`, `schema`, `auth`, risky sync, `hard`, `pro` | **hard** | Antigravity CLI (Pro model sparing) |
| Cross-file / scaffolding / `heavy` | **heavy** | Antigravity CLI |
| UI-only, copy, test scaffolding, mechanical renames, default feature work | **cheap** | **Freebuff** |
| One-file polish / inspect-only | **cheap** | may land on `cursor-local` |

### Sacred-content override

If a Bead touches Quran text / verse identity / offline coverage claims, Hifz scoring, forced alignment, mistake classification, or Tajweed/ASR verification:

1. Prefer Antigravity/Freebuff for implementation shell; Codex REVIEW is **mandatory and blocking**.
2. Non-Codex REVIEW is advisory — **do not close** (sacred hold).
3. Never treat Freebuff or Antigravity as final authority.

---

## Queue discipline

| Rule | Limit |
| --- | --- |
| Active ready/in-progress queue | **3–5** Beads |
| Built per pass | **1–2** Beads |
| Close without Codex PASS | **Never** (sacred: no non-Codex close without explicit override) |
| Follow-up work | New Bead — never implicit |

---

## Launch contract

1. Prefer `.\scripts\yansha-orch.ps1 ...` or `.\scripts\run-bead-agent.ps1 -Phase ...`.
2. Capture artifacts under `.agents/runs/`.
3. Run Bead Validation commands after BUILD.
4. Summarize: files, validations, risks, ready-for-review.
5. REVIEW → close only on PASS.

### Worker prompt payload (minimum)

- Exact Bead title + ID (BUILD/REVIEW)
- Why / Acceptance / Files / Validation / Do not touch (verbatim)
- Pointers: `AGENTS.md`, `CONSTITUTION.md`, this policy, `.agents/harness.json`
- Instruction: stop before `bd close`

---

## CLI resolution

Defaults (Windows) are hard-coded in the launcher; env overrides win:

| Env var | Purpose |
| --- | --- |
| `YANSHA_CODEX_EXE` | Absolute path to `codex.exe` |
| `YANSHA_AGY_EXE` | Absolute path to `agy.exe` |
| `YANSHA_FREEBUFF_EXE` | Absolute path / command for freebuff |
| `YANSHA_CODEX_CMD` | Full template with `{prompt}` (optional) |
| `YANSHA_ANTIGRAVITY_CMD` | Full template with `{prompt}` (optional) |
| `YANSHA_FREEBUFF_CMD` | Full template with `{prompt}` (optional) |

Built-in defaults:

- Codex: `%LOCALAPPDATA%\Programs\OpenAI\Codex\bin\codex.exe`
- Antigravity: `%LOCALAPPDATA%\agy\bin\agy.exe`
- Freebuff: `freebuff` on PATH

Disable a worker: `"enabled": false` in `.agents/harness.json` — router skips to next chain entry.

---

## Anti-patterns

- Closing because `tsc` / `next build` passed
- Trusting worker “done” without reading the diff / review artifact
- Letting Freebuff edit ayah identity or scoring formulas
- Expanding Bead scope mid-pass instead of filing a new Bead
- Creating markdown TODO lists while Beads is available
- Skipping PLAN and dumping a huge unscoped BUILD onto Antigravity
- Retrying Codex/Antigravity after a 5-hour or plan quota error
- Buying credits / enabling AI credit overages / switching to API billing without an explicit user request
- Auto-claiming harness head on every new chat / folder open
- Dual-writing the same Bead (IDE free-edit + CLI build)

## No-overcharge policy

Codex CLI (ChatGPT login) and Antigravity CLI share the user’s ~$20/mo IDE subscriptions.

When output matches usage-limit / RESOURCE_EXHAUSTED / weekly-limit / “purchase credits”:
1. Hard-lock that worker in `.agents/runs/quota-locks.json`
2. Tell the user immediately
3. Stop launching that worker until the lock expires
4. Fall back to Freebuff + harness succession (next chain entry)

There are no local daily caps. Launch counts in `.agents/runs/daily-usage.json` are informational telemetry only and never block a worker; only real vendor signals (5-hour window, weekly/monthly/plan quota, paid-credit prompt) stop one. We never buy credits or enable overages.

Check locks anytime: `.\scripts\yansha-orch.ps1 status`
