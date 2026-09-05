# Roadmap — Post-v1

Phased plan after v1 (Next.js + localStorage, see [`PRD.md`](./PRD.md)). Effort: **S** ≈ hours–1 day, **M** ≈ 2–5 days, **L** ≈ 1–2+ weeks. Religious-sensitivity constraints from the PRD §4 bind every phase.

---

## v1.1 — Polish (no backend)

Goal: make v1 feel like a real installed app and pay down v1 shortcuts.

| Item | Value | Effort | Dependencies | Risks |
|---|---|---|---|---|
| **PWA install** — manifest, icons, service worker, offline shell | Home-screen icon + offline use; the biggest "feels real" win for a personal app | **M** | v1 stable; HTTPS hosting | Service-worker caching bugs can serve stale JS — keep SW scope minimal (app shell only), version caches |
| **Achievements integration** — badge wall wired to existing events (streak milestones, rank-ups, qada cleared, first 100 workouts…) | Long-term meta beyond the daily loop; identity formation ("I am someone who trains daily") | **M** | v1 event/XP system emitting consistent events | Retroactive grants need care with backfilled data; keep prayer achievements consistency-framed, never competitive |
| **Data import from `data/*.json` libraries** — seed exercise library, food presets, quest templates from bundled JSON | Kills manual-entry friction (biggest v1 UX tax, especially nutrition) | **S–M** | JSON schemas versioned and matching localStorage schema | Schema drift between bundled data and store; validate on import, never overwrite user-customized entries |
| Quality pass — reduced-motion audit, empty states, export/import round-trip test | Trust and daily-use comfort | **S** | — | — |

## v2 — Supabase backend + auth (multi-device sync)

Goal: same app on phone + desktop with one account. Local-first stays: localStorage remains the source of truth offline; Supabase syncs it.

> **Hard constraint (developer environment):** all database DDL must be delivered as **manual SQL for the Supabase SQL Editor** — a single copy-pasteable, idempotent block (`IF NOT EXISTS`, safe alters). Never agent-run `prisma migrate` / `db push` or any tool-applied migration; the developer only has a session-pooler connection. Treat a migration as applied only after the developer confirms running it.

| Item | Value | Effort | Dependencies | Risks |
|---|---|---|---|---|
| **Supabase project + schema** (profiles, quest logs, workouts, nutrition, metrics, prayer logs, XP events) with RLS on every table | Foundation for everything server-side | **M** | Manual-SQL delivery workflow above | Schema mistakes are costly once data exists — design reviewed first; RLS misconfiguration would expose worship/health data (highest-sensitivity data in the app) |
| **Auth** — Supabase Auth, email/OTP, single-user | Multi-device identity | **S–M** | Supabase project | Session-handling bugs were the #1 complaint against Arise; test token refresh + offline start thoroughly |
| **Sync engine** — push local writes, pull remote, last-write-wins per record with updatedAt; migrate v1 localStorage up on first login | The actual user value: phone + desktop | **L** | Schema + auth; v1's versioned localStorage schema | Conflict resolution is the hard part — keep records small and per-day to make LWW safe; never let a failed sync delete local data |
| **Privacy gate** — sync is opt-in; prayer data sync separately opt-in with plain-language explanation | Upholds PRD §4.7; worship data leaving the device must be a deliberate choice | **S** | Sync engine | Skipping this quietly would violate a first-class requirement |

## v2.5 — Prayer-time push notifications (minimal backend)

Goal: adhan-time and pre-Maghrib nudges even when the app is closed.

| Item | Value | Effort | Dependencies | Risks |
|---|---|---|---|---|
| **Web Push plumbing** — subscription storage in Supabase, VAPID keys, service-worker push handler | Prerequisite for any notification | **M** | v1.1 PWA service worker; v2 backend + auth | iOS requires the PWA installed to Home Screen for Web Push; browser-permission UX is one-shot — ask in context, not on load |
| **Prayer-time scheduler** — server job (Supabase Edge Function + pg_cron) computes each day's times per user settings and enqueues pushes | The single most-requested reminder class for the target user | **M–L** | Push plumbing; user's method/school/location on server | Timezone/DST correctness; scheduling from stale location. Delivered as manual SQL for any pg_cron/table DDL |
| **Notification restraint** — per-prayer toggles, quiet hours, one well-timed reminder each | Notification fatigue is the top prayer-app complaint; restraint is a feature | **S** | Scheduler | Over-notifying erodes the app's dignity positioning — default conservative |

## v3 — Modular OS foundation (cross-module intelligence)

Goal: turn the app from a fixed set of realms into a **lifestyle operating system** where the user chooses modules at onboarding, and a declared fact in one module reshapes plans in every other. Full design: [`design/module-architecture.md`](./design/module-architecture.md).

