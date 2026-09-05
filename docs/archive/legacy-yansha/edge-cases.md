# Edge Cases & Likely Bug Classes

Catalog of edge cases for this architecture (Next.js App Router + client-only Zustand/localStorage, key `arise-system-v1`), grouped by bug class. Items marked **[code-confirmed]** were verified against the current `lib/` implementation and are real behaviors, not hypotheticals — decide per item whether it's accepted-by-design or a bug.

## 1. localStorage persistence & schema

- **Corrupt blob → silent wipe.** [code-confirmed risk] Zustand `persist` with `createJSONStorage`: if `JSON.parse` throws on load, the store hydrates with defaults and the *next write overwrites the corrupt blob*, permanently destroying data. No backup key or recovery UI exists in the store config. This is Arise's most-hated failure mode and a hard "never do this" in `docs/context/`. Mitigation to demand: copy the unreadable raw blob to `arise-system-v1.backup-<timestamp>` before any write, and surface a recovery notice.
- **Version bump without `migrate`.** [code-confirmed risk] `version: 1` is set but no `migrate` function. Any future bump to `version: 2` will make Zustand discard v1 state entirely for existing users (it warns in console and falls back to defaults). Downgrade (user loads old build with v2 data) behaves the same. Every schema change must ship a migration.
- **Partial/hand-edited state.** Missing keys (`state.meals` deleted), wrong types (`totalXp: "abc"`), `null` sub-objects. Derived math (`levelFromXp("abc")` → `NaN` loop risk; `while (remaining >= cost)` with NaN exits immediately → level 1, but rendering may show NaN elsewhere). Every page must tolerate a hole in any slice.
- **Quota exhaustion.** `workouts`, `meals`, `notices` grow unbounded (notices capped at 30, arrays are not). A heavy user logging 5 meals + 2 workouts/day writes the *entire* blob on every action; at some size `setItem` throws `QuotaExceededError` and persist fails silently — in-memory state looks fine, everything since the last successful write is gone on reload. Test with a pre-filled ~4–5 MB store.
- **Multi-tab clobbering.** No `storage`-event sync. Two tabs each hold an in-memory copy; every write serializes the *whole* store. Tab B's first write after tab A's changes silently reverts A's changes. Worst case: user keeps a dashboard tab open all day → evening write reverts the whole day.
- **Private browsing / storage disabled.** Safari private mode, iOS Lockdown, enterprise policies: `localStorage` may throw on access. First-load code paths must not crash before React error boundaries exist.
- **`crypto.randomUUID` unavailable** over plain HTTP (non-localhost LAN testing). [code-confirmed] Fallback to `Math.random()` IDs exists; collision odds are negligible but IDs are also used as React keys — verify no duplicate-key warnings after bulk logging.

## 2. Clock, timezone & calendar

- **Midnight rollover with the tab open.** Day keys (`todayKey()`) are computed *at action time*, but rendered state may be from before midnight. Known traps: quest panel still showing yesterday's completed quest after 00:00; `addQuestProgress` writing to the new day while the UI shows the old one; prayer checklist not resetting; countdown showing "Fajr (tomorrow)" computed from the stale day. Any component that caches `todayKey()` in state/render without a ticking dependency is suspect.
- **Manual clock changes / travel.** Clock set forward a day, entries logged, clock set back → future-dated keys exist. `countStreak` walks backward from today, so future entries are ignored (OK), but history charts and "today" totals must not crash on future dates.
- **DST spring-forward/fall-back.** `date-fns` `subDays`/`format` on local time handle this, but any hand-rolled `±864e5 ms` arithmetic (seed scripts, countdowns, "time until midnight") drifts by an hour on transition days. The prayer countdown recomputes from `new Date()` every second [code-confirmed via `useNow`], so it self-corrects — but assert no visible ±1 h jump artifacts.
- **Device timezone ≠ prayer-city timezone.** [code-confirmed] `timeToday("05:09")` applies the API's city-local string to the *device's* clock. Correct only when the user's device and configured city share a timezone. A user in Detroit with city=Mecca gets countdowns to nonsense times (possibly all "passed" → permanent "Fajr (tomorrow)"). Also: `nextPrayer` approximates tomorrow's Fajr with *today's* Fajr time — off by ~1–2 min normally, off by 1 h on DST-change night.
- **Leap day.** Feb 29 date keys (`2028-02-29`) through streaks, charts, `lastNDays`. `date-fns` is safe; custom string manipulation (if any appears in UI code) is not.
- **Islamic calendar / Ramadan.**
  - Fasting flips eating into pre-dawn (suhur) and post-sunset (iftar). A suhur meal logged at 03:30 gets `date = todayKey()` at log time → attributed to the *new* Gregorian day. Users think of suhur as the end of the previous "night" — expect confusing day totals and a possibly-unreachable calorie window on both days. At minimum, verify totals are internally consistent; consider a known-issue note.
  - Hydration: 2,500 ml goal must be drinkable in a ~9-hour night window; time-based "drink now" prompts (if added later) must be pausable per `docs/context/fitness-nutrition-reference.md`.
  - Maghrib (= iftar) is the shortest prayer window (~60–90 min) — countdown urgency matters most exactly when the user is busiest.
  - Hijri dates from AlAdhan (`data.date.hijri`) are method-dependent near month boundaries; don't derive logic from them.
