# Manual QA Gate — the every-10-Beads hands-on pass

The harness blocks new **PLAN** and **BUILD** launches once **10 Beads** have been closed since your last manual QA sign-off. **REVIEW is never blocked** — reviewing already-built work is fine; starting new work is what gets gated.

Goal: actually *feel* the software every so often, catch regressions early, and note what landed well.

This is the short repeatable script. The exhaustive case list lives in [test-plan.md](./test-plan.md); use that when you want depth, use this when the gate fires.

## 0. Check the gate

```powershell
.\scripts\yansha-orch.ps1 qa status
```

Shows `N of 10 beads since last manual QA`, when the last pass happened, and which Bead IDs are awaiting verification.

## 1. Start the app

```powershell
npm run dev
```

Open the printed URL. Watch the browser console the whole way through — console errors count as findings.

## 2. Walk the core surfaces (about 10 minutes)

Tick each one. "OK" means it renders, is interactive, and throws nothing in the console.

| # | Route | What to actually do |
|---|---|---|
| 1 | `/` | Landing/status window renders; level, rank, XP bar look sane (no `NaN`, no >100% bar). |
| 2 | `/hub` | Global command center loads; navigation to other realms works. |
| 3 | `/sahwa` | Realm overview renders; links into hifz / qaida / salah resolve. |
| 4 | `/sahwa/hifz` | Quran reader opens a surah; Arabic renders right-to-left with tashkeel; word-by-word inspector opens. |
| 5 | `/sahwa/hifz/qaida` | Noorani Qaida ladder shows lessons 1-17; open one lesson; letters/harakat render; audio plays. |
| 6 | `/sahwa/hifz` voice deck | Start a voice recitation attempt; mic permission prompt appears; recording starts and stops; a score or feedback comes back (or a clear "unavailable" state — never a silent hang). |
| 7 | `/sahwa/salah` | Prayer times / calendar render; marking a prayer persists across reload. |
| 8 | `/sahwa/arabic` | Kalam/Pimsleur studio loads; one lesson step advances. |
| 9 | `/nutrition` | Log one meal; day totals and XP update. |
| 10 | `/training` | Log one workout; quest progress increments. |
| 11 | `/health` | Log one metric; value persists across reload. |
| 12 | `/settings` | Change one setting; reload; it stuck. |

Then two cross-cutting checks:

- **Reload sweep:** hard-reload two or three of the pages you touched. No hydration errors, no data loss.
- **Mobile sweep:** DevTools device toolbar at 375 px wide on `/hub` and `/sahwa/hifz`. No horizontal scroll, nav reachable.

### Sacred-content spot check

Non-negotiable, per `AGENTS.md`:

- No ayah is substituted or invented when data is missing — missing data must show as missing.
- Offline Quran coverage is not overstated anywhere in the UI.
- Provenance labels on Quran text/audio are accurate.

Any violation here is a blocker, regardless of how the rest of the pass went.

## 3. Answer these four questions

Write the answers down — they go straight into the sign-off notes.

1. **Did anything break?** (crash, white screen, console error, dead button)
2. **What regressed?** (something that used to work and now does not)
3. **What felt good?** (what to keep and build on)
4. **What is missing or awkward?** (candidates for new Beads)

## 4. Sign off

```powershell
.\scripts\yansha-orch.ps1 qa signoff -Notes "Broke: qaida audio silent on lesson 4. Regressed: nothing. Good: hifz reader feels fast, voice scoring snappy. Awkward: /hub nav crowded on mobile."
```

If you found real problems, mark the verdict so it is recorded:

```powershell
.\scripts\yansha-orch.ps1 qa signoff -Verdict issues -Notes "..."
```

Sign-off resets the counter to `0 of 10`, stamps the timestamp, and appends the covered Bead IDs plus your notes to the history in `.agents/runs/qa-gate.json`.

**File the findings as Beads** (`bd create ...`) before queueing more work. Notes in the QA history are a record, not a backlog.

## Commands reference

```powershell
.\scripts\yansha-orch.ps1 qa status                       # N of 10, last QA, pending beads
.\scripts\yansha-orch.ps1 qa record -BeadId <id>          # head runs this right after every bd close
.\scripts\yansha-orch.ps1 qa check                        # exit 1 when the gate is due
.\scripts\yansha-orch.ps1 qa signoff -Notes "..."         # reset counter, record the pass
.\scripts\yansha-orch.ps1 build -FromReady -SkipQaGate    # emergency bypass, loud warning, counter untouched
```

Threshold lives in `.agents/harness.json` under `policy.manualQaGate.everyNClosedBeads`. Env overrides: `YANSHA_QA_GATE_EVERY_N`, `YANSHA_QA_GATE_DISABLED`.
