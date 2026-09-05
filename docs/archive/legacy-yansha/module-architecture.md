> **ARCHIVAL NOTICE:** This document describes the retired monolithic/module architecture of old Yansha and is **NOT** current Yansha architecture.
> Current architecture establishes independent product repositories (Workout, Study, Finance, Sahwa) under the Yansha Group umbrella with separate database and deployment boundaries.

# Yansha OS — Module Architecture & Cross-Module Intelligence

Status: **design doc / target state**. Nothing in §3–§9 is implemented yet unless explicitly marked "exists today".
Scope: how Yansha becomes an open-source **lifestyle operating system** where the user picks modules at onboarding, and where one declared fact in one module reshapes plans in every other module.

Binding constraints inherited from [`AGENTS.md`](../../AGENTS.md) and [`PRD.md`](../PRD.md): Neon Postgres + Prisma (never Supabase), zero-assumption Quranic pedagogy, worship is never penalised or made competitive, offline Quran coverage is never overstated.

---

## 0. Decisions (settled by the owner)

These were open questions; they are now binding. As of D15 no architecture question from this pass remains open — §11.2 is deliberately empty.

### D1 — `salah` is not a shareable telemetry scope at all (privacy, highest priority)

Prayer data never leaves the user's control to a circle or a teacher. `salah` is removed from the sharing-scope vocabulary entirely — not merely removed from the default. There is no grantable `salah`, `salah.adherence`, or equivalent worship-adherence scope, and no UI that offers prayer sharing.

*Rationale:* PRD §4.3 forbids social comparison of worship. A scope that merely defaults to off still normalises a teacher asking for it, and one mis-set boolean then exposes the most sensitive data in the app. Removing the vocabulary makes the failure mode unrepresentable.

*Closed (Yansha-wg5):* `CircleMember.sharedTelemetry` now defaults to `["hifz"]`; the scope vocabulary lives in `lib/privacy/sharing-scopes.ts` and excludes `salah` (which is on an explicit forbidden list); `app/circles/page.tsx` and `app/academy/page.tsx` no longer offer prayer chips; `circles` / `circle_members` / `circle_assignments` are in the FORCE-RLS array in `prisma/migrations/rls.sql`; and `prisma/migrations/strip-salah-sharing-scope.sql` idempotently strips `salah` from pre-existing rows.

### D2 — Nutrition is its own module

Nutrition is a first-class module owning `/nutrition`, separate from training and from health tracking.