- **Streak semantics at boundaries.** [code-confirmed] Today-in-progress never breaks a streak (good). But: no rest days, no freezes, no repair — one missed quest day zeroes `questStreak` despite the context docs mandating forgiveness. Also `questStreak` evaluates *past* days against *current* targets: lowering targets retroactively "completes" old days; raising them retroactively breaks a historical streak. Decide and document.

## 3. XP economy & math

- **Delete-does-not-revoke as an exploit.** [code-confirmed] `deleteWorkout`/`deleteMeal` remove the entry but keep XP and stat gains. Log workout → +85 XP → delete → repeat = infinite XP. Accepted per "never delete earned XP", but the loop takes ~3 seconds per 85 XP; consider it accepted-self-cheating per gamification doc, but verify at least that the *history* and *stats* don't desync into weirdness (strength increments also persist after delete).
- **All-zero quest targets = free 100 XP.** [code-confirmed] `allDone` treats `target <= 0` as satisfied; with all four targets set to 0, the first `addQuestProgress` call of the day fires the +100 full-quest bonus. Settings must clamp targets to ≥ 1 (or the completion check must require at least one positive target).
- **Calorie-window skip.** [code-confirmed] The ±10% check runs only at meal-log time against the running day total; a single meal jumping from 85% to 115% of goal permanently misses the +30 for that day. Conversely the award, once granted, survives later overshoot and meal deletion. Defensible, but document as intended.
- **Boundary values.** Level thresholds are cumulative `25(n−1)(n+2)`: test exactly-at, one-below (esp. rank promotions L10/20/30/40/50 = 2,700 / 10,450 / 23,200 / 40,950 / 63,700 XP). One action crossing multiple levels (seed 95 XP, +160 quest finish) must queue level-up events correctly and drain one modal at a time.
- **Float accumulation.** `runKm` uses `Math.round(x*100)/100` per add [code-confirmed] — verify 0.1-km increments reach exactly 10.00. Meal macros summed across many entries: totals displayed should be rounded, never `1899.9999999999998`.
- **Double-submit.** Fast double-click on "log meal/workout" buttons → two entries, two XP awards. Buttons should disable during submit or dedupe; with localStorage there's no network latency so the window is small but real on slow mobile CPUs.
- **Award-flag orphaning.** `prayerAwards`/`dailyAwards`/`awarded` flags live parallel to the data they guard. Hand-edited or partially-restored state can desync them (e.g. prayers cleared but awards flagged → prayer re-mark gives no XP; opposite → double XP). Resilience code should treat flags as authoritative for XP and never crash on mismatch.

## 4. Prayer feature specifics

