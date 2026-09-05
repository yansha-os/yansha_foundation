<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Yansha Autonomous Directives
- **Database Engine:** Neon Postgres with Prisma. (We do **NOT** use Supabase).
- **Autonomous Schema Sync:** Always run `npx prisma db push` and `npx prisma generate` directly. You are fully authorized to execute database changes autonomously without asking the user or providing raw SQL.
- **Autonomous Execution:** Proactively write code, run builds, execute tests, and apply migrations directly.

## Quranic & Hifz Pedagogy Guardrails (Noorani Qaida to Full Hifz)
- **Zero-Assumption Starting Point:** Never assume non-Arabic speaking users know Arabic script, Tashkeel (Fatha, Dammah, Kasrah), or Tajweed rules by heart.
- **Canonical Noorani Qaida Ladder:** Structure the pre-Hifz pathway through the 17 classical lessons (Isolated Letters -> Compounds -> Harakat -> Tanween -> Sukoon/Qalqalah -> Noon/Meem Sakinah -> Shaddah/Ghunnah -> Madd -> Waqf).
- **Embedded Tajweed Doctrine:** Tajweed rules must be integrated into reading and memorization workflows (interactive Ayah inspector, real-time acoustic voice checks) rather than isolated into detached tabs.
- **Voluntary Worship Only (hard rule):** The heuristic engine and any cross-module adaptation may adjust only *voluntary* practice (Manzil review volume, dhikr targets, optional reading time). Never adapt obligatory prayer (Salah) or Zakat — not schedule, target, reminder, or calculation. See [`CONSTITUTION.md`](./CONSTITUTION.md) §11.
- **Prayer Data Is Never Shared:** `salah` is not a grantable sharing scope anywhere (schema defaults, validation, UI toggles, server actions). Prayer records never reach a circle, teacher, guild, or leaderboard. See [`CONSTITUTION.md`](./CONSTITUTION.md) §12.
- **Clear Domain Boundaries:**
  - `/sahwa/hifz`: The Noble Quran Reader (114 Surahs), Noorani Qaida Foundation Ladder (Lessons 1-17), and Hifz Voice Mastery Hub (3-Pillars: Sabaq, Sabqi, Manzil + AI Voice Reciter).
  - `/sahwa/arabic`: Kalam & Pimsleur Conversational Fus'ha Language Studio.
- **Interactive Articulation & Vocal Tract Standards:**
  - **Parametric Anatomy Rig**: Vocal tract diagrams for Makharij must use parametric sagittal vector profiles (jaw, lips, 3-point tongue spline [tip/center/root], velum/uvula, larynx) with smooth coordinate interpolation.
  - **Audio-Visual Synchrony**: Every phoneme movement must bind to audio playback with real-time waveform or particle visualization of airflow (oral vs nasal).
  - **Dual Interaction Modes**: Support both guided phoneme presets and a manual anatomical control deck for exploratory learning.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:970c3bf2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   bd dolt push
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->

<!-- BEGIN BEADS CODEX SETUP: generated by bd setup codex -->
## Beads Issue Tracker

Use Beads (`bd`) for durable task tracking in repositories that include it. Use the `beads` skill at `.agents/skills/beads/SKILL.md` (project install) or `~/.agents/skills/beads/SKILL.md` (global install) for Beads workflow guidance, then use the `bd` CLI for issue operations.

### Quick Reference

```bash
bd ready                # Find available work
bd show <id>            # View issue details
bd update <id> --claim  # Claim work
bd close <id>           # Complete work
bd prime                # Refresh Beads context
```

### Rules

- Use `bd` for all task tracking; do not create markdown TODO lists.
- Run `bd prime` when Beads context is missing or stale. Codex 0.129.0+ can load Beads context automatically through native hooks; use `/hooks` to inspect or toggle them.
- Keep persistent project memory in Beads via `bd remember`; do not create ad hoc memory files.

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.
<!-- END BEADS CODEX SETUP -->

## Multi-Agent SOP

**Harness head is opt-in per chat.** New chats start with harness **off** (normal IDE use). To claim control plane in **this** chat only: `/harness_head`. To release: `/harness_off`. Skill: [`.agents/skills/harness-head/SKILL.md`](./.agents/skills/harness-head/SKILL.md). Do not auto-activate on folder open.

Workers (CLIs): Codex, Antigravity (`agy`), Freebuff. Config: [`.agents/harness.json`](./.agents/harness.json). Operate through `bd` only.

- SOP: [docs/process/multi-agent-sop.md](./docs/process/multi-agent-sop.md)
- Routing: [docs/process/agent-routing-policy.md](./docs/process/agent-routing-policy.md)
- Research (free-only): [docs/process/harness-research.md](./docs/process/harness-research.md)
- Any-IDE head playbook: [docs/process/cursor-out-playbook.md](./docs/process/cursor-out-playbook.md)
- Durable prompt: [docs/process/cursor-orchestrator-prompt.md](./docs/process/cursor-orchestrator-prompt.md)
- Launcher: [`scripts/run-bead-agent.ps1`](./scripts/run-bead-agent.ps1)
- Shortcuts: [`scripts/yansha-orch.ps1`](./scripts/yansha-orch.ps1)

Pipeline: **PLAN (Codex) → BUILD (Freebuff / Antigravity CLI) → REVIEW (Codex) → CLOSE (head on PASS)**.

- Keep only `3-5` active Beads queued at once.
- Every implementation task must exist as a Bead before code changes begin.
- Implement at most `1-2` Beads per pass, then stop for Codex review.
- Codex is the required review gate before a Bead is closed.
- Close Beads only after acceptance criteria, listed validation commands, and Codex approval.
