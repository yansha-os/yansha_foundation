# QA Test Plan — Self Health ("Arise" System App)

> Looking for the short repeatable pass the harness forces every 10 closed Beads? See [manual-qa-gate.md](./manual-qa-gate.md). This document is the deep case list.

Manual test checklist, organized by feature area. Each case has an ID, steps, and an expected result. Execute top-to-bottom within a section; sections are independent unless noted.

**Implementation facts this plan asserts against** (verified in `lib/` as of writing — re-verify if the build changed):

- Persistence: Zustand `persist`, localStorage key **`arise-system-v1`**, schema `version: 1`.
- XP cost to go from level *n* to *n+1*: `100 + (n−1)×50` (100, 150, 200, …). Cumulative XP to *reach* level *n* = `25(n−1)(n+2)`.
  - Level 2 = 100 XP · L3 = 250 · L4 = 450 · L5 = 700 · **L10 = 2,700** · **L20 = 10,450** · **L30 = 23,200** · **L40 = 40,950** · **L50 = 63,700**.
- Ranks by level: E 1–9 · D 10–19 · C 20–29 · B 30–39 · A 40–49 · S 50+.
- XP awards: workout 25 + 1/min (minute bonus capped at 60) · daily-quest exercise 15 each · full-quest bonus 100 · meal logged 5 · calorie goal met (day total within ±10% of goal, once/day) 30 · health metric logged 5 each (once/day/metric) · prayer on-time 25 · prayer late 10 · all-five-prayers bonus 50.
- Default settings: calorie goal 2,200 · protein 140 g · water 2,500 ml · quest targets 100/100/100/10 km · city Mecca / Saudi Arabia · method 4 (Umm Al-Qura).
- Prayer times: AlAdhan `timingsByCity`, 10 s timeout, cached per (date, city, country, method); on fetch failure the last cache is shown with a stale/offline indicator.

**Test rig prerequisites**

- Chrome/Edge DevTools (Application → Local Storage, Network → Offline/throttling), plus one WebKit browser (Safari or iOS) for hydration and quota behavior.
- Ability to change the OS clock (midnight-rollover and DST cases) — close and reopen the tab after changing the clock.
- Snippets used below (run in DevTools console):

```js
// Read current persisted state
JSON.parse(localStorage.getItem('arise-system-v1'))

// Corrupt the blob (PERS-04)
localStorage.setItem('arise-system-v1', '{"state": {"totalXp": 500, "corrupt...')

// Simulate future schema version (PERS-05)
const b = JSON.parse(localStorage.getItem('arise-system-v1'));
b.version = 99; localStorage.setItem('arise-system-v1', JSON.stringify(b));

// Seed XP near a boundary (XP-03) — set, then reload
const s = JSON.parse(localStorage.getItem('arise-system-v1'));
s.state.totalXp = 2699; localStorage.setItem('arise-system-v1', JSON.stringify(s));

// Backfill a streak (STK-02) — mark yesterday's prayers complete
const p = JSON.parse(localStorage.getItem('arise-system-v1'));
const y = new Date(Date.now() - 864e5).toISOString().slice(0,10);
p.state.prayers[y] = {Fajr:'on_time',Dhuhr:'on_time',Asr:'on_time',Maghrib:'on_time',Isha:'on_time'};
localStorage.setItem('arise-system-v1', JSON.stringify(p));
```

---

## 1. First load, SSR & hydration