*Rationale:* it is the loudest consumer of `day.fasting` (meal-window re-bucketing and reminder suppression are its behaviour, not Workout's) and it is genuinely useful to a user who enables no training module at all. The cost — a second onboarding split — is accepted.

### D3 — The engine may adapt voluntary worship only

Adaptations may reorder or lighten **voluntary** practice: Manzil review volume, dhikr targets, optional Quran reading time. The engine may **never** adapt obligatory prayer (salah) or zakat — not the schedule, not the target, not the reminder, not the calculation.

*Rationale:* fiqh obligations are not heuristics. This is a hard constraint, enforced at rule-review time and mirrored in [`CONSTITUTION.md`](../../CONSTITUTION.md) and [`AGENTS.md`](../../AGENTS.md).

### D4 — `/treasury` is the canonical Finance route

The Finance module owns `/treasury`. `app/finance/page.tsx` becomes a redirect to `/treasury`, following the pattern `app/worship/page.tsx` already uses.

*Rationale:* "Treasury" fits the Solo Leveling naming language the product uses everywhere else (realms, guilds, ranks). One full-page implementation survives; the other becomes a redirect so existing links and bookmarks keep working.

### D5 — `/academy` is the canonical Circles route

`app/circles/page.tsx` becomes a redirect to `/academy`. Both pages render the same circle list today; only the `/academy` implementation survives.

*Rationale:* same naming language as D4, and the surface is a teaching surface — it belongs to the Teacher/student role overlay (§7), not to a separate "social" module.

### D6 — Intel is per-module; top-level `/intel` is a cross-module rollup

Each module owns its own intel surface. `/sahwa/intel` stays and belongs to Sahwa. `/intel` stops being a page with its own content and becomes an aggregator that renders intel contributed by whichever modules the user has enabled.

*Rationale:* intel is a *view over a module's own reasoning*, so the module that owns the data must own the analysis. A single hand-written `/intel` page would have to import every module, which is exactly the N² coupling §2 forbids.

*Structural consequence (binding on Yansha-jdb):* the module manifest gains an **optional intel-contribution capability**. The rollup renders `enabledModules().filter(m => m.intel)` and must contain **no hardcoded module list**, so module #27 appears in `/intel` by declaring the capability, without anyone editing the rollup. It must degrade to showing only enabled modules — and, if none contribute, to an honest empty state rather than a fabricated summary.

### D7 — Health and Training are ONE module

A single **Workout** module owns both `/training` and `/health`. **`/training` is the canonical entry point** (`rootHref`); `/health` persists as a sub-surface of the same module and appears in that module's `nav`, not as a realm of its own. Nutrition remains separate (D2).

*Rationale:* the two surfaces share one physiological model — sleep debt, injury, and recovery load all gate what training is prescribed, and the §6.1 fasting trace already has one actor reacting on both surfaces. Splitting them would mean two modules publishing overlapping `body.*` facts and fighting over ownership in the §4.3 conflict ladder. Nutrition stays separate because it is the loudest consumer of `day.fasting` and is useful with no training module enabled at all.

### D8 — Gamification (XP, ranks, leaderboards, guilds) is cross-cutting infrastructure, not a module

XP, ranks, streak progression, `/leaderboard`, and `/guilds` are shared substrate available to every module — the same structural category as the Teacher role overlay (§7). They are **not** a "social module" and do not appear in the realm registry.

*Rationale:* progression must aggregate across every module — a workout streak and a Hifz streak feed **one** progression system, not two disconnected scoreboards. If gamification were a module, every new module would have to reinvent XP, and a user who disabled it would lose progression everywhere. Circles/academy likewise belong to the Teacher/student role overlay (D5), not to a social module.

*Consequences to implement:*

- Modules **contribute** XP/progression events through a shared contract; they never own their own scoring or write directly to `lib/xp.ts` / `lib/achievements.ts`.
- That contract should be defined alongside — or reuse — the fact bus (§4), since it has the same shape: a module asserts something about the user, and shared infrastructure resolves it.
- The manifest expresses gamification as *contributed, not owned*: no `kind: 'realm'` manifest for guilds/leaderboard.
- `/leaderboard` and `/guilds` remain as surfaces **of the shared substrate**, reachable regardless of which modules are enabled.
- Worship is never made competitive (PRD §4.3): no prayer-derived progression event may reach a leaderboard, guild, or any comparative surface.

The transport for that contract is settled by D9, and consent for comparative surfaces by D10.

### D9 — The progression/XP contract sits BESIDE the fact bus, not inside it

The progression contract is a **separate append-only event transport** with its own module (e.g. `lib/progression/*`). It is **not** a `FactKind` and does not travel on the fact bus. It MAY reuse the bus's primitives and conventions — module id as source, provenance, the doctrinal guard, an injectable clock, a testable pure core — but it does not reuse the bus's storage or resolution.

*Rationale:* the fact bus answers "what is true right now". Facts expire (§4.1 `expiresAt`), and `resolveConflict` (§4.3) deliberately picks a single winner — or none at all — and discards the rest. Progression is the opposite shape: an append-only history that must never expire and must never be resolved away. Routing XP events through a conflict resolver would silently lose earned progression, which is exactly the failure PRD §3.9 forbids. §4.4 already states that facts are state, not a log; progression *is* the log, so it belongs elsewhere.

*Consequences to implement:*

- Progression events are **immutable and additive**: no expiry, no conflict resolution, no upsert-by-id semantics. `publish()`'s "upsert by `fact.id`" (§4.2) has no analogue here.
- Modules **contribute** progression events; gamification infrastructure owns scoring and aggregation. A module never computes its own XP totals.
- The doctrinal guard applies here too: no worship-derived progression event may be comparative (D8, D10).
- Idempotency still matters — a double-fired event must not double-count — so the event carries an explicit **dedupe key** that the ingestion path uses to drop replays. That is deduplication, not mutation: the first write wins and nothing is overwritten.

### D10 — Comparative surfaces are OPT-IN, not merely disableable

Comparative and social surfaces — `/leaderboard`, guild rankings, and any cross-user comparison — **default to OFF** and render nothing cross-user until the user explicitly opts in.

*Rationale:* a user must never discover after the fact that they were ranked against other people. Opt-out means the social comparison already happened before they found the setting. Since gamification is infrastructure and cannot be "turned off" like a module (D8), the consent has to live at the comparative-surface level rather than at module enablement.

*Consequences to implement:*

- Comparative surfaces are gated on explicit consent; default off, no dark patterns, no pre-checked boxes.
- **Non-comparative progression stays on by default** — personal XP, ranks, streaks and personal bests are self-referential and carry no social exposure. Declining comparison must never cost a user their own progression.
- **Worship-derived events remain non-comparative at ALL times.** Opting in widens which *non-worship* surfaces may compare; it never makes salah or Hifz data comparable against other users. Consent cannot unlock worship comparison. See [`CONSTITUTION.md`](../../CONSTITUTION.md) §11 (voluntary worship only) and §12 (prayer data is never shared), and D1.
- The manifest's `progressionEvents[].comparative: false | 'opt_in'` flag (§3.1) is the right shape. `'opt_in'` means **"eligible for comparison ONLY after explicit user consent"**. There is deliberately **no `true` value** — nothing is comparable by default, so an "always comparative" state is unrepresentable.

### D11 — Nothing is pre-selected at onboarding

The module selection screen ships with **no module pre-checked**, including Sahwa. The user deliberately chooses what Yansha helps with.

*Rationale:* Yansha OS is an opt-in lifestyle system. Pre-selecting modules — Sahwa most of all — presumes something about the user's life and their religion. A deliberate choice also makes the modular nature of the product legible from the very first screen: the user learns that Yansha is assembled, not delivered whole.

*Consequences to implement:*

- **The zero-modules-selected state must be handled gracefully.** A user must never land in an empty app with no path forward. Either require at least one selection before continuing, or provide an obvious guided path out of the empty state. Silently allowing "none" and dropping the user into a blank shell is a bug.
- **The screen must scale to 10–30 modules without becoming a wall of checkboxes.** Category grouping, search, and progressive disclosure are required — not a flat list (§8, §9).
- No dark patterns: no pre-checked boxes, and no visual weighting that functions as a default. Sahwa may be shown first as the current product focus, but "first" is not "selected".

### D12 — Facts are client-first

Facts derive **locally, each session**. Persist to Neon **only** what a specific feature genuinely requires, and any persistence of worship-derived facts is **opt-in**.

*Rationale:* facts are recomputable current state, not a historical record (D9, §4.4). Because they can always be re-derived, persistence is a *feature requirement* rather than a default. Keeping worship state on-device by default is the same instinct as [`CONSTITUTION.md`](../../CONSTITUTION.md) §12 (prayer data is never shared) — the safest place for worship state is the device it was produced on.

*Consequences to implement:*

- The fact bus remains the **client-side derivation layer**. Server-side persistence is an addition to a specific feature, never a property of the bus.
- Any future server-side need — e.g. the roadmap v2.5 prayer push notifications — must **justify its persistence explicitly**, persist the narrowest field it needs, and gate worship-derived facts behind opt-in consent.
- This interacts directly with bead **Yansha-mng** (the process-level `factBus` singleton SSR leak hazard). Client-first makes the **client-only construction** option strictly more attractive: if the bus is never meant to derive facts on the server, a bus that cannot be constructed on the server is a feature, not a limitation. D12 informs that bead's fix.

### D13 — Teacher visibility is per student-relationship

A teacher's access is scoped to **each individual student** and to **what that student specifically granted** — not a uniform scope conferred by joining a circle.

*Rationale:* consent belongs to the individual. A circle-wide grant means that joining a study group silently hands a mentor the same access to everyone in it, which is not a choice any single student made. Per-relationship scoping also survives the real case of a student belonging to multiple circles with different teachers, where a grant to one mentor must not leak to another.

*Consequences to implement:*

- The permission model keys on **`(teacherUserId, studentUserId, moduleId, scope)`** rather than `(circleId, scope)`.
- A student can **revoke one teacher** without leaving the circle, and without affecting their grants to other teachers.
- **RLS policies on the circles tables must express per-relationship access.** This is strictly stricter than the mentor-wide policies added by bead **Yansha-wg5**, and is a **required follow-up** to them — not a contradiction of them. Yansha-wg5's policies are a correct first pass; D13 tightens their predicates.
- `salah` remains **non-grantable to anyone at any granularity** (D1, [`CONSTITUTION.md`](../../CONSTITUTION.md) §12). Per-relationship scoping widens nothing here.

### D14 — Core fact kinds are maintainer-approved; third-party kinds MUST be namespaced

Core fact kinds (`day.fasting` and friends) are approved by maintainers. Third-party modules publish freely, but **only** under a required namespace segment — e.g. `acme.sleep_score` — which can never collide with a core kind.

*Rationale:* the core vocabulary is doctrinally loaded and belongs under maintainer control, while an ecosystem must be able to grow without a maintainer gatekeeping every integration. Namespacing gets both: a consumer can tell core data from third-party data from the kind string alone, so provenance is legible at a glance rather than requiring a lookup.

*Consequences to implement:*

- **A namespace segment is REQUIRED for every non-core kind, validated at publish time.** An unnamespaced kind that is not a known core kind is **rejected**, not silently accepted.
- Core kinds remain owned per `FACT_KIND_OWNERS`, and the **exclusive-vs-preferred ownership split being defined in bead Yansha-nxh applies to core kinds**. Third-party namespaced kinds are owned by their publishing module *by construction* — no ownership table entry is needed.
- **The doctrinal guard ([`CONSTITUTION.md`](../../CONSTITUTION.md) clause 11) applies to namespaced kinds too.** A third party must not be able to smuggle an obligatory-worship target through a namespace. See bead **Yansha-zr7**, which is hardening that guard.
- Namespace collision and squatting are a **governance** concern — worth a note in contribution docs, not a mechanism to build now.

### D15 — Facts are versioned; consumers IGNORE incompatible versions

Facts carry a schema version. Consumers declare which versions they accept and simply **ignore** anything incompatible — degrading to no adaptation. They never crash, and never guess at a payload shape they do not understand.

*Rationale:* with independently-versioned third-party modules there is no coordinated release, so a consumer *will* eventually meet a payload it does not understand. The contract already says the right response to missing or unusable data is silence rather than a fallback guess — see the tie-goes-to-silence rule in the conflict ladder (§4.3 rule 5) and the fail-closed rule for missing Quran data. A version mismatch is the same situation, so it gets the same answer.

*Consequences to implement:*

- `Fact` gains a schema version — already scoped in bead **Yansha-oge**; that bead is the implementation reference rather than a second definition here.
- **Consumers declare accepted version(s)**, and the bus (or the consumer helper) filters incompatible facts out of `query()` / `resolve()` results, so an incompatible fact can never win resolution.
- **An ignored fact must remain observable for debugging.** It is silent to the user, not invisible to the developer — it must show up in dev diagnostics rather than vanishing.
- **Additive payload evolution is the norm** so version bumps stay rare; a breaking change is a deliberate act, not an accident of refactoring.

---

## 1. Honest inventory — what exists today vs what is aspirational

### 1.1 Exists today (real code, working)

| Thing | File | Reality |
|---|---|---|
| Heuristic rule engine | `lib/engine/heuristic-engine.ts` | Real. Loops a static rulebook, `condition()` → `evaluate()`, sorts directives by priority, catches per-rule errors. ~50 lines, synchronous, no I/O. |
| Rulebook | `lib/engine/rules-registry.ts` | Real. 5 hardcoded rules, including `fasting_workout_adaptation`, `study_prayer_window_collision`, `zakat_nisab_readiness`, `grocery_budget_burn_rate`. |
| Context types | `lib/engine/types.ts` | Real. `GlobalContext` with one optional field **per hardcoded module** (`health`, `islamic`, `study`, `finance`, `circles`) and `LifeModuleId` as a closed union of exactly 5 ids. |
| Baselines | `lib/engine/baseline-calculator.ts` | Real and generic — moving average, stddev, trend. Currently **not called anywhere**. |
| Engine consumer | `components/hub/GlobalCommandCenter.tsx` | Real. The only caller. Builds context in a `useMemo`, evaluates, renders directives, and toggles `settings.activeModules` / `settings.isFastingToday`. |
| Prayer time math | `lib/prayerTimes.ts`, `lib/usePrayerTimings.ts` | Real and good. AlAdhan ISO-8601 timings, epoch-safe `nextPrayer()`, `calculateTahajjudWindow()`, `calculateDuhaWindow()`, cache + offline fallback. **No Suhoor/Iftar window derivation yet.** |
| Realm navigation | `components/RealmSwitcherModal.tsx` (`YANSHA_REALMS`), `components/AppShell.tsx` | Real, but hardcoded. Five realm objects, and five *separate hardcoded nav arrays* in `AppShell.tsx` selected by `pathname.startsWith(...)`. |
| Module toggles | `lib/types.ts` `Settings.activeModules` | Real field, closed union of 5 ids, persisted in the zustand store. Only the Hub reads it. |
| Persistence | `prisma/schema.prisma`, `prisma/migrations/rls.sql` | Real. Per-`userId` tables, RLS forced via `app.current_user_id`. `Circle` / `CircleMember` already carry `role` (`student`/`mentor`) and `sharedTelemetry`. |
| Store | `lib/store.ts` | Real, 1283 lines, **one monolithic zustand store** (`useSystem`) holding settings, workouts, meals, healthLogs, prayers, quests, streaks, prayer cache. `STORAGE_KEY = "arise-system-v1"`, `SCHEMA_VERSION = 2`. |

### 1.2 Aspirational / fake / missing

- **`buildGlobalContextFromStore` is substantially fabricated.** `lib/engine/context-builder.ts` hardcodes `nextPrayerTimeRemainingMinutes: 14`, `quranMinutes: 20`, `hifzAyahsRevised: 10`, `dhikrCount: 100`, `activeBlockOverlapWithPrayer: true`, `todaySpend: 18.5`, all `rollingBaselines`, and derives calories from whether a weight was logged. The rules therefore fire on demo data, not user data. This is the single biggest gap between the demo and the product.
- **No module registry.** "Modules" exist only as folder names under `app/`, hardcoded nav arrays, a 5-way union type, and realm cards.
- **Onboarding does not select modules.** `components/Onboarding.tsx` (1468 lines) has no module concept at all — it collects body metrics, prayer method/school, and location. Module selection lives only in the Hub as post-hoc toggles.
- **No fact bus.** Cross-module effects today are rules reading two branches of one god-object context.
- **No Teacher module.** `role` exists on `CircleMember` in Prisma and `TeacherHalaqahDeck.tsx` exists as UI, but there is no role concept in the client store, no permission layer, and no student/teacher switching.
- **Route/realm mismatch (decided, not yet implemented).** `app/` has `worship`, `nutrition`, `training`, `health`, `finance`, `treasury`, `circles`, `academy`, `guilds`, `leaderboard`, `intel`, `study`, `hub`, `sahwa/*`. `finance`/`treasury` and `circles`/`academy` are still duplicate full pages in code. Canonicalisation is now settled by D4–D8 (§0, §11.1); the redirect + rollup work is a tracked bead. `app/worship/page.tsx` is already a redirect and is ratified as-is.
- **Prisma has no fact/adaptation tables**, no module-enablement table, and no user-level role.

### 1.3 What this means for the design

The engine spine (`condition`/`evaluate`/priority-sorted directives + `UIOverride`) is **sound and worth keeping**. The two things that do not scale to 10–30 modules are (a) `GlobalContext` having one hardcoded optional field per module, and (b) context being fabricated by a single central builder that must know every module's internals. Both are fixed by inverting the direction: modules **publish facts**, the engine **reads facts**.

---

## 2. Core principle

> A module may **publish facts about the user** and **subscribe to facts published by others**. A module may never read or write another module's state.

Direct cross-module access is forbidden because:

1. **N² coupling.** With 5 modules, direct access is 20 possible edges and feels fine. At 30 modules it is 870. Every new module would need to know about the existing ones, and every existing module would eventually import the new one. The owner's stated requirement — *module #27 must be addable without modifying the other 26* — is mathematically impossible under direct access.
2. **Optionality breaks it.** Modules are user-selected. If Workout imports Sahwa's store to check fasting, Workout stops compiling/behaving correctly for a user who never enabled Sahwa. Facts degrade gracefully: absent fact = no adaptation.
3. **Third-party contribution.** In an open-source project, an outside contributor cannot be trusted with (and should not need) write access to another module's state. A fact contract is a reviewable public API; a store reach-in is not.
4. **Provenance and honesty.** Sacred-content doctrine requires knowing *who asserted what and how confidently*. `isFastingToday: boolean` on a global settings object carries no provenance. A fact does.

---

## 3. Module manifest & registry

### 3.1 What a module is

A module is a directory (`modules/<id>/`) exporting exactly one manifest. Everything the shell needs — nav, onboarding copy, settings panel, published/consumed facts, permissions — is declared there. Adding module #27 touches `modules/module27/**` plus **one line** in `modules/index.ts`.

```ts
// lib/modules/manifest.ts  (sketch)

export type ModuleId = string; // opaque; NOT a closed union — that is the point

export interface ModuleManifest {
  id: ModuleId;                     // "sahwa" | "workout" | "study" | "finance" | "teacher" | ...
  name: string;                     // "Sahwa"
  tagline: string;                  // shown in onboarding + RealmSwitcher
  category: 'spiritual' | 'physical' | 'cognitive' | 'financial' | 'social' | 'meta';
  version: string;                  // semver, for fact-schema compatibility
  icon: string;                     // lucide name or /icons/*.svg path

  /** Meta modules (Teacher) modify other modules rather than owning a realm.
   *  Gamification (XP/ranks/guilds/leaderboard) is NOT a module at all (D8) —
   *  it is cross-cutting infrastructure and has no manifest. */
  kind: 'realm' | 'role-overlay';

  /** Nav is data, not a hardcoded array in AppShell.tsx.
   *  One module may own several surfaces: Workout's rootHref is /training and
   *  /health is a nav entry of the same module (D7). */
  rootHref: string;
  nav: Array<{ href: string; label: string; icon?: string }>;

  /** Optional intel-contribution capability (D6).
   *  A module that sets this appears in the cross-module /intel rollup. The
   *  rollup iterates enabled manifests and MUST NOT hardcode a module list, so
   *  module #27 shows up by declaring this and nothing else. Absent = the
   *  module simply contributes nothing; the rollup degrades silently. */
  intel?: {
    /** Section heading in the rollup. */
    label: string;
    /** Lazily imported panel. Renders only this module's own reasoning. */
    panel: () => Promise<{ default: React.ComponentType<IntelPanelProps> }>;
    /** Optional deep link to the module's own full intel surface, e.g. /sahwa/intel. */
    href?: string;
    order?: number;
  };

  /** Gamification is CONTRIBUTED, never owned (D8). A module declares which
   *  progression events it emits; XP maths, ranks, guilds and leaderboards live
   *  in shared infrastructure. A module never writes lib/xp.ts state itself, and
   *  no worship-derived event may be marked comparative (PRD 4.3).
   *
   *  These events do NOT travel on the fact bus — progression is a separate
   *  append-only transport (D9). This field is a declaration only; the events
   *  themselves are emitted through lib/progression, not publish().
   *
   *  `comparative` semantics (D10):
   *    false     -> never comparable against other users, under any setting.
   *                 Required for every worship-derived event.
   *    'opt_in'  -> eligible for cross-user comparison ONLY after explicit user
   *                 consent, which defaults to OFF.
   *  There is deliberately NO `true` value: nothing is comparable by default,
   *  so "always comparative" is unrepresentable rather than merely discouraged. */
  progressionEvents?: Array<{ key: string; label: string; comparative: false | 'opt_in' }>;

  /** Registry-driven onboarding. Steps are lazily imported. */
  onboarding?: {
    summary: string;                // one sentence shown on the pick-your-modules screen
    recommendedWith?: ModuleId[];   // used for grouping, never for auto-enabling
    steps: () => Promise<{ default: React.ComponentType<ModuleStepProps> }>;
  };

  /** Settings panel, lazily imported; the settings page composes these. */
  settingsPanel?: () => Promise<{ default: React.ComponentType }>;

  /** The ONLY state this module owns. Namespaced slice key in persisted storage. */
  stateSlice: string;               // e.g. "sahwa" -> storage key `yansha.v3.sahwa`

  /** Declared fact contract — enforced in tests and reviewable in PRs. */
  publishes: FactKind[];
  consumes: FactKind[];

  /** Soft dependencies only. A module must degrade, never crash, if these are off. */
  enhancedBy?: ModuleId[];
  /** Hard dependencies. Enabling this auto-prompts to enable these. Use sparingly. */
  requires?: ModuleId[];

  /** Permissions this module exposes to role overlays (see §7). */
  shareableScopes?: Array<{ scope: string; label: string; sensitivity: 'normal' | 'worship' | 'health' }>;

  /** Fact producers + adaptation consumers, lazily imported. */
  factProducer?: () => Promise<{ default: FactProducer }>;
  rules?: () => Promise<{ default: HeuristicRule[] }>;
}
```

```ts
// lib/modules/registry.ts (sketch)
// Realms: sahwa, workout (/training + /health), nutrition, study, finance (/treasury).
// Role overlay: teacher (/academy). Gamification is NOT here — it is infrastructure (D8).
const MANIFESTS: ModuleManifest[] = [sahwa, workout, nutrition, study, finance, teacher /* , ...module27 */];

export function allModules(): ModuleManifest[];
export function enabledModules(enabled: ModuleId[]): ModuleManifest[];
export function moduleById(id: ModuleId): ModuleManifest | undefined;
export function navFor(id: ModuleId, enabled: ModuleId[]): NavItem[];
/** Drives the /intel rollup (D6). No caller ever names a module. */
export function intelContributors(enabled: ModuleId[]): ModuleManifest[];
```

### 3.1a The module set, after D4–D8

| Module | `kind` | `rootHref` | Other surfaces |
|---|---|---|---|
| Sahwa | realm | `/sahwa` | `/sahwa/salah` (canonical prayer route; `/worship` redirects), `/sahwa/hifz`, `/sahwa/arabic`, `/sahwa/intel` |
| Workout | realm | `/training` | `/health` (D7 — one module, two surfaces) |
| Nutrition | realm | `/nutrition` | — (separate module, D2) |
| Study | realm | `/study` | — |
| Finance | realm | `/treasury` | `/finance` redirects (D4) |
| Teacher | role-overlay | `/academy` | `/circles` redirects (D5) |

Not modules: **gamification infrastructure** (`/leaderboard`, `/guilds`, XP, ranks — D8) and the **`/intel` rollup**, which is shell-level and rendered from `intelContributors()` (D6). Of those infrastructure surfaces, the comparative ones (`/leaderboard`, guild rankings) render nothing cross-user until the user explicitly opts in (D10); personal progression renders regardless.

### 3.2 What this replaces

- `YANSHA_REALMS` in `components/RealmSwitcherModal.tsx` → derived from `allModules().filter(m => m.kind === 'realm')`.
- The five hardcoded nav arrays in `components/AppShell.tsx` → `navFor(currentModuleId, enabled)`.
- `LifeModuleId` union in `lib/engine/types.ts` → `ModuleId` (string) validated against the registry at runtime.
- `Settings.activeModules` typed union in `lib/types.ts` → `ModuleId[]`, with unknown ids preserved (never silently dropped — a user who disables a plugin then reinstalls it must not lose their selection).

### 3.3 Canonicalisation required first

The registry cannot have two modules owning the same domain.

**Settled — every row of §11.1 now has one canonical owner (D2, D4–D8):**

- **Nutrition** is its own module owning `/nutrition` (D2).
- **`/treasury`** is canonical for Finance; `/finance` redirects (D4).
- **`/academy`** is canonical for Circles, under the Teacher role overlay; `/circles` redirects (D5).
- **`/sahwa/intel`** stays Sahwa-owned; `/intel` is a shell-level cross-module rollup (D6).
- **Workout** is one module owning `/training` (canonical) and `/health` (D7).
- **Gamification** (`/guilds`, `/leaderboard`, XP, ranks) is infrastructure with no manifest (D8), fed by a separate append-only progression transport (D9), with its comparative surfaces gated on explicit opt-in (D10).

Redirects follow the pattern `app/worship/page.tsx` already uses — that file is a `router.replace("/sahwa/salah")` and is **ratified as-is**, not changed. The registry can now be written; the redirect and rollup work is tracked separately and does not block Yansha-jdb.

---

## 4. The shared context bus (fact contract)

### 4.1 Fact schema

```ts
// lib/context/facts.ts (sketch)

/** Registered fact kinds. The unnamespaced kinds below are CORE and maintainer-approved.
 *  Third-party modules MUST publish under a namespace segment (D14), e.g. "acme.sleep_score",
 *  which by construction can never collide with a core kind. An unnamespaced kind that is not
 *  a known core kind is REJECTED at publish time — not silently accepted. */
export type FactKind =
  | 'day.fasting'
  | 'day.eating_window'
  | 'day.energy_budget'
  | 'day.high_cognitive_load'
  | 'body.injury'
  | 'body.sleep_debt'
  | 'money.constrained'
  | 'schedule.blocked_window'
  | 'role.active'
  | (string & {});

export interface TimeWindow {
  /** ISO 8601 WITH offset — same convention as lib/prayerTimes.ts timings. */
  startIso: string;
  endIso: string;
}

export interface Fact<K extends FactKind = FactKind, P = unknown> {
  id: string;                 // stable: `${source}:${kind}:${subjectDate}` so republish upserts
  kind: K;
  source: ModuleId;           // who asserted it
  subjectDate: string;        // "YYYY-MM-DD", local day the fact is about
  window?: TimeWindow;        // optional intra-day precision
  payload: P;

  /** 0..1. Declared = 1.0 (user said so). Inferred = lower. Never fabricate 1.0. */
  confidence: number;
  provenance:
    | { type: 'user_declared' }
    | { type: 'derived'; from: string[]; note?: string }   // e.g. from AlAdhan timings
    | { type: 'inferred'; model: string }
    | { type: 'external'; service: string };

  /** Epoch ms. Facts self-expire; the bus never serves stale facts. */
  expiresAt: number;
  publishedAt: number;
  /** Set when the user explicitly overrode an inferred fact. Wins all conflicts. */
  userOverride?: boolean;

  /** Payload schema version (D15; scoped in bead Yansha-oge). Consumers declare which
   *  versions they accept and ignore the rest — see §4.5. */
  schemaVersion: number;
}
```

Concrete payloads:

```ts
export interface FastingPayload {
  fastType: 'ramadan' | 'sunnah_monday_thursday' | 'white_days' | 'voluntary' | 'qada' | 'other';
  suhoorEndsIso: string;  // = Fajr (imsak handled as a user-configurable buffer, never a ruling)
  iftarStartsIso: string; // = Maghrib
  /** Explicitly nullable: the user may be exempt/travelling — we never model rulings. */
  exempt?: boolean;
}

export interface InjuryPayload { region: string; severity: 'niggle' | 'limiting' | 'acute'; avoidPatterns: string[]; }
export interface MoneyConstrainedPayload { severityPct: number; capPerDay?: number; currency: string; }
```

### 4.2 Bus API

```ts
// lib/context/bus.ts (sketch)
export interface FactBus {
  publish(fact: Fact): void;                         // upsert by fact.id
  retract(id: string): void;                         // module disabled, or user undid a declaration
  query<P>(kind: FactKind, date: string): Fact<P>[]; // all non-expired facts of a kind
  resolve<P>(kind: FactKind, date: string): Fact<P> | null; // single winner, see §4.3
  subscribe(kinds: FactKind[], cb: (facts: Fact[]) => void): () => void;
  snapshot(date: string): FactSnapshot;              // what the engine consumes
}
```

Implementation: a small zustand store (`lib/context/store.ts`) holding `Record<factId, Fact>` plus a `Map<FactKind, Set<factId>>` index. Publishing is O(1); `query` is O(facts-of-that-kind), not O(all facts). This is deliberately *not* part of `useSystem` — see §9.

### 4.3 Conflict resolution

Two modules may assert the same kind for the same day (Sahwa says fasting; a hypothetical Calendar module infers not-fasting from a lunch meeting). Deterministic ladder, applied in order:

1. **`userOverride: true` wins.** Always. The user's explicit statement is never outvoted by inference.
2. **Higher `confidence` wins.** `user_declared` (1.0) beats `derived` beats `inferred`.
3. **Owning module wins.** Each `FactKind` has a declared `ownerModule` in the registry (`day.fasting` → `sahwa`). Ties break in the owner's favour.
4. **Most recent `publishedAt` wins.**
5. **If still tied, no fact is resolved** and the engine emits no adaptation. Silence is safer than a coin flip — especially for worship-adjacent facts.

`resolve()` returns the winner; `query()` returns all, so a UI can honestly show "Sahwa says fasting, Calendar disagrees" rather than silently picking.

### 4.4 Why facts and not events

Facts are **state about a subject day**, idempotent and re-derivable; events are a log. Reloading the app must reproduce the same adaptations, so the bus stores current facts and (optionally) persists them per day. An event log can be added later for audit without changing the contract.

**Persistence is client-first (D12).** Because facts are re-derivable current state, the default is to derive them locally each session and persist nothing. Writing a fact to Neon is a *feature requirement* that a specific feature must justify — server-side prayer push notifications (roadmap v2.5) being the obvious candidate — and any persistence of **worship-derived** facts is opt-in, consistent with [`CONSTITUTION.md`](../../CONSTITUTION.md) §12 and PRD §4.7. The bus itself stays the client-side derivation layer; it never becomes a server-side store by default.

This is precisely why progression/XP does **not** ride the bus (D9). Facts expire and `resolve()` (§4.3) discards every loser; progression is an append-only history that must never expire and must never be resolved away, so putting XP on this transport would silently drop earned progression. Progression lives in its own append-only module beside the bus, reusing the bus's conventions (module id as source, provenance, doctrinal guard, injectable clock, pure testable core) but none of its expiry, upsert-by-id, or conflict-resolution semantics. Replay safety there comes from a **dedupe key** on the event, not from upsert.

### 4.5 Versioning and compatibility (D15)

Every fact carries a `schemaVersion` for its payload (bead **Yansha-oge**). Because third-party modules version independently and there is no coordinated release, a consumer will eventually meet a payload shape it does not understand.

The rule is **accept-and-ignore**:

- A consumer declares the version(s) it accepts alongside the kinds it consumes.
- The bus (or the consumer helper) **filters incompatible facts out of `query()` and `resolve()`** before the conflict ladder runs, so an incompatible fact can never win resolution or produce a half-understood adaptation.
- The consumer then simply sees no fact and **degrades to no adaptation**. It never crashes, and it never guesses at an unknown payload shape. This is the same instinct as §4.3 rule 5 (tie goes to silence) and the fail-closed rule for missing Quran data: unusable data means silence, not a fallback guess.
- **Ignored facts stay observable for debugging.** Silence is a *user-facing* property; a dropped fact must surface in dev diagnostics (a dev-only "N facts ignored: kind@version" readout), because a consumer that mysteriously stops adapting is otherwise unfixable.

**Evolve payloads additively** — new optional fields, no reinterpretation of existing ones — so a version bump stays rare and a breaking change remains a deliberate act.

---

## 5. Heuristic engine role

**Hard constraint — voluntary worship only (D3).** The engine may adapt *voluntary* practice: Manzil review volume, dhikr targets, optional Quran reading time. It may **never** emit an adaptation that touches obligatory prayer (salah) or zakat — not schedule, target, reminder, or calculation. Concretely: no rule may declare `targetModule: 'sahwa'` with a `kind` that alters salah or zakat state, and any adaptation reaching a prayer or zakat surface is a bug, not a tuning problem. Worship adaptations that *are* permitted remain suggestions with dignified copy and are never framed as failure. This constraint is mirrored in [`CONSTITUTION.md`](../../CONSTITUTION.md) and [`AGENTS.md`](../../AGENTS.md) so it survives module churn.

**Boundary:**

- **Modules** own domain logic, domain data, and *all* rendering. A module decides what "de-load a workout" means.
- **The engine** owns correlation only. It reads the fact snapshot, evaluates rules, and emits `Adaptation` objects addressed to modules. It never renders and never mutates module state.

```ts
export interface Adaptation {
  id: string;
  ruleId: string;
  targetModule: ModuleId;      // who should react
  kind: string;                // "suppress_reminders" | "shift_window" | "deload" | "retarget"
  payload: unknown;            // module-specific, validated by the target module
  priority: number;            // 1 critical .. 4 low  (unchanged from today)
  rationale: string;           // human-readable, shown in Intel — required, no black boxes
  sourceFacts: string[];       // fact ids that produced it — provenance chain to the UI
}
```

### 5.1 Changes to existing engine files

| File | Change |
|---|---|
| `lib/engine/types.ts` | `GlobalContext` loses its per-module optional fields; gains `facts: FactSnapshot` + `enabledModules: ModuleId[]` + `baselines`. `LifeModuleId` → `ModuleId`. `UIOverride` survives as one `Adaptation.kind`. `HeuristicRule` gains `requiresModules: ModuleId[]` and `consumesFacts: FactKind[]` so the engine can skip rules whose modules are disabled without running `condition()`. |
| `lib/engine/heuristic-engine.ts` | Loop body is unchanged in spirit. Add: pre-filter by `requiresModules ⊆ enabledModules`, index rules by `consumesFacts` so only rules touching changed fact kinds re-run, and return `Adaptation[]` alongside the existing `SystemDirective[]`. Keep the per-rule try/catch — with third-party modules it becomes load-bearing. |
| `lib/engine/rules-registry.ts` | Becomes a *composed* registry: `GLOBAL_HEURISTIC_RULEBOOK` = cross-cutting rules only; module rules come from `manifest.rules()`. The existing 5 rules migrate to fact conditions (e.g. `ctx.islamic?.isFastToday === true` → `ctx.facts.resolve('day.fasting', ctx.dateStr) != null`). |
| `lib/engine/context-builder.ts` | **Shrinks drastically and stops fabricating.** It no longer knows about health/islamic/study/finance. It calls each enabled module's `factProducer`, collects facts into the bus, and assembles `{ dateStr, enabledModules, facts, baselines }`. Fabricated constants are deleted, not ported. |
| `lib/engine/baseline-calculator.ts` | Unchanged, finally used: baselines computed from real store history feed `rollingBaselines`. |
| `components/hub/GlobalCommandCenter.tsx` | Keeps its shape; reads adaptations instead of ad-hoc rule output. Its module toggles move to registry-driven controls. |

---

## 6. Traces

### 6.1 The fasting trace (canonical, end to end)

**Step 1 — declaration.** The user marks fasting. Today this is `updateSettings({ isFastingToday: true })` from `components/hub/GlobalCommandCenter.tsx`; in the target it is a Sahwa-owned action writing to the Sahwa slice.

**Step 2 — Sahwa derives the window and publishes.** `modules/sahwa/facts.ts` (new) reads the Sahwa slice and today's timings from `lib/usePrayerTimings.ts` → `usePrayerTimings()`. It derives the window using the same epoch-safe conventions as `lib/prayerTimes.ts`; the natural home for the derivation is a new `calculateFastingWindow(timings)` sitting beside the existing `calculateTahajjudWindow()` / `calculateDuhaWindow()` — Suhoor ends at `timings.Fajr`, Iftar starts at `timings.Maghrib`, both already ISO-8601 with city offset.

```ts
publish({
  id: 'sahwa:day.fasting:2026-08-27',
  kind: 'day.fasting',
  source: 'sahwa',
  subjectDate: '2026-08-27',
  window: { startIso: timings.Fajr, endIso: timings.Maghrib },
  payload: { fastType: 'voluntary', suhoorEndsIso: timings.Fajr, iftarStartsIso: timings.Maghrib },
  confidence: 1.0,
  provenance: { type: 'user_declared' },
  expiresAt: endOfLocalDay,
  publishedAt: Date.now(),
});
```

If timings are stale or offline (`usePrayerTimings()` returns `stale`/`offline`), the fact is still published with `confidence: 0.6` and `provenance: { type: 'derived', from: ['aladhan-cache'], note: 'stale timings' }`. Consumers may show approximate times but must not present them as exact — same honesty rule the prayer UI already follows.

**Step 3 — engine correlates.** `evaluateLifeOSContext` runs the migrated `fasting_workout_adaptation` rule (from `lib/engine/rules-registry.ts`) plus new nutrition/hydration rules. Each emits `Adaptation`s addressed at specific modules, carrying the concrete window rather than prose.

**Step 4 — Nutrition reacts.** Target `app/nutrition/page.tsx` (+ the meal-logging path `logMeal` in `lib/store.ts`):
- `suppress_reminders` with `{ during: { startIso: Fajr, endIso: Maghrib } }` → no "log your lunch" prompts during daylight. This is the concrete implementation of PRD §4.9 ("no hardcoded daytime drink prompts"), which is currently only a stated intent.
- `shift_window` → the daily macro ring re-buckets into a **Suhoor** bucket (pre-Fajr) and an **Iftar** bucket (post-Maghrib) instead of breakfast/lunch/dinner. Same totals from `Profile.calorieGoal` / `proteinGoal`; different partitioning. Targets are not silently cut — fasting redistributes, it does not diet.

**Step 5 — Hydration reacts.** Target `app/health/page.tsx`, which owns `waterMl` via `logHealth` in `lib/store.ts` against `Profile.waterGoalMl`:
- The 2.5 L goal is unchanged in total but the *pacing* target moves entirely into the Maghrib→Fajr window. The "you're behind on water" nudge must be computed against elapsed time **within the drinking window**, not since midnight — otherwise a fasting user is told they are failing all afternoon. That single line is the whole reason this fact needs a window and not a boolean.

**Step 6 — Workout reacts.** Target `app/training/page.tsx` and the quest generator (`addQuestProgress` / quest templates in `lib/quests.ts`):
- `deload` → intensity modifier applied for the day; heavy compound work is not scheduled during the fasted window.
- `shift_window` → recommended session time moves to ~45–90 min post-Maghrib (fed, rehydrating) or pre-Fajr for users who prefer fasted training. Both options are offered; we recommend, we do not dictate.
- If a `body.sleep_debt` fact is also present (Ramadan + Tahajjud is the common case), the existing `sleep_debt_strain_regulation` rule stacks and the higher-priority de-load wins rather than double-applying.

**Step 7 — the user overrides.** The user says "I'm training heavy anyway." That publishes a `userOverride` fact which, by §4.3 rule 1, suppresses the de-load adaptation for the day. The app advises; the user decides.

Note what did **not** happen: Workout never imported anything from Sahwa. Turning Sahwa off simply means `day.fasting` is never published, and Workout behaves as a plain training app.

### 6.2 Study publishes `day.high_cognitive_load` ("exam tomorrow")

Source `app/study/page.tsx` publishes `{ kind: 'day.high_cognitive_load', subjectDate: tomorrow, payload: { reason: 'exam', intensity: 0.9 } }`.

- **Workout** consumes it: caps training strain the evening before (CNS protection), reusing the same `deload` adaptation kind as fasting — proof the contract generalises rather than being fasting-shaped.
- **Sleep/health** (`app/health/page.tsx`) shifts the sleep target earlier and raises the sleep goal for that night.
- **Sahwa** consumes it *gently and optionally*: it may surface a shorter Manzil review instead of a heavy new Sabaq (`lib/sabaq-sabqi-manzil.ts`, `components/HifzDailyPlanDeck.tsx`). It must **never** suppress prayer, and must never frame reduced Quran time as a failure — worship adaptations are suggestions with dignified copy, per PRD §4.
- **Nutrition** does nothing. It declared no interest in this fact kind. That is the system working.

### 6.3 Finance publishes `money.constrained`

Source `app/treasury/page.tsx` (canonical per D4; `/finance` becomes a redirect) publishes `{ kind: 'money.constrained', payload: { severityPct: 0.9, capPerDay: 12, currency: 'USD' } }` when month-to-date spend crosses the budget threshold — the honest version of today's `grocery_budget_burn_rate` rule, which currently reads a hardcoded `todaySpend: 18.5`.

- **Nutrition** consumes it: meal suggestions re-rank toward cost-dense protein (eggs, lentils, oats) while holding the protein target. Targets bend on *cost*, never below the PRD's safe nutritional minimums.
- **Workout** consumes it weakly: prefers bodyweight/home sessions over anything implying gym or equipment spend.
- **Sahwa** ignores it entirely, with one exception worth stating explicitly: zakat calculations must **never** be adjusted by a budget-pressure fact. Fiqh obligations are not heuristics. This is a hard rule for the fact-kind ownership table.

### 6.4 Workout publishes `body.injury`

`{ kind: 'body.injury', payload: { region: 'knee', severity: 'limiting', avoidPatterns: ['squat', 'lunge', 'run'] } }`.

- **Workout** self-consumes: substitutes patterns.
- **Sahwa** consumes it for **posture guidance only**: surfaces the fiqh-sourced content on praying seated when standing/prostration is painful (`app/sahwa/fiqh/`). It presents *sourced permissibility information*, never a ruling of its own, and never auto-marks a prayer modality. Zero-assumption doctrine applies: explain the concession plainly, cite the source, let the user choose.
- **Study** consumes it faintly: suggests standing-desk/posture breaks off.

---

## 7. Teacher as a role overlay, not a sibling module

Teacher has `kind: 'role-overlay'`. It owns no realm of its own; it changes **who you are inside other modules**. Its surface is `/academy` (D5, `/circles` redirects). Gamification infrastructure (D8) sits in the same structural category — cross-cutting substrate rather than a realm — but differs in that it has no manifest at all, because it is not user-selectable.

```ts
export interface RoleAssignment {
  role: 'student' | 'teacher';
  scopeModule: ModuleId;        // teacher of Sahwa/Hifz, not teacher-of-everything
  circleId: string;             // always bound to a circle — no ambient global teachers
  grantedScopes: string[];      // e.g. ["sahwa.hifz.progress", "sahwa.qaida.mastery"]
}
```

**Visibility is per student-relationship, not per circle (D13).** The circle is the context in which a teacher and a student meet; it is *not* the unit of consent. Access is keyed on **`(teacherUserId, studentUserId, moduleId, scope)`** — every grant names one teacher and one student. Joining a circle grants nothing by itself. Consequently a student may grant different scopes to different teachers, may be in several circles with different teachers without leaking a grant across them, and may **revoke one teacher without leaving the circle** or disturbing any other grant.

Published as a `role.active` fact so other modules can adapt UI (a teacher viewing `/sahwa/hifz` sees roster review affordances; a student sees their own plan) without importing Teacher.

**Data visibility rules (non-negotiable):**

1. **Opt-in per scope, per teacher (D13).** `CircleMember.sharedTelemetry` in `prisma/schema.prisma` is the right hook for *what* is shared, but the grant must resolve to a specific teacher, not to every mentor in the circle. Prayer is not a grantable scope at any granularity (D1).
2. **Prayer data is not shareable at any setting (D1).** `salah` is removed from the scope vocabulary entirely — not merely from the default. There is no grantable `salah` / `salah.adherence` scope, no UI toggle offering it, and no server action that accepts it. A teacher may see *assigned Hifz work* (`hifz.assignment_progress` — the student asked to be taught); a teacher never sees prayer adherence. PRD §4.3 forbids social comparison of worship, and a scope that merely defaults off still invites the ask.
3. **Health and finance are never grantable to a Hifz teacher.** Scope grants are per-module, and `shareableScopes` in the manifest is the allowlist.
4. **Revocation is immediate and retroactive in the UI.** A student who revokes a scope makes the teacher's view empty on next fetch.

**Server enforcement.** Client-side role checks are advisory. `prisma/migrations/rls.sql` currently forces RLS with a single owner policy (`current_setting('app.current_user_id')`) across the tenant tables, and — importantly — `circles` / `circle_members` / `circle_assignments` are **not** in that FORCE-RLS array. Adding them is part of the D1 privacy bead and is not optional groundwork. Teacher access requires a *second* policy family: "readable if a `circle_members` row grants the requesting user a scope covering this row." That is a genuinely harder policy than owner-equality and must be designed before any teacher feature ships, not after.

Bead **Yansha-wg5** added a first pass of mentor-wide and member policies on those tables. **D13 requires tightening them to per-relationship predicates**: the policy must test that *this* student granted *this* teacher *this* scope in *this* module, so that a mentor cannot read a student who never granted them anything, and a cross-student read is denied even inside a shared circle. That tightening is a required follow-up to Yansha-wg5, not a reversal of it.

**Honest warning about retrofitting.** Roles are the single most painful thing to add late, because every query written today implicitly assumes `userId = me`. What must be **reserved now**, even though nothing uses it:

- A `viewerUserId` vs `subjectUserId` distinction in any new data-access helper (`lib/db.ts`, `lib/actions/**`). Never assume they are equal.
- The `role.active` fact kind reserved in the fact registry, even unpublished.
- A `scope` concept on `CircleMember` beyond the current loose `sharedTelemetry: String[]` — string arrays with no enum will rot.
- No new Prisma table without `userId`, and none should be added to RLS-exempt status casually.

---

## 8. Onboarding & module lifecycle

**Selection.** After the identity step, one screen: "What do you want Yansha to help with?" rendered from `allModules().filter(kind === 'realm')`. **Nothing is pre-selected (D11)** — not even Sahwa. Sahwa stays first-class in the default view since it is the current focus, but appearing first is not the same as being checked.

Two requirements follow from D11:

- **Zero-state.** The user must not be able to finish onboarding into an empty app with no path forward. Either require at least one selection to continue, or give the empty state an obvious guided path (a "not sure? start here" affordance that leads somewhere real).
- **Scale.** The screen must still work at 10–30 modules. Not 30 checkboxes — group by `category`, show 5–6 primary cards with a "more modules" disclosure, and add search once the registry outgrows one screen. Progressive disclosure is a requirement of this screen, not a polish item (§9).

Then, and only then, the shell lazily loads `manifest.onboarding.steps()` for the **chosen** modules and runs them in sequence. `components/Onboarding.tsx` today is a 1468-line monolith collecting body metrics *and* prayer method — those split into the Workout and Sahwa module steps respectively. This is what makes onboarding stay ~4 screens with 30 modules installed.

**Enabling later.** Enabling a module runs its onboarding steps on demand (a modal, not a re-onboard), registers its nav, and starts its fact producer. Facts appear; adaptations start next evaluation tick.

**Disabling.** Three rules:

1. **Facts are retracted, not deleted.** `bus.retract()` removes them from resolution so no module adapts to a disabled module's assertions. Any adaptation sourcing a retracted fact is dropped on the next tick.
2. **The module's own data is retained**, quarantined, and never destroyed (PRD §3.9: "nothing is ever punitively deleted"). Re-enabling restores it intact.
3. **Consumers degrade silently.** No "Sahwa is disabled" nags in Workout. Absent fact = plain behaviour.

Purging a disabled module's data must be an explicit, separately confirmed destructive action.

---

## 9. Scaling to 10–30 modules

**Fact bus performance.** Facts are per-day and low-cardinality — realistically 10–40 live facts, not thousands. Keep it that way by construction: facts describe *the user's day*, not their event log. Concretely: index by kind, resolve lazily and memoise per `(kind, date)`, and have the engine re-run only rules whose `consumesFacts` intersect the changed kinds. Evaluation stays in the sub-millisecond range the engine already achieves.

**Breaking up the store.** `lib/store.ts` at 1283 lines with one `useSystem` is the main structural debt. Target: a small core store (identity, XP, enabled modules) plus one persisted slice per module under `yansha.v3.<moduleId>`. Benefits: a module's state ships and migrates with the module, `SCHEMA_VERSION` migrations become per-slice instead of one global version, and a broken third-party slice cannot corrupt the whole blob. Keep the existing "never wipe on parse failure, back up the raw blob" rule per slice.

**Lazy loading.** Manifests are tiny and static (id, name, icon, fact kinds). Everything heavy — onboarding steps, settings panel, rules, fact producer, route code — is behind a dynamic import. 30 registered modules should cost a few KB of manifest, not 30 bundles. Route code splits naturally via the Next.js App Router.

**Onboarding UI.** Covered in §8: category grouping + progressive disclosure, never a flat list.

**Third-party modules.** A module is a folder plus a registry line. For an open-source project this means a contributor's PR touches only `modules/<their-id>/**` and one import — reviewable in minutes. Guardrails:

1. **Namespacing is required, not encouraged (D14).** A third-party fact kind must carry a namespace segment (`acme.sleep_score`). This is **validated at publish time**: an unnamespaced kind that is not a known core kind is rejected. Namespaced kinds are owned by their publisher by construction, so they need no entry in `FACT_KIND_OWNERS`.
2. A module may only publish kinds it declared in `publishes` (enforced in a test).
3. **Core fact kinds are maintainer-approved (D14).** `day.fasting` and its siblings have an owner module and cannot be published by others; the exclusive-vs-preferred ownership split (bead **Yansha-nxh**) governs core kinds specifically.
4. **The doctrinal guard covers namespaced kinds too (D14, bead Yansha-zr7).** A namespace must not become a way to smuggle an obligatory-worship target (salah, zakat) past [`CONSTITUTION.md`](../../CONSTITUTION.md) clause 11.
5. **Version incompatibility is ignored, never fatal (D15, §4.5).** A third-party module bumping its payload version degrades its consumers to no adaptation rather than breaking them.
6. Sacred-content modules touching Quran text/audio require maintainer review — provenance and offline-coverage honesty are not delegable.

**Namespace collisions and squatting** are governance, not mechanism: worth documenting in the contribution guide, not worth building a registry service for now.

---

## 10. Migration path (no big-bang, Sahwa never stalls)

Each step is independently shippable and leaves the app working.

**Phase 0 — types only (no behaviour change).** Add `lib/modules/manifest.ts` and `lib/context/facts.ts` with types + tests. Nothing imports them yet. Zero risk.

**Phase 1 — registry describes what already exists.** Write manifests for the current five realms that *reproduce* today's hardcoded data. Point `RealmSwitcherModal.tsx` and `AppShell.tsx` nav at the registry. Pure refactor; visually identical. This is the step that unblocks everything else.

**Phase 2 — bus alongside the old context.** Ship `lib/context/bus.ts` and have Sahwa publish `day.fasting`. The old `buildGlobalContextFromStore` keeps working unchanged. Both paths run; nothing breaks.

**Phase 3 — one real consumer.** Migrate `fasting_workout_adaptation` to read from `ctx.facts` instead of `ctx.islamic`. Now one rule is honest end to end, and the pattern is proven on the owner's canonical example.

**Phase 4 — kill the fabrications.** Replace the hardcoded values in `context-builder.ts` module by module with real fact producers. Each removed constant is a visible honesty win. `nextPrayerTimeRemainingMinutes: 14` should be first — real data already exists in `usePrayerTimings()`.

**Phase 5 — split the store.** Extract module slices from `lib/store.ts` one at a time behind the persisted-slice migration, starting with the *least* entangled (finance/study), and doing Sahwa last precisely because it is under active development.

**Phase 6 — registry-driven onboarding**, then **Phase 7 — Teacher role scaffolding**.

**Sahwa protection rule:** no phase requires touching `lib/hifz-methodology.ts`, `lib/sabaq-sabqi-manzil.ts`, `lib/qaida-*`, or the ASR/recitation engines. Sahwa participates as a *publisher* (a small new `modules/sahwa/facts.ts`), which is additive. Hifz work continues in parallel throughout.

---

## 11. Open questions for the owner

Settled questions have moved to §0. Nutrition-as-its-own-module (was #2), the `salah` sharing scope (was #5), the worship-adaptation boundary (was #6), all of route canonicalisation (§11.1, now D4–D8), the progression transport (now D9), comparative-surface consent (now D10), default onboarding selection (now D11), fact persistence (now D12), Teacher scope granularity (now D13), third-party fact-kind governance (now D14) and fact versioning/compat (now D15) are decided. **Nothing remains open — see §11.2.**

### 11.1 Route canonicalisation — RESOLVED

Every row below is now decided (D2, D4–D8). The registry has exactly one canonical owner per domain, so Yansha-jdb is unblocked. The implementation of the redirects and the `/intel` rollup is tracked as its own bead — **this table records the decision, not the state of `app/`**.

| Domain | Conflicting routes that existed | Status | Canonical target |
|---|---|---|---|
| Finance | `app/finance/page.tsx` **and** `app/treasury/page.tsx` | **Resolved (D4)** | `/treasury` canonical; `/finance` → redirect |
| Circles / Teacher | `app/circles/page.tsx` **and** `app/academy/page.tsx` | **Resolved (D5)** | `/academy` canonical; `/circles` → redirect. Surface of the Teacher role overlay, not a social module |
| Prayer | `app/worship/page.tsx` **and** `app/sahwa/salah/page.tsx` | **Resolved — ratified** | `/sahwa/salah` canonical. `app/worship/page.tsx` already `router.replace("/sahwa/salah")`; ratified as-is, no code change |
| Intel | `app/intel/page.tsx` **and** `app/sahwa/intel/page.tsx` | **Resolved (D6)** | Both stay. `/sahwa/intel` is Sahwa-owned; `/intel` becomes a cross-module rollup over enabled modules that declare the intel capability |
| Social | `app/guilds/page.tsx`, `app/leaderboard/page.tsx`, `app/circles/page.tsx` | **Resolved (D8)** | No social module. `/guilds` + `/leaderboard` are surfaces of cross-cutting gamification infrastructure; `/circles` → `/academy` under the Teacher overlay |
| Body | `app/health/page.tsx` **and** `app/training/page.tsx` | **Resolved (D7)** | One **Workout** module. `/training` is `rootHref`; `/health` persists as a sub-surface in that module's nav |

### 11.2 Remaining questions — NONE

**All architecture questions raised in this pass are settled as of D1–D15.** The last two — fact-kind governance for third parties, and whether modules get a version/compat policy now — are decided by **D14** (core kinds maintainer-approved, third-party kinds require a namespace) and **D15** (facts are versioned; consumers declare accepted versions and ignore incompatible ones).

This section is kept deliberately empty rather than deleted, so a future reader knows the list was **closed on decisions**, not lost in an edit. New questions arising from implementation should be filed as beads and, if architectural, added back here.
