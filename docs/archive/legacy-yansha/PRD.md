# PRD — Self Health (v1)

A personal, Solo Leveling / "Arise"-styled self-health web app for a single Muslim user. It gamifies workouts, nutrition, health metrics, and 5-daily-prayer accountability with an XP/rank "System" — all local, private, and free.

**Stack (v1):** Next.js + TypeScript + Tailwind. All persistence in `localStorage`. No backend, no accounts.

Companion references (source of truth for constants and copy): [`docs/context/`](./context/README.md) — design tokens, XP formulas, prayer/API rules, fitness formulas.

---

## 1. Persona

**The Owner-User** (the only user):

- Practicing Muslim; prays 5 daily prayers and wants gentle, private accountability — never guilt or gamified worship.
- Wants to build workout consistency, track calories/macros, and watch basic health metrics.
- Motivated by the Solo Leveling fantasy: Daily Quests, XP, E→S ranks, "System" windows.
- Uses one primary device for now; values privacy strongly (health + worship data stays on-device).
- Will self-report everything (no wearables, no food-database API in v1).

## 2. Goals

1. Make daily healthy behavior feel like leveling up: one glance at "today's quests," one tap to log, immediate XP feedback.
2. Provide dignified prayer accountability: on-time tracking, qada (make-up) flow, honest stats.
3. Be trustworthy with data: nothing leaves the device; nothing is ever punitively deleted.
4. Be fun enough to open every day — the aesthetic and streak are the retention engine.

## 2.5 Product direction beyond v1 — Yansha as a modular OS

v1 as specified below is a fixed app. The product it is growing into is an **open-source lifestyle operating system**: at onboarding the user chooses which life modules they want, and unchosen modules simply do not exist for them. Named modules so far: **Workout** (training, nutrition, vitals), **Sahwa** (prayer, Hifz, Qaida, Quran, fasting, dhikr), **Study** (school, research), **Finance** (budgets, zakat), and **Teacher** — which is not a sibling module but a *role overlay* that makes the user a student or a teacher inside the others. The architecture targets 10–30 modules, including third-party ones.

Two requirements follow, and they bind the same way §4 does:

1. **Additive extensibility.** Adding module #27 must touch only that module's own files plus one registry entry — never the other 26. Modules declare themselves via a manifest (nav, onboarding step, owned state slice, published/consumed facts); the shell reads the registry rather than hardcoding realms.
2. **Cross-module intelligence is the point.** A fact declared in one module must reshape plans across the others. The canonical case: the user declares in Sahwa that they are **fasting** today; Nutrition then suppresses daytime meal reminders and re-buckets macros into Suhoor and Iftar windows, hydration targets shift to the Maghrib–Fajr window, and Workout de-loads and reschedules training to post-Iftar. This is what §3.5's "Ramadan-aware defaults" and §4.9 actually mean in practice.

Modules achieve this by **publishing facts** about the user's day (kind, source module, subject date, time window, payload, confidence, provenance, expiry) to a shared context bus, and subscribing to facts from others — never by reading or writing another module's state. A background heuristic engine correlates facts and emits adaptations; modules keep ownership of their own domain logic and rendering. Facts carry provenance and confidence so the app can always say *who asserted what, and how sure it is* — the same honesty standard §4 imposes on worship data and offline Quran coverage.

Full design, including the fact schema, conflict resolution, the Teacher permission model, and the incremental migration path from today's shared store: [`design/module-architecture.md`](./design/module-architecture.md).

## 3. Feature requirements by module

### 3.1 Onboarding & Profile

- One-time setup quiz: age, sex, height, weight, fitness level, equipment, training days/week, prayer calculation method + Asr school, location (for prayer times).
- Computes BMR/TDEE (Mifflin-St Jeor) and default calorie/macro targets; all editable later.
- "You have become a Player." welcome ceremony; assigns starting rank E.
- Settings page to edit everything, including rest days, goals, and prayer method/school.

### 3.2 Daily Quest (core loop)

- One daily checklist generated from the user's level/rank: scaled workout items (e.g. E-rank: 20 push-ups / 20 sit-ups / 20 squats / 1 km), water, steps, prayers summary.
- Per-item progress in System style (`PUSH-UPS [12/20]`), countdown to midnight, full-clear bonus XP.
- Adaptive difficulty: sustained ≥85% completion nudges targets up; <50% eases them down. Floor always ≥ safe minimums.
- Scheduled rest days: quest swaps to recovery items (stretch, water, steps) and **never breaks the streak**.
- Failure = red `[WARNING]` window + a 48h Redemption Quest that restores the streak. No XP or level is ever lost.

### 3.3 Workouts

- Exercise library by category (push/pull/legs/core/weighted/cardio/mobility) with sensible set/rep schemes.
- Log workouts: exercise, sets × reps × weight, or duration for cardio. Everything user-editable (sets, reps, rest, custom exercises) — rigidity was the top competitor complaint.
- Estimated calorie burn via MET method, always displayed as "~ estimated."
- History view with simple volume/frequency trends.

### 3.4 Nutrition (calories & macros)