### HYD-01 — Clean first load
**Steps:** Clear site data (DevTools → Application → Clear site data). Load `/`. Watch the console.
**Expected:** Page renders without errors. No React hydration warnings ("Text content does not match server-rendered HTML", "Hydration failed", error #418/#423). A brief loading shell is acceptable; defaults then appear (Level 1, Rank E, 0 XP, hunter name "Hunter").

### HYD-02 — Hydration with existing data
**Steps:** Use the app (log a workout, earn XP). Hard-reload (Ctrl+Shift+R) each page: `/`, `/training`, `/nutrition`, `/health`, `/worship`, `/settings`. Watch the console on each.
**Expected:** No hydration mismatch warnings on any page. Real data replaces the loading shell after mount; no flash of *wrong* data (e.g. Level 1 flashing before the true level is fine only if it's a neutral placeholder, not a misleading value presented as real).

### HYD-03 — JS disabled / SSR shell sanity
**Steps:** DevTools → Ctrl+Shift+P → "Disable JavaScript". Reload `/`.
**Expected:** Server-rendered shell appears (layout, headings) without crashing. No raw error page. (Data panels may remain in loading state — acceptable.)

### HYD-04 — Direct deep-link to every route
**Steps:** In a fresh tab, navigate directly (address bar, not client nav) to each of the six routes.
**Expected:** Each route server-renders and hydrates cleanly. No 404s, no crash from reading `localStorage` during SSR.

---

## 2. Persistence & data resilience (highest priority)

### PERS-01 — Round-trip across reload
**Steps:** Log one workout, one meal, water 500 ml, and mark one prayer. Note total XP, level, stats. Reload every page.
**Expected:** All entries, XP, level, stats, and settings identical after reload. localStorage key `arise-system-v1` contains them (verify with the read snippet).

### PERS-02 — Round-trip across browser restart
**Steps:** Repeat PERS-01 but fully quit and reopen the browser.
**Expected:** Same — nothing lost.

### PERS-03 — Persistence of every slice
**Steps:** Touch every feature once (settings change, workout, quest progress, meal, all four health metrics, prayer statuses, prayer-times cache present). Reload. Inspect the blob.
**Expected:** `state` contains `settings, totalXp, stats, workouts, dailyQuests, meals, healthLogs, prayers, prayerAwards, dailyAwards, prayerTimesCache` with the values just entered. `notices`/`levelUpQueue` may persist too; if the level-up modal was dismissed it must NOT reappear after reload.

### PERS-04 — Corrupt blob must not silently destroy data ⚠️ CRITICAL
**Steps:** Build up real data (several entries, level ≥ 2). Copy the blob to a text file (manual backup). Run the corruption snippet above. Reload the app. Then perform one action (e.g. log water).
**Expected (per spec — `docs/context/` hard constraint "never wipe on parse failure"):** The app must NOT permanently destroy the user's data. Acceptable: preserve the unreadable blob (e.g. copy to a backup key) and inform the user; unacceptable: silently show a fresh Level-1 state whose first write overwrites the corrupt blob, erasing everything.
**Known risk:** Zustand persist's default behavior on parse failure is exactly the unacceptable path (fall back to defaults, overwrite on next write). If that's what happens, file as a **release-blocking bug**, not a pass.

### PERS-05 — Future/unknown schema version
**Steps:** Run the version-99 snippet. Reload. Perform one action.
**Expected:** Same criterion as PERS-04. Zustand discards stored state when the version is newer and no migration path exists — verify the raw data survives somewhere or a warning is shown. Data silently reset = bug.

### PERS-06 — Partially valid blob (missing keys / wrong types)
**Steps:** Edit the blob: delete `state.meals`, set `state.totalXp` to `"abc"`, set `state.stats` to `null`. Reload. Visit every page.
**Expected:** No page crashes (no white screen / unhandled exception). App either repairs missing fields with defaults or degrades gracefully. XP/level display must not show `NaN`.

### PERS-07 — Reset must be deliberate
**Steps:** Find the reset action (Settings). Trigger it.
**Expected:** A confirmation step is required (no single-click wipe). After confirming, state returns to defaults and localStorage reflects the reset. Cancel path leaves data untouched.

### PERS-08 — Multi-tab behavior
**Steps:** Open the app in two tabs. Log a meal in tab A. Switch to tab B (do not reload); log water in tab B. Reload both.
**Expected (document actual behavior):** Zustand persist does not sync across tabs, so tab B's write may clobber tab A's meal (last writer wins, whole-blob overwrite). Verify whether the meal from tab A survived. If it's lost, log severity per team judgment — at minimum this must not corrupt the blob or crash.

### PERS-09 — localStorage quota exhaustion
**Steps:** In console, fill storage: `try { localStorage.setItem('filler', 'x'.repeat(4*1024*1024)) } catch(e) { console.log(e) }` — repeat with more keys until `QuotaExceededError`. Then log a meal in the app.
**Expected:** The app does not crash. Ideally the user is warned that saving failed; silently pretending to save (state OK in memory, gone after reload) is a bug — verify by reloading. Clean up filler keys after.

### PERS-10 — Private/incognito mode
**Steps:** Open the app in an incognito window (and Safari private mode if available). Use it; reload within the session.
**Expected:** Works within the session; persists across reload within the same incognito session. No crash on storage restrictions.

---

## 3. Dashboard / Status Window (`/`)

### DASH-01 — Status window contents
**Steps:** Load `/` with known state (e.g. 120 XP).
**Expected:** Shows hunter name, Level 2, Rank E, XP progress "20 / 150" (or equivalent bar fraction 20÷150), and the four stats (strength/vitality/discipline/faith). Numbers match the persisted state exactly.

### DASH-02 — XP progress bar math
**Steps:** Seed `totalXp` to 250 (start of L3) and to 449 (1 XP before L4). Reload each time.
**Expected:** At 250: Level 3, progress 0/200. At 449: Level 3, progress 199/200, bar visually nearly full. Never shows >100% or negative.

### DASH-03 — Notices feed
**Steps:** Perform 3 XP-earning actions. Check the notice feed/toasts.
**Expected:** Each action produced an "XP ACQUIRED / +N XP" notice with the correct amount and reason. Dismissing a notice removes it and it stays dismissed after reload. Feed is capped (max 30) — no unbounded growth.

### DASH-04 — Today summary consistency
**Steps:** Log a meal (650 kcal), water 500 ml, and 50 push-ups of quest progress. Return to `/`.
**Expected:** Any dashboard summaries (calories today, water today, quest progress) agree with the source pages exactly.

---

## 4. Training & Daily Quest (`/training`)

### TRN-01 — Log a workout
**Steps:** Log workout: name "Bench", type strength, 3×10, 60 kg, 45 min.
**Expected:** Entry appears in history with all fields. XP +70 (25 base + 45 min). Strength stat +1. Notice shown.

### TRN-02 — Workout minute-bonus cap
**Steps:** Log a workout with duration 120 min. Log another with duration 0 / blank.
**Expected:** 120 min → XP +85 (25 + capped 60). Blank/0 duration → XP +25. No NaN.

### TRN-03 — Cardio/flexibility maps to vitality
**Steps:** Log a cardio workout.
**Expected:** Vitality +1 (not strength).

### TRN-04 — Delete workout
**Steps:** Note total XP. Delete the workout logged in TRN-01.
**Expected:** Entry removed from history and stays removed after reload. **XP is intentionally NOT revoked** (spec: never delete earned XP) — total XP unchanged. Verify the UI doesn't imply otherwise.

### QST-01 — Quest progress increments and per-exercise XP
**Steps:** With default target 100 push-ups, add progress 30, then 30, then 40.
**Expected:** Counter shows 30 → 60 → 100 in `[n/100]` style. On reaching 100, +15 XP fires **once**. Adding 10 more push-ups (110/100) grants no additional per-exercise XP.

### QST-02 — Full-quest completion bonus
**Steps:** Complete all four targets (push-ups, sit-ups, squats, 10 km run).
**Expected:** On the last target: +15 for that exercise AND +100 "DAILY QUEST COMPLETE" bonus (exactly once), discipline +2, completion notice. Total for a full quest from zero = 4×15 + 100 = 160 XP.

### QST-03 — Quest state survives reload mid-day
**Steps:** At 60/100 push-ups, reload.
**Expected:** Still 60/100. Completing later still awards correctly (no double award, no lost award).

### QST-04 — Midnight rollover resets the quest ⚠️
**Steps:** Complete today's quest. Set OS clock to tomorrow 00:05 (or wait across midnight with the tab open — test BOTH). Revisit `/training`.
**Expected:** Quest shows 0 progress for the new day; yesterday's completion is retained in history/streak. **Open-tab case:** if the page was left open across midnight, adding progress must land on the NEW day, and the UI must not show yesterday's completed quest as today's. Note any need to reload as a bug.

### QST-05 — Editing quest targets in Settings
**Steps:** Set push-up target to 20 in Settings. Add 20 push-ups → award fires. Now raise target to 200.
**Expected:** Raising the target after the award does not revoke XP; UI shows 20/200 not-complete. Lowering a target below existing progress: award fires on the *next* progress add (document actual behavior; no crash, no double XP).

### QST-06 — Zero/absurd quest targets
**Steps:** Set ALL four targets to 0. Add 1 push-up.
**Expected:** No nonsensical instant "DAILY QUEST COMPLETE" +100 bonus for doing nothing. (Code risk: all targets ≤ 0 makes `allDone` vacuously true — if the bonus fires, file a bug.) Also try a negative target and a 1,000,000 target: inputs should be clamped/validated, UI must not break.

### QST-07 — Fractional run progress
**Steps:** Add run progress 0.1 km ten times, then 9 km.
**Expected:** Shows 10.00/10 (2-decimal rounding, no 0.9999… artifacts); award fires at ≥ 10.

---

## 5. Nutrition (`/nutrition`)

### NUT-01 — Log a meal
**Steps:** Log "Chicken & rice", 650 kcal, 45 p / 70 c / 12 f.
**Expected:** Entry listed under today with macros. +5 XP. Day totals update (650 kcal, 45 g protein …).

### NUT-02 — Calorie-goal award window (±10%)
**Steps:** Goal 2,200 (default). Log meals totaling 1,900 kcal (below 1,980 = 90%) — no bonus. Add a 150-kcal meal (total 2,050, within window).
**Expected:** +30 "Calorie goal reached" fires exactly once for the day, vitality +1. Log another meal (total 2,600, above 110%): the earlier award is NOT revoked.

### NUT-03 — Overshooting skips the window
**Steps:** Fresh day (or new date). Log one giant 3,000-kcal meal.
**Expected:** No calorie-goal bonus (jumped straight past the window). Document this as expected behavior; UI should still render totals sanely over goal.

### NUT-04 — Delete meal
**Steps:** Delete a meal.
**Expected:** Removed from list and totals recalculate. XP not revoked (by design). If the deleted meal was what earned the calorie-goal award, the award flag remains — verify no crash and note the behavior.

### NUT-05 — Input validation
**Steps:** Try: negative calories, 0 kcal, 99,999 kcal, non-numeric text in numeric fields, empty name, 500-char name.
**Expected:** Invalid values rejected or clamped; no NaN in totals; no layout break from long names (truncation/wrap).

### NUT-06 — Day boundary for meals
**Steps:** Log a meal, then set the clock past midnight and log another ("suhur" scenario).
**Expected:** Each meal is attributed to the calendar day it was logged on; day totals split accordingly. Yesterday's meals remain visible in history.

---

## 6. Health metrics (`/health`)

### HLT-01 — Log each metric
**Steps:** Log weight 80 kg, water 500 ml, sleep 7.5 h, steps 8,000.
**Expected:** Each first-of-day metric log = +5 XP (4 metrics = 20 XP total), vitality +1 (once per day). Values render on the page and persist across reload.

### HLT-02 — Water accumulation vs overwrite
**Steps:** Log water 500 ml, then log water again (another 500).
**Expected:** Determine and verify intent: UI should make it unambiguous whether the second entry adds (total 1,000) or replaces. Progress vs the 2,500 ml goal reflects the shown total. No double XP for the second log.

### HLT-03 — Same-day re-log gives no extra XP
**Steps:** Update weight twice in one day.
**Expected:** Value updates; XP granted only for the first log of that metric that day.

### HLT-04 — Absurd inputs
**Steps:** Weight 0 / −5 / 1,000 kg; sleep 25 h / −1 h; steps 10,000,000; water −500 ml.
**Expected:** Clamped or rejected (water is clamped to ≥ 0 in the store — verify UI agrees). Charts/history must not break on outliers.

### HLT-05 — History/trend rendering
**Steps:** Seed several days of health logs (console snippet or clock changes). View trends.
**Expected:** Days with no data show as gaps/zero, not crashes. Dates labeled correctly (no off-by-one from timezone parsing).

---

## 7. Worship / Prayers (`/worship`)

### WOR-01 — Five prayers listed with times
**Steps:** With network online and default settings (Mecca, method 4), open `/worship`.
**Expected:** Fajr, Dhuhr, Asr, Maghrib, Isha each show a time (HH:mm, no "(AST)"-style suffix leaking through). A live/fetched indicator or at least no stale warning.

### WOR-02 — Countdown to next prayer
**Steps:** Compare the countdown to `(next prayer time − now)` by hand.
**Expected:** Matches within a few seconds, ticks down every second, format `HH:MM:SS`. After the moment passes, countdown moves to the *next* prayer without reload. After Isha, shows "Fajr (tomorrow)" using tomorrow's date (remaining time > 0, not negative).

### WOR-03 — Mark prayer statuses + XP
**Steps:** Mark Fajr on-time, Dhuhr late, Asr missed.
**Expected:** Fajr +25 XP and faith +1; Dhuhr +10 XP, no faith; Asr no XP. Statuses persist across reload. **Copy check (spec compliance):** the missed-prayer message must be respectful — per `docs/context/islamic-prayer-reference.md`, NO penalty/shame theming for prayers. If a red "SYSTEM WARNING / recover your discipline"-style notice appears for a missed prayer, flag as a spec-compliance bug.

### WOR-04 — Status edits never double-award or revoke
**Steps:** Mark Maghrib on-time (+25). Change it to late, then back to on-time.
**Expected:** No additional XP on any edit (award flag is per prayer per day). No XP removed. Final status displayed correctly.

### WOR-05 — All-five bonus
**Steps:** Mark all five prayers as on-time or late (none missed).
**Expected:** +50 "All five prayers completed" exactly once; faith +1 and discipline +1. Then edit one prayer to missed: bonus is not revoked (by design) — verify no crash and no re-award when set back.

### WOR-06 — Missed → made up later (qada flow)
**Steps:** Mark Fajr missed. Later change to late.
**Expected:** Late XP (+10) is granted (the award flag was never consumed by "missed"). The UI should present missed prayers as recoverable (make-up), not as permanent failures.

### WOR-07 — API failure fallback ⚠️
**Steps:** Load `/worship` once online (cache populated). DevTools → Network → Offline. Reload.
**Expected:** Yesterday's/last cached times display with a clear stale/offline indicator. **Prayer check-off must still work offline.** No infinite spinner, no crash.

### WOR-08 — API failure with no cache
**Steps:** Clear site data. Go offline. Load `/worship`.
**Expected:** Graceful empty state ("times unavailable") — manual check-off still available. No crash, no eternal spinner (10 s fetch timeout should surface the error state).

### WOR-09 — Slow/degraded API
**Steps:** DevTools → Network → throttle to Slow 3G. Reload `/worship`.
**Expected:** Loading indicator while fetching; page remains interactive; resolves to live times or falls back per WOR-07.

### WOR-10 — Settings change refetches
**Steps:** Change city to "Dearborn", country "US", method 2 (ISNA) in Settings. Return to `/worship`.
**Expected:** New fetch fires (see Network tab); times change to plausible Dearborn values. Cache in localStorage updates with the new city/method. Changing method alone also triggers refetch.

### WOR-11 — Invalid city
**Steps:** Set city to "Xyzzyville", country "US".
**Expected:** API error handled gracefully — stale-cache fallback or clear error message. Not a crash, not silently wrong times shown as live.

### WOR-12 — Midnight rollover of prayer day
**Steps:** With all five prayers marked today, cross midnight (clock or wait, tab open).
**Expected:** New day starts with all five unmarked; a fresh times fetch occurs for the new date (cache is keyed by date). Yesterday's marks are preserved in history/streak. Open-tab behavior must not require a manual reload to reset — note if it does.

### WOR-13 — Device timezone vs city timezone ⚠️
**Steps:** Set city to a distant timezone (e.g. city "Jakarta", country "Indonesia") while the device stays in local time. Observe times and countdown.
**Expected (document actual):** Times shown are Jakarta-local strings but the countdown treats them as device-local (known design limitation of `timeToday`). Assess: with a mismatched city, the countdown and "next prayer" can be wrong or negative. Must not crash; the countdown must never render a negative value. File severity per team judgment; at minimum Settings should nudge users to use their own city.

### WOR-14 — DST transition day
**Steps:** Set OS date to the local DST-change date (e.g. spring-forward day), reload, fetch times.
**Expected:** Times display correctly for that date; countdown math is consistent (no ±1 h jump mid-countdown); no crash around the nonexistent/repeated hour.

---

## 8. XP, levels, ranks (cross-cutting)

### XP-01 — Level-up modal at exact threshold
**Steps:** Fresh profile. Earn exactly 100 XP (e.g. workout 45 min = 70, meal +5, water +5, then Fajr on-time +25 → 105 crosses at the prayer).
**Expected:** Level-up modal/ceremony fires on the action that crosses 100, showing 1 → 2. Dismiss works; it does not reappear on reload.

### XP-02 — Multi-level single award
**Steps:** Seed `totalXp` to 95. Log a full daily quest completion in one final add (+115 possible: 15 + 100).
**Expected:** If one award crosses two thresholds (95 → 210 crosses L2@100... and approaches L3@250), the modal reports the correct from/to levels. Also seed 240 and add +160: 400 total = still L3 (needs 450 for L4) — exactly one level-up (2→3) shown, queue drains one at a time if multiple.

### XP-03 — Rank promotion boundary (E→D at level 10) ⚠️
**Steps:** Seed `totalXp = 2699` (Level 9, 1 XP short of L10). Reload — verify Level 9 / Rank E. Log a meal (+5).
**Expected:** Level 10 reached; rank changes E → D; the level-up event includes the rank change (ceremony should visibly celebrate the promotion, title "Rising Hunter"). Status window shows Rank D everywhere afterward.

### XP-04 — All rank boundaries
**Steps:** Repeat XP-03 pattern at each threshold: 10,449→10,450 (C), 23,199→23,200 (B), 40,949→40,950 (A), 63,699→63,700 (S).
**Expected:** Correct rank at/after each boundary; one below stays previous rank. Titles match: Elite / Vanguard / National-Level Hunter, Shadow Monarch at S.

### XP-05 — Level derivation is pure
**Steps:** Seed arbitrary `totalXp` values (0, 99, 100, 249, 250, 700, 2700) and reload each.
**Expected:** Displayed level always matches the formula (1, 1, 2, 2, 3, 5, 10). Level is derived, never stored — no way to desync.

### XP-06 — XP never decreases
**Steps:** Delete workouts/meals, change prayer statuses to missed, reset quest targets.
**Expected:** `totalXp` never goes down under any user action except full reset (PERS-07).

---

## 9. Streaks

### STK-01 — Streak counts consecutive complete days
**Steps:** Seed prayers complete for yesterday and the day before (console snippet). Today unmarked. View streak display.
**Expected:** Streak = 2. Today being incomplete does NOT break it (today is "in progress").

### STK-02 — Completing today extends
**Steps:** From STK-01, mark all five prayers today.
**Expected:** Streak = 3 immediately (no reload needed).

### STK-03 — Gap breaks streak
**Steps:** Seed complete days for D-3 and D-2, nothing for yesterday (D-1).
**Expected:** Streak = 0 (or 1 after completing today). The old run is not counted.

### STK-04 — Quest streak parallels prayer streak
**Steps:** Repeat STK-01–03 logic with `dailyQuests` (all non-zero targets met per day).
**Expected:** Same semantics; verify against lowered targets — a day qualifies against *current* targets (document: changing targets rewrites streak history interpretation; no crash).

### STK-05 — Rest-day forgiveness (spec requirement) ⚠️
**Steps:** Review `docs/context/` requirement: "rest days must not break streaks; auto-applied freezes; redemption quest". Attempt: build a 3-day quest streak, skip one day, check streak.
**Expected per spec:** Some forgiveness mechanic (configured rest day, auto-freeze, or repair) protects the streak.
**Known risk:** `lib/streaks.ts` implements no freezes or rest days — a skipped day zeroes the streak. If so, file as a **spec-gap bug** (this was Arise's #1 fairness complaint), not a pass.

### STK-06 — Midnight boundary
**Steps:** With a live streak, cross midnight without completing the new day.
**Expected:** Streak display stays at N (yesterday still counts; today in progress). It must not flash to 0 at 00:00.

---

## 10. Settings (`/settings`)

### SET-01 — Every setting persists and applies
**Steps:** Change hunter name, calorie goal, protein goal, water goal, all four quest targets, city, country, method, notifications toggle. Reload.
**Expected:** All values persist; dependent pages reflect them (dashboard name, nutrition goal ring, quest targets, worship refetch).

### SET-02 — Numeric validation
**Steps:** Calorie goal −100 / 0 / 100000; water goal 0; empty hunter name; 200-char hunter name.
**Expected:** Sane clamping/validation; downstream math (±10% window, water %) never divides by zero or shows NaN; long names don't break layout.

### SET-03 — Calculation method list
**Steps:** Open the method selector.
**Expected:** Human-readable method names (ISNA, MWL, Umm Al-Qura, …). Selecting each triggers a refetch and plausible time shifts (Fajr/Isha differ across methods; Dhuhr barely moves).

---

## 11. Responsive & mobile layout

### RESP-01 — Viewport sweep
**Steps:** DevTools device toolbar: 320×568 (iPhone SE), 375×812, 768×1024, 1280×800, 1920×1080. Visit all six pages at each size.
**Expected:** No horizontal scroll at 320 px; nav usable on mobile (menu reachable); panels stack; status window, quest checklist, prayer table, and charts all legible; no clipped System-window corners (`clip-path` panels) cutting off text.

### RESP-02 — Touch targets & modals on mobile
**Steps:** On a 375-px viewport: open the level-up modal (trigger via XP-01), dismiss it; operate quest +/- controls, prayer status buttons, forms.
**Expected:** Tap targets ≥ ~40 px; modal fits the viewport, dismiss button reachable without scroll trap; forms usable with on-screen keyboard (inputs not hidden behind it).

### RESP-03 — Long-content overflow
**Steps:** Log 20+ workouts and meals; a 60-char meal name; view history lists on mobile.
**Expected:** Lists scroll within the page; text truncates or wraps; layout intact.

### RESP-04 — Reduced motion & glow legibility
**Steps:** Emulate `prefers-reduced-motion: reduce` (DevTools → Rendering). Browse.
**Expected:** Scanline/sweep/pulse animations disabled or reduced; app fully usable. Also spot-check text contrast: muted blue text on dark panels must remain readable (per design doc, `#1C45A1` must not be used for text).

---

## 12. Time & clock manipulation (consolidated)

> Run these last — they alter the OS clock. Reload the tab after each clock change; also repeat the critical ones (QST-04, WOR-12) with the tab left open, since interval-driven UI is a separate code path from load-time state.

| ID | Scenario | Expected |
|---|---|---|
| TIME-01 | Clock forward 1 day | New quest/prayer day; streaks intact per rules; prayer times refetched for new date |
| TIME-02 | Clock backward 1 day (after logging "tomorrow") | App doesn't crash; future-dated entries don't corrupt streaks (streak may legitimately read oddly — no NaN/negative) |
| TIME-03 | Cross a month boundary | Prayer cache (keyed by date) refetches; history charts label dates correctly |
| TIME-04 | Feb 28 → Feb 29 → Mar 1 (set year to 2028) | Date keys handle leap day; streak across the three days counts 3 |
| TIME-05 | DST spring-forward and fall-back days | Countdown and "hours until midnight"-style logic stay sane; day keys don't duplicate/skip |

---

## Bug-filing severity guide

- **Blocker:** data loss on parse failure/version change (PERS-04/05), crash on any main page, XP/level corruption.
- **Major:** streak unfairly broken (STK-05), wrong rank at boundary, prayer check-off broken offline, hydration errors, quest not resetting at midnight.
- **Minor:** copy/tone violations (WOR-03 note), layout overflow, missing validation on absurd inputs.
