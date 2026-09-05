# End-to-End Browser Smoke Script

Ordered script for an automated browser agent (or a human with a stopwatch). One pass covers: first load → workout → daily-quest progress → meal → water → prayer check-off → **level-up** → persistence.

**Design notes for the agent**

- Selectors are described by visible text/role because the UI is still being built — locate controls by their labels, not by CSS classes.
- The XP ledger below is deterministic **only if the steps run in this exact order on a fresh profile**. Every checkpoint states the expected running total.
- XP ledger: workout 45 min = 25 + 45 = **+70** · quest exercise complete = **+15** · meal logged = **+5** · water logged (first of day) = **+5** · Fajr on-time = **+25**. Running totals: 70 → 85 → 90 → 95 → **120**. Level 2 requires 100 XP, so the level-up fires on the prayer step (step 16).
- The 650-kcal meal is deliberately far below the 1,980–2,420 calorie-goal window (±10% of the 2,200 default) so the +30 bonus cannot fire and skew the ledger.
- If any assertion fails, capture a screenshot, dump `localStorage.getItem('arise-system-v1')`, and stop — later steps depend on earlier state.

**Precondition:** dev server running; note the base URL (e.g. `http://localhost:3000`). Run in a fresh browser context.

---

## Steps

1. **Reset state.** Navigate to the base URL. Open DevTools console (or use CDP `Runtime.evaluate`) and run `localStorage.clear()`, then hard-reload.
   **Assert:** page loads with HTTP 200; no uncaught exceptions or React hydration warnings in the console.

2. **First-load status window.** On `/` (dashboard), locate the status/player panel.
   **Assert:** shows Level **1**, Rank **E**, hunter name **"Hunter"**, XP progress **0 / 100** (or a 0% bar), and four stats (strength / vitality / discipline / faith) each showing **10**.

3. **Navigation sweep.** Click through nav links to `/training`, `/nutrition`, `/health`, `/worship`, `/settings`, and back to `/`.
   **Assert:** each page renders a heading matching its feature (training/quest, nutrition, health, worship/prayer, settings); no console errors accumulate.

4. **Log a workout.** On `/training`, fill the workout form: name `Smoke Bench`, type **strength**, sets `3`, reps `10`, weight `60`, duration `45` (minutes). Submit.
   **Assert:** entry "Smoke Bench" appears in the workout history; an XP notice appears containing **+70**.

5. **Verify workout XP applied.** Return to `/` (or read the header status).
   **Assert:** total XP is **70**; still Level 1 (bar 70/100); strength stat is now **11**.

6. **Complete one daily-quest objective.** On `/training`, find the Daily Quest panel (targets 100 push-ups / 100 sit-ups / 100 squats / 10 km). Add **100** to push-ups (one entry of 100, or use the increment control until the counter reads 100/100).
   **Assert:** push-ups row shows **100/100** and reads as complete (e.g. `[COMPLETE]`); XP notice **+15** appears. Other three objectives remain incomplete; no "DAILY QUEST COMPLETE" bonus fired.
   **Running total: 85.**

7. **No double award on overshoot.** Add **10** more push-ups.
   **Assert:** counter shows 110/100 (or clamps to 100 — either is acceptable); **no** additional XP notice; total XP still **85**.

8. **Mid-script persistence check.** Hard-reload `/training`.
   **Assert:** push-up progress and the "Smoke Bench" entry survived; total XP still **85**; the quest completion did not re-award.

9. **Log a meal.** On `/nutrition`, fill the meal form: name `Chicken & rice`, calories `650`, protein `45`, carbs `70`, fat `12`. Submit.
   **Assert:** meal listed under today with its macros; XP notice **+5**; day total shows **650** kcal against the 2,200 goal; **no** "+30 calorie goal" notice.
   **Running total: 90.**

10. **Log water.** On `/health`, log water intake `500` ml.
    **Assert:** water display shows **500 ml** progress toward 2,500 ml; XP notice **+5**.
    **Running total: 95.**

11. **Pre-level-up checkpoint.** Read total XP from the dashboard or header.
    **Assert:** exactly **95 / 100** toward Level 2. (If it is not 95, STOP — an unexpected award fired; dump state and report.)

12. **Prayer page loads times.** Navigate to `/worship`.
    **Assert:** all five prayers (Fajr, Dhuhr, Asr, Maghrib, Isha) are listed. If the network is available, each shows a time in `HH:mm` form and a countdown to the next prayer is ticking (value changes between two reads ~2 s apart). If the API is unreachable, a stale/offline indicator must be shown instead — check-off must still be available either way.

13. **Screenshot: pre-level-up.** Capture the worship page for the record.

14. **Check off a prayer — triggers LEVEL UP.** Mark **Fajr** as **on-time** (prayed).
    **Assert (in order):** XP notice **+25**; then a **level-up modal/ceremony appears announcing Level 1 → Level 2** (rank remains E). Faith stat will now be 11.
    **Running total: 120.**

15. **Screenshot: level-up modal.** Capture it while visible.

16. **Dismiss the level-up modal.** Click its confirm/close control.
    **Assert:** modal closes; page behind is interactive again.

17. **Post-level-up status.** Go to `/`.
    **Assert:** Level **2**, Rank **E**, XP progress **20 / 150**; stats read strength 11, vitality 11, discipline 10, faith 11 (workout +1 str, health-log day +1 vit, prayer +1 faith).

18. **Level-up does not re-fire.** Hard-reload `/`.
    **Assert:** the level-up modal does **not** reappear; Level 2 and 20/150 persist.

19. **Storage integrity audit.** In the console, run `JSON.parse(localStorage.getItem('arise-system-v1'))`.
    **Assert:** parses without error; `version` is `1`; `state.totalXp === 120`; `state.workouts` has 1 entry; `state.meals` has 1 entry; today's key exists in `state.dailyQuests` with `pushups >= 100` and `awarded.pushups === true`; today's `state.prayers` entry has `Fajr: "on_time"`; `state.healthLogs` for today has `waterMl` of 500.

20. **Offline prayer fallback.** Set the browser/network to **offline** (DevTools Network → Offline, or CDP `Network.emulateNetworkConditions`). Hard-reload `/worship`.
    **Assert:** prayer times still display (from cache) with a visible stale/offline indicator; no crash, no infinite spinner. Mark **Dhuhr** as on-time while offline.
    **Assert:** it registers (+25 notice, total 145) — check-off works offline.

21. **Restore network & final sweep.** Go back online. Reload `/worship`, then visit all six pages once more.
    **Assert:** live times return (stale indicator clears); every page renders with the accumulated state; the console shows no errors from the entire run.

22. **Mobile viewport spot-check.** Set the viewport to **375×812**. Visit `/` and `/training`.
    **Assert:** no horizontal scrolling; status window and quest checklist fully visible and operable; nav reachable. Capture one screenshot of each.

---

## Pass criteria

All 22 steps' assertions hold, with special weight on: the XP ledger checkpoints (steps 5, 7, 11, 17), the level-up firing exactly at step 14 and not re-firing at step 18, storage integrity (step 19), and offline check-off (step 20).

## Known non-blockers to expect

- A brief loading shell before persisted data appears after each hard reload (hydration guard) — acceptable; a *hydration error in the console* is not.
- The exact wording of XP notices may vary; assert on the `+N` amounts, not full sentences.
- If the AlAdhan API is down during the run, steps 12/21 degrade to the offline-fallback assertions; steps 14–20 are unaffected (prayer check-off never depends on the API).