| Item | Value | Effort | Dependencies | Risks |
|---|---|---|---|---|
| **Module manifest + registry** — one declarative manifest per module (nav, onboarding step, settings panel, owned state slice, published/consumed facts); `AppShell` nav and `RealmSwitcherModal` derive from it | Adding module #27 touches only its own folder plus one registry line — the precondition for 10–30 modules and for outside contributors | **M** | Route canonicalisation decision (`/finance` vs `/treasury`, `/circles` vs `/academy`) | Pure-refactor phase must be visually identical or it burns trust for no user-visible gain |
| **Shared context (fact) bus** — modules publish typed facts about the user's day (kind, source, subject date, window, payload, confidence, provenance, expiry) and subscribe to others' | The heart of the product. Direct cross-module reads are N² and break the moment a module is disabled | **M** | Manifest types | Getting the fact schema wrong is expensive later — ship types + tests before any consumer |
| **Engine consumes facts; delete the fabricated context** — `context-builder.ts` currently hardcodes prayer countdowns, Quran minutes, spend, and baselines | The rules today fire on demo data, not user data. This is the biggest gap between the demo and the product | **M** | Fact bus | Each removed constant may expose that the real data path doesn't exist yet — that is the point, file it |
| **Fasting as the reference trace** — Sahwa publishes `day.fasting` with a Suhoor/Iftar window derived from existing AlAdhan timings; Nutrition suppresses daytime reminders and re-buckets macros to Suhoor/Iftar; hydration paces against the Maghrib–Fajr window; Workout de-loads and reschedules post-Iftar | Delivers PRD §4.9 (Ramadan-aware reminders) properly, and proves the contract on the canonical example | **M** | Fact bus + engine refactor | Hydration "you're behind" logic must measure elapsed time *within the drinking window*, or a fasting user is told they are failing all afternoon |
| **Registry-driven onboarding** — user picks modules; each chosen module contributes its own lazily-loaded steps | Keeps onboarding ~4 screens with 30 modules installed, instead of a wall of checkboxes | **M** | Registry; splitting the 1468-line `Onboarding.tsx` | Enable/disable lifecycle: disabling must retract facts without ever deleting the module's data |
| **Teacher role overlay (scaffolding only)** — student/teacher role scoped per circle, per module, opt-in per scope; reserve `viewerUserId` vs `subjectUserId` in all new data access | Roles are the single most painful thing to retrofit; every query written today assumes `userId = me` | **M** (scaffold) / **L** (full) | v2 auth; circle-scoped RLS policies beyond owner-equality | Worship data is the app's most sensitive scope — PRD §4.3 forbids comparative worship visibility; teacher scopes must exclude prayer adherence |

## v3.5 — Ideas (ordered by suggested value)

| Item | Value | Effort | Dependencies | Risks |
|---|---|---|---|---|
| **Fasting / Ramadan mode** — suhur/iftar times (Imsak already in AlAdhan data), fasting tracker, hydration reminders flipped to night, quest intensity deload | Directly serves the user one month/year at maximum relevance; PRD already requires Ramadan-aware reminders | **M** | v1 prayer module; v2.5 for reminders | Fiqh nuance (travel, exemptions) — keep manual overrides, don't model rulings |
| **Qibla direction** — compass view via AlAdhan `/qibla/{lat}/{lng}` + device orientation API | Cheap, delightful, on-theme (a "navigation System" feature) | **S** | Geolocation permission | Device-compass accuracy varies wildly; show as approximate with calibration hint |
| **Quran reading tracker** — surah/juz' progress, gentle daily goal, khatmah (completion) milestones | Extends the worship-accountability pillar users already trust the app for | **M** | None hard; nicer with v2 sync | Same sensitivity rules as prayer: no penalties, no comparison; scope creep toward a full mushaf reader — track progress only, don't render Quran text in-app initially |
| **AI workout suggestions** — periodic plan adjustments from logged history (progressive overload hints, plateau detection) | Keeps quests fresh past the point where adaptive difficulty plateaus | **L** | Rich workout history; an LLM API (first server-side dependency on a third party with health data) | Safety of generated advice (needs guardrails + disclaimer); sending health data to an API conflicts with privacy stance — require explicit opt-in or use on-device heuristics first |
| **Social / guild "raid" challenges** — small invite-only guilds, co-op fitness challenges ("clear the gate: 10,000 collective push-ups") | The strongest retention mechanic in the genre; fits the Solo Leveling fantasy perfectly | **L** | v2 backend, auth, and real multi-user infrastructure | **Fitness challenges only — worship is never social/comparative (PRD §4.3)**; moderation and abuse surface; biggest scope jump in the roadmap — do last |

## Sequencing rationale

1. **v1.1 first** — PWA + seeded data multiplies daily-use comfort with zero backend risk, and the service worker is a prerequisite for v2.5 push anyway.
2. **v2 before any notification work** — push subscriptions, scheduling, and settings all need auth + server storage; building sync first avoids throwaway plumbing.
3. **Contract before consumers in v3** — the manifest and fact schema must land (with tests) before any module publishes or consumes, because changing the fact shape after five modules depend on it is the expensive mistake this phase exists to avoid.
4. **Ramadan mode is the sleeper priority** — schedule it to ship *before* the next Ramadan regardless of other ordering. The v3 fasting trace largely *is* Ramadan mode, which is why it is the reference example rather than a later feature.
5. **Sahwa never stalls for the refactor** — every v3 phase is additive from Sahwa's side (a small new fact-publisher module). No phase requires touching the Hifz, Qaida, or recitation engines.