- Manual food logging: name + calories + protein/carbs/fat (no food-database API in v1). Quick-add of recent/favorite entries to reduce friction.
- Daily targets from TDEE + goal (cut/maintain/bulk) and macro preset (balanced / high-protein / endurance); clamped to safe minimums.
- Daily ring/bars vs targets; weekly summary.

### 3.5 Health metrics

- Manual daily logs: weight, water (glass increments), sleep hours, steps.
- Defaults: water 2 L (8×250 ml), sleep 8 h, steps 8,000 (10,000 as stretch).
- Trend charts (7/30 days). Hitting a metric goal contributes small XP.

### 3.6 Prayer accountability (Salah)

- Today's 5 prayer times from the AlAdhan API (`method` and `school` always set explicitly; monthly `calendar` endpoint cached in localStorage; refetch only on month/settings change).
- User confirms each prayer manually — never auto-marked. Status: **on time** (anywhere within the window), **late/qada**, or **pending**.
- Missed prayer becomes a visible qada item (oldest first) with compassionate copy ("make it up when you can") — it never silently disappears at midnight.
- Maghrib's short window gets a gentle urgency indicator.
- Stats: on-time rate, per-prayer breakdown, qada backlog. Prayer names shown in Arabic + Latin.

### 3.7 Gamification (XP, ranks, streaks)

- Single XP track, square-root level curve (`level = floor(sqrt(XP/100)) + 1`). XP values coarse and legible: quest item ≈ 10–25, full daily clear +50, prayers small and fixed.
- Rank ladder mapped to level bands: E 1–9, D 10–19, C 20–34, B 35–54, A 55–79, S 80+. Rank-up ceremony screen.
- RPG stats mapped to behavior: workouts→STR, steps→AGI, hydration/nutrition→VIT, prayer/consistency→a spirit-type stat.
- One daily streak = Daily Quest completion. 2 auto-applied streak freezes, 48h redemption repair, milestone celebrations at 7/30/100/365.
- Occasional random flavor drops after quest completion (`You have acquired: Water of Vitality`) — cosmetic only.
- One currency (XP), no shops or crafting in v1.

### 3.8 UI / theme

- Solo Leveling System aesthetic per [`solo-leveling-design.md`](./context/solo-leveling-design.md): `#0A0F1E` backgrounds, electric-blue `#00F0FF` accents, Orbitron/Rajdhani fonts, clip-path panels, glow effects.
- System voice for all copy: bracketed, impersonal, addresses the user as "Player." Red styling reserved for fitness warnings only.
- Respect `prefers-reduced-motion`; never convey state by color alone.

### 3.9 Data & persistence

- All state in `localStorage` under a **versioned schema** with migrations. Never wipe on parse failure — back up the raw blob before migrating.
- Manual export/import of all data as JSON (the only backup mechanism in v1).
- Light friction on backfilling: "mark yesterday" allowed; bulk-editing weeks past is not.

## 4. Religious-sensitivity constraints (first-class requirements)

These are hard requirements, not style preferences:

1. **No penalties on worship.** No XP loss, no red "penalty" theming, no shame copy for missed prayers. Penalty flavor is for fitness quests only.
2. **Missed ≠ erased.** A missed prayer converts to a qada item and remains until made up.
3. **No leaderboards or social comparison of worship** (moot in v1, binding for future versions).
4. **Prayer XP framed as discipline/consistency**, kept modest — never "points for praying."
5. **Dignified feedback**: subtle confirmation on marking a prayer; no coin sounds, confetti, or trivializing animation.
6. **User-confirmed only**: prayers are never auto-marked from clock time.
7. **Privacy**: prayer data never leaves the device in v1; any future sync must be opt-in.
8. **Configurable jurisprudence**: calculation method and Asr school are user-selectable; manual "exempt/combined" override instead of modeling travel/exemption rules.
9. **Ramadan-aware defaults**: hydration reminders schedulable/pausable; no hardcoded daytime drink prompts.

## 5. Non-goals for v1

- **No backend, no auth, no accounts** — localStorage only, single device.
- **No social features** — no friends, guilds, sharing, or leaderboards.
- **No food-database API** — manual macro entry only.
- **No push notifications** (requires a backend; deferred to v2.5). In-app cues only.
- No wearable/health-platform integrations, no AI coaching, no payments, no i18n beyond Arabic prayer names, no native app (PWA install polish comes in v1.1).

## 6. Success criteria

| Metric | Target | How measured (locally) |
|---|---|---|
| Daily active use | App opened + ≥1 log on ≥6 of 7 days | Local usage log |
| Prayer on-time rate | Visible weekly trend; user-set target (e.g. ≥80%) with improvement over baseline | Prayer stats module |
| Streak retention | Reach a 30-day streak within first 60 days; recover ≥50% of breaks via Redemption Quest | Streak history |
| Quest completion | ≥70% Daily Quest full-clear rate over rolling 30 days | Quest log |
| Data integrity | Zero data-loss incidents; export/import round-trips losslessly | Manual verification |

## 7. Out-of-scope risks acknowledged

- Self-reported data is gameable — rewards stay cosmetic, so cheating only cheats yourself.
- Calorie/burn numbers are ±10–20% estimates; copy always says "estimated." Standard "not medical advice" disclaimer included.