- **AlAdhan failure modes:** timeout (10 s abort [code-confirmed]), non-200, HTTP 200 with `code != 200`, `data.timings` missing, malformed time strings ("05:09 (EET)" is handled by suffix-strip [code-confirmed]; empty string is not — `timeToday("")` returns `null`, verify UI handles null). `timingsByCity` `meta` coordinates are documented junk — never used for logic [OK today; guard against future use].
- **Missing `school` parameter.** [code-confirmed] The fetch sets `method` but not `school`; Hanafi users get Asr up to ~an hour early relative to their practice. Context doc says always set both explicitly — spec-compliance gap.
- **Respectful-copy compliance.** [code-confirmed] Marking a prayer "missed" pushes a red warning notice: "The System does not forget. Recover your discipline, Hunter." The context docs prohibit penalty/shame theming on worship (accountability framing only, missed → gentle qada prompt). Flag as a copy/design bug.
- **High-latitude cities.** Fajr/Isha may be undefined in summer (e.g. Tromsø, method-dependent); API returns adjusted times via `latitudeAdjustmentMethod` default — verify no empty strings crash `timeToday`.
- **City/country input:** unicode city names (İstanbul, Makkah vs Mecca), cities with spaces (encoding is handled via `encodeURIComponent` [code-confirmed]), wrong-country pairs (city "Paris", country "US" → Paris, Texas — plausible but wrong times; nothing to detect, document).
- **Maghrib = Sunset** for most methods; if UI ever shows both, they'll duplicate.

## 5. Rendering, hydration & App Router

- **SSR/localStorage mismatch.** Every localStorage-backed component must render a deterministic shell until `useHydrated()` flips [pattern exists in code]. Bug class: a component reading `useSystem` state directly in first render paints persisted values into markup that differs from the server HTML → React hydration error #418/#425, which in production can silently client-re-render (perf + flicker) or, worse, duplicate event handlers. Audit any *new* component added late in the build — this regression is easy to reintroduce.
- **`Date`-dependent first render.** Countdown/`useNow` components render `new Date()` output; server time ≠ client time → mismatch unless gated behind mount.
- **Level-up modal re-fire.** `levelUpQueue` persists; if the modal-dismiss path fails to `shiftLevelUp()` before an unload, the modal re-appears on every load until dismissed properly. Verify dismiss is written through to storage (it is a `set` → persisted) — test rapid dismiss + immediate reload.
- **Notice flood.** Every XP event pushes a notice (cap 30). A full-quest finish fires 2–3 at once (+15, +100, quest-complete info, maybe level-up). Verify toasts stack/queue legibly on mobile rather than overlapping.

## 6. Input validation (numeric fields everywhere)

Systematic sweep for every numeric input (workout sets/reps/weight/duration, quest add-amounts, meal macros, health metrics, settings goals/targets):

- negative values (water is clamped ≥ 0 in store [code-confirmed]; quest progress clamps at ≥ 0 per field; **most others are unguarded** — a negative-calorie meal would *lower* day totals and could re-open the ±10% window for a second award... actually the award key blocks a second award per day, but totals still display wrong),
- zero, empty string → `NaN` through `Number(...)` coercions,
- absurd magnitude (1e7 steps, 99,999 kcal) — chart axes and progress bars must clamp,
- exponent/hex strings ("1e3", "0x10") in `<input type="number">` on different browsers,
- paste with units ("70 kg"), locale decimal commas ("7,5" sleep hours) — Firefox vs Chrome behavior differs,
- extremely long text names (meal/workout/hunter name) — layout overflow inside fixed-width clip-path panels.

## 7. Platform & environment

- iOS Safari: localStorage evicted under storage pressure for rarely-used PWA-ish sites (7-day ITP eviction applies to script-writable storage if the app is used inside certain contexts) — advise users to visit regularly or add export/backup; test at least that eviction (simulated by clearing) lands on the clean-first-run path, not a crash.
- `AbortSignal.timeout` requires Safari ≥ 16 / Chrome ≥ 103 [code-confirmed usage] — older WebViews throw `TypeError` on `fetch` setup → verify the catch path treats it as offline rather than crashing the component.
- Slow devices: 1-second `useNow` interval + animated gradient sweeps on multiple panels — check CPU on a throttled (6×) mobile profile; respect `prefers-reduced-motion`.
- Ad blockers / privacy extensions blocking `api.aladhan.com` → same path as offline; verify.
