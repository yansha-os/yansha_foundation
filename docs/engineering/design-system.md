> **Engineering Reference Notice:** This document defines the visual design language ("The System", Solo Leveling aesthetic: dark mode, glassmorphism, HUD borders, neon cyan/amber accents) implemented in `@yansha-os/ui`. References to monolithic paths represent the original prototyping surfaces.

# Yansha OS Design System — "The System" (Solo Leveling)

**Status:** canonical spec. **Reference implementation:** the Workout/Health surfaces
(`app/training/page.tsx`, `app/health/page.tsx`, `components/SystemPanel.tsx`, `app/globals.css`).
**Audience:** anyone building one of the 10–30 modules described in
[`module-architecture.md`](./module-architecture.md).

The look was invented in the Workout module because it was built first. Every other surface is
a *derivation* of it, and several have drifted badly. This document freezes the language, names
the tokens, and defines what a module author may and may not change.

---

## 1. The canonical language (extracted, with citations)

### 1.1 Colour

Tailwind v4 is used **CSS-first** — there is no `tailwind.config.ts`. The palette lives in the
`@theme` block of `app/globals.css:3-20`:

| Raw name | Value | Role |
| --- | --- | --- |
| `abyss` | `#04060e` | page background (`html`, `app/globals.css:22-24`) |
| `void` | `#070b18` | sunken wells, inputs, list rows |
| `panel` | `#0a1024` | raised card fill |
| `panel-2` | `#0d1430` | overlay/gradient top stop |
| `line` | `#1c2a52` | hairline dividers and borders |
| `sysblue` / `sysblue-dim` | `#3fd8ff` / `#1e9fd0` | primary accent, gradients |
| `syspurple` / `syspurple-dim` | `#a855f7` / `#7c3aed` | achievement / secondary |
| `sysgold` | `#fbbf24` | worship, Sahwa, reverent register |
| `sysred` | `#f43f5e` | penalty, warning, locked |
| `sysgreen` | `#34d399` | completion |
| `ghost` | `#8ea7d8` | muted body text |

Body text is `#dbe6ff` (`app/globals.css:31`). The page background is not flat — it is two
radial gradient washes over abyss, cyan from the top and violet from the bottom-right
(`app/globals.css:26-34`).

### 1.2 Panel / card treatment

The single most identity-defining element, `.system-panel` (`app/globals.css:54-78`):

- Fill: `linear-gradient(160deg, rgba(13,20,48,0.85), rgba(7,11,24,0.92))`
- Border: `1px solid rgba(63,216,255,0.28)`
- Glow: `0 0 12px rgba(63,216,255,0.12)`, `0 0 40px rgba(63,216,255,0.05)`,
  `inset 0 0 24px rgba(63,216,255,0.04)`
- Corner cut: `clip-path: polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)`
  — top-left and bottom-right chamfers. **Never `border-radius`.**
- `backdrop-filter: blur(6px)`
- A `::before` scanline overlay: 1px cyan lines every 4px at 2.5% opacity.

Three cut sizes exist as standalone utilities: `.solo-cut-sm` 8px, `.solo-cut` 14px,
`.solo-cut-lg` 20px (`app/globals.css:42-52`).

Variants recolour border + glow only: `.system-panel-purple` (`:80-86`),
`.system-panel-red` (`:88-94`). `.system-corners` (`:97-113`) adds a targeting-reticle
bracket inset 6px from the panel edge, drawn with eight background gradients.

Panel padding is `p-4 sm:p-5` (`components/SystemPanel.tsx:36`).

### 1.3 Typography

- Display: **Orbitron** via `--font-display`, applied to `h1,h2,h3,.font-display` with
  `letter-spacing: 0.06em` (`app/globals.css:36-39`).
- Body: **Rajdhani** via `--font-body` on `body` (`app/globals.css:32`).
- Panel titles: `font-display text-[0.7rem] sm:text-xs uppercase tracking-[0.25em]`
  (`components/SystemPanel.tsx:41`).
- Page titles: `font-display text-lg font-bold uppercase tracking-[0.3em]` plus a glow class
  (`app/training/page.tsx:404-406`).
- Buttons: Orbitron, `0.72rem`, `tracking 0.14em`, weight 700, uppercase
  (`app/globals.css:138-145`).
- Numeric readouts use `font-display` at `text-xs`/`text-xl` with `font-bold`
  (`app/training/page.tsx:77`, `:351`).
- Micro-labels are `text-[0.6rem]`–`text-[0.65rem] uppercase tracking-wider text-ghost/…`.
- Empty/quiet copy is `text-sm italic text-ghost/60` (`app/training/page.tsx:327`).

Glow is a **text-shadow**, not a filter: `.glow-blue|purple|red|gold` =
`0 0 10px rgba(c,0.8), 0 0 30px rgba(c,0.4)` (`app/globals.css:115-118`).

### 1.4 System-window chrome

`components/SystemPanel.tsx:38-46` is the reference header: a `◆` diamond in the accent colour,
the uppercase wide-tracked title, then `h-px flex-1 bg-gradient-to-r from-line to-transparent`
as a fading rule. Bracketed readouts (`[REST DAY AUTHORIZED]`, `app/training/page.tsx:58`;
`[!] Warning`, `components/Toaster.tsx:64`) carry status. Inline separators inside a metadata
line are a literal `|` in `text-line` (`app/training/page.tsx:336`).

### 1.5 Controls

- `.system-btn` (`app/globals.css:138-173`): solid cyan on near-black text, 8px cut,
  `0 0 20px` glow, hover lifts `-1.5px` and brightens to `#6fe4ff`, active drops `0.5px`,
  disabled drops to `opacity 0.35`. Variants: `-gold`, `-outline`, `-purple`, `-red` (`:175-223`).
- `.system-input` (`app/globals.css:121-136`): void fill, 25%-cyan border, focus raises the
  border to 70% and adds a `0 0 12px` glow. **`outline: none` with no focus-visible fallback.**
- Ad-hoc toggle chips use `border px-2 py-1 text-[0.6rem] uppercase tracking-wider` and swap
  `border-line text-ghost` → `border-sysblue text-sysblue` when active
  (`app/training/page.tsx:238-241`). This pattern is unnamed today — it becomes `Chip`.

### 1.6 Motion

The canonical module uses **CSS keyframes, not framer-motion**:

- `animate-materialize` — 0.45s `cubic-bezier(0.2,0.9,0.3,1)`, translateY(10px) + scale(0.985)
  + brightness flash (`app/globals.css:226-231`). This is the entrance convention.
- `animate-levelup` — 0.7s `cubic-bezier(0.16,1,0.3,1)` burst (`:233-238`).
- `animate-pulse-glow` — 2.4s ease-in-out infinite, used to mark an *incomplete* quest
  (`:240-244`, applied at `app/training/page.tsx:54`).
- `animate-warn-flicker` — 3s linear infinite (`:246-253`).
- `animate-toast-in` — 0.3s ease-out, slides 40px from the right (`:255-259`).
- `xp-bar-fill` — 3s linear shimmer across a four-stop cyan→violet gradient (`:261-276`).
- Interaction transitions are `0.15s` (transform) and `0.2s` (colour/shadow)
  (`app/globals.css:152`); progress fills are `duration-500` (`app/training/page.tsx:86`).

framer-motion is used almost exclusively in `components/LandingPage.tsx`, with thirteen
one-off `transition={{ duration: … }}` configs — this is drift, not canon.

### 1.7 Iconography and rhythm

lucide-react at `size={14}` (inline/affordance), `size={15}–16` (row actions, labels),
`size={18}` (feature) — see `app/training/page.tsx:226,281,358` and `app/health/page.tsx:46,66-74`.
Vertical rhythm is `space-y-4` at page level and `space-y-3`/`space-y-2` inside panels; the page
grid is `grid-cols-1 gap-4 lg:grid-cols-2` (`app/training/page.tsx:374,408`).

---

## 2. Token set

Defined additively in the `@theme` block of `app/globals.css` (colour, motion, geometry and
z-layer scales) and in the `:root` block just below it (multi-part *recipes* — shadows,
gradients, clip-paths). Semantic names only: authors should stop reaching for `sysblue` and
reach for `accent`. The raw palette above is retained only so existing code keeps compiling; it
is frozen and no new code should reference it.

Only two of these namespaces are ones Tailwind turns into utilities: `--color-*` (so
`text-accent-gold`, `border-border-subtle` work) and `--ease-*`. `--duration-*`, `--cut-*`,
`--z-*`, `--panel-*`, `--glow-*`, `--text-glow-*` and `--focus-ring-*` are **not** Tailwind
theme namespaces, so there is no `duration-slow` or `z-modal` class — reach for them as
`var(--duration-slow)`, or in an arbitrary value like `z-[var(--z-modal)]`
(`components/ui/Modal.tsx:121`). The `@theme` block is marked `static` so Tailwind emits every
token to `:root` even when no utility references it; without that, a raw `var(--cut-md)` would
silently resolve to nothing.

**Surfaces:** `surface-base`, `surface-sunken`, `surface-raised`, `surface-overlay`, `border-subtle`.

**Accents:** `accent`, `accent-dim`, `accent-alt`, `accent-alt-dim` — plus the closed hue set a
module may choose from: `accent-blue`, `accent-purple`, `accent-gold`, `accent-red`,
`accent-green`, each with a matching `-dim`. `accent` is an alias of `accent-blue` and
`accent-alt` of `accent-purple`.

**Status:** `status-success`, `status-warning`, `status-danger`, `status-info`.

**Text:** `text-primary` `#dbe6ff`, `text-muted` `#8ea7d8`, `text-faint` `#7288b5`,
`text-placeholder` `#7288b5`, `text-inverse` `#03040a`.

**Motion:** `--duration-instant` 120ms, `--duration-fast` 150ms, `--duration-base` 250ms,
`--duration-slow` 450ms (the entrance duration), `--duration-progress` 500ms (meter fills),
`--duration-ambient` 2400ms, `--duration-shimmer` 3000ms; easings `--ease-system`
(`cubic-bezier(0.2,0.9,0.3,1)`, the entrance curve), `--ease-burst`
(`cubic-bezier(0.16,1,0.3,1)`), `--ease-standard` (`ease-out`).

**Geometry:** `--cut-sm|md|lg` (8/14/20px) and `--panel-cut`, the ready-made 14px `clip-path`
polygon. Radii are deliberately absent: the system chamfers, it does not round.

**Panel chrome:** `--panel-gradient`, `--panel-backdrop-blur`, `--panel-scanline`,
`--panel-border-{blue,purple,gold,red,green}` and `--panel-shadow-{blue,purple,gold,red,green}`
(each the full three-part glow: outer 12px, halo 40px, `inset` 24px). Recolouring the border and
shadow to a different hue is the *only* sanctioned panel variation.

**Glows:** `--glow-accent-sm|md|lg|inset`, `--glow-alt-sm`, `--glow-gold-sm`, `--glow-green-sm`,
`--glow-danger-sm`. Text glow is a `text-shadow` pair, never a filter:
`--text-glow-{blue,purple,gold,red,green}`.

**Focus:** `--focus-ring-color` `#3fd8ff`, `--focus-ring-width` 2px, `--focus-ring-offset` 2px,
and `--focus-ring-offset-inset` -3px for chamfered elements, whose `clip-path` would otherwise
clip the outline away. `--focus-ring` remains as the equivalent `box-shadow` form.

**Z-layers:** `--z-base` 0, `--z-sticky` 30, `--z-nav` 40, `--z-toast` 45, `--z-modal` 50.
The toast layer is deliberately **below** the modal layer. A dialog traps Tab, so a toast painted
over it is visible but unreachable by keyboard while still able to cover the dialog's primary
action — an accessibility defect, not just a visual one. The focused surface stays the top surface.

`--color-text-faint` is intentionally **not** the legacy `#4a5d8a` placeholder colour, which
fails contrast (see §5). `#7288b5` measures 5.5:1 on `surface-sunken` and 5.3:1 on
`surface-raised`. It is the dimmest text the system permits, so **never apply an opacity
modifier to it** — `/60` drops it to roughly 3:1.

**Spacing** stays on the Tailwind 4px scale. The permitted rhythm is `2 / 3 / 4 / 5 / 6`;
anything else needs a reason.

### The token list, in full

Not maintained by hand. `lib/__tests__/design-tokens.test.ts` reads the custom properties declared
between the `BEGIN:design-tokens` / `END:design-tokens` markers in `app/globals.css` and fails when
this list and those declarations disagree **in either direction** — a token named here that does not
exist, or a token that exists and is not named here. The prose above is the explanation; this is the
inventory. (The earlier `--panel-border-accent` was a duplicate of `--panel-border-blue` that the
prose never mentioned and nothing consumed; it was removed rather than documented.)

<!-- BEGIN:design-tokens -->

  | # | Token |
  | --- | --- |
  | 1 | `--color-surface-base` |
  | 2 | `--color-surface-sunken` |
  | 3 | `--color-surface-raised` |
  | 4 | `--color-surface-overlay` |
  | 5 | `--color-border-subtle` |
  | 6 | `--color-accent` |
  | 7 | `--color-accent-dim` |
  | 8 | `--color-accent-alt` |
  | 9 | `--color-accent-alt-dim` |
  | 10 | `--color-accent-blue` |
  | 11 | `--color-accent-blue-dim` |
  | 12 | `--color-accent-purple` |
  | 13 | `--color-accent-purple-dim` |
  | 14 | `--color-accent-gold` |
  | 15 | `--color-accent-gold-dim` |
  | 16 | `--color-accent-red` |
  | 17 | `--color-accent-red-dim` |
  | 18 | `--color-accent-green` |
  | 19 | `--color-accent-green-dim` |
  | 20 | `--color-status-success` |
  | 21 | `--color-status-warning` |
  | 22 | `--color-status-danger` |
  | 23 | `--color-status-info` |
  | 24 | `--color-text-primary` |
  | 25 | `--color-text-muted` |
  | 26 | `--color-text-faint` |
  | 27 | `--color-text-inverse` |
  | 28 | `--color-text-placeholder` |
  | 29 | `--duration-instant` |
  | 30 | `--duration-fast` |
  | 31 | `--duration-base` |
  | 32 | `--duration-slow` |
  | 33 | `--duration-ambient` |
  | 34 | `--duration-progress` |
  | 35 | `--duration-shimmer` |
  | 36 | `--ease-system` |
  | 37 | `--ease-burst` |
  | 38 | `--ease-standard` |
  | 39 | `--cut-sm` |
  | 40 | `--cut-md` |
  | 41 | `--cut-lg` |
  | 42 | `--z-base` |
  | 43 | `--z-sticky` |
  | 44 | `--z-nav` |
  | 45 | `--z-toast` |
  | 46 | `--z-modal` |
  | 47 | `--glow-accent-sm` |
  | 48 | `--glow-accent-md` |
  | 49 | `--glow-accent-lg` |
  | 50 | `--glow-accent-inset` |
  | 51 | `--glow-alt-sm` |
  | 52 | `--glow-danger-sm` |
  | 53 | `--glow-gold-sm` |
  | 54 | `--glow-green-sm` |
  | 55 | `--panel-gradient` |
  | 56 | `--focus-ring` |
  | 57 | `--panel-backdrop-blur` |
  | 58 | `--panel-cut` |
  | 59 | `--panel-scanline` |
  | 60 | `--panel-shadow-blue` |
  | 61 | `--panel-shadow-purple` |
  | 62 | `--panel-shadow-red` |
  | 63 | `--panel-shadow-gold` |
  | 64 | `--panel-shadow-green` |
  | 65 | `--panel-border-blue` |
  | 66 | `--panel-border-purple` |
  | 67 | `--panel-border-red` |
  | 68 | `--panel-border-gold` |
  | 69 | `--panel-border-green` |
  | 70 | `--text-glow-blue` |
  | 71 | `--text-glow-purple` |
  | 72 | `--text-glow-gold` |
  | 73 | `--text-glow-red` |
  | 74 | `--text-glow-green` |
  | 75 | `--focus-ring-color` |
  | 76 | `--focus-ring-width` |
  | 77 | `--focus-ring-offset` |
  | 78 | `--focus-ring-offset-inset` |

<!-- END:design-tokens -->

### Where the tokens are consumed

A recipe token that nothing reads is not a token, it is a comment that looks authoritative. The
panel, chamfer and text-glow recipes are therefore consumed by the very rules they describe —
`.system-panel` reads `--panel-gradient`, `--panel-border-blue`, `--panel-shadow-blue`,
`--panel-cut` and `--panel-backdrop-blur`; `.system-panel-purple` and `.system-panel-red` read
their border/shadow pairs; `.solo-cut*` read `--panel-cut` and `--cut-sm|lg`; `.glow-*` read
`--text-glow-*`; `.system-btn` reads `--cut-sm` and `--glow-accent-md`. Editing a token now moves
the thing it names, which is the only way the values above can be trusted.

### 2.1 What a module author may declare

Exactly one thing: an accent hue from `blue | purple | gold | red | green`. Everything else —
panel chrome, typography, motion, spacing, z-layers, the focus ring, button geometry — is
inherited and not negotiable. See §4.

---

## 3. Primitive inventory

Shipped additively under `components/ui/` in this pass:

| Primitive | Purpose | Variants |
| --- | --- | --- |
| `PanelHeader` | diamond + tracked title + fading rule | accent × glow × trailing slot |
| `StatusPill` | bracketed status readout | blue/purple/gold/red/green/neutral, bracketed on/off |
| `StatBlock` | label + numeric readout | accent, glow, icon, unit |
| `ProgressBar` | quest/progress fill | five accents, height, a11y-labelled |
| `EmptyState` | "nothing logged yet" register | title optional, action slot |
| `LockedState` | gated surface, states the unlock condition | label + requirement + action |
| `SkeletonLoader` | loading placeholder | line count |
| `SystemButton` | the five `.system-btn` variants as one component | variant × size, disabled/loading |
| `Modal` | the shared dialog: backdrop, panel, close button | accent × size, backdrop dismiss, footer slot |
| `Tabs` | mode selector, WAI-ARIA tablist with arrow roving | accent, `solo-cut-sm` control chamfer |
| `Chip` | filter toggle, `aria-pressed` | accent, on/off |
| `Divider` | rule between sections | — |
| `MetaRow` | the `\|`-separated metadata line | — |
| `Banner` | shared advisory strip | accent |

### The `Modal` keyboard contract

Anything migrating onto `Modal` (see the remaining hand-rolled dialogs inventoried below) inherits,
and must not re-implement:

- **Escape and Tab belong to the topmost dialog only.** Each open dialog listens on the document,
  so ownership is decided by `lib/ui/modal-stack.ts`, which ranks open dialogs by document
  position — the same thing that decides paint order, since every dialog renders inline (no
  portal) with the same `--z-modal`. Registration order is not used: React does not document
  child-vs-parent effect order, so registration order is not something to rank by.
- **Tab is always swallowed.** `lib/ui/focus-trap.ts` has no return value meaning "let the browser
  decide", so focus cannot reach the page behind a dialog even when the dialog has nothing
  focusable in it.
- **What counts as a tab stop is a decision, not a selector.** `isTabbable` in
  `lib/ui/focus-trap.ts` excludes **any** negative `tabindex` (not just `-1`), `disabled` controls
  including those inside a `disabled` `<fieldset>`, `inert` subtrees, `aria-hidden="true"`
  subtrees, the contents of a collapsed `<details>` (its `<summary>` stays reachable), and anything
  hidden by `hidden`, `display: none` or `visibility: hidden` on itself or an ancestor. It
  **includes** `contenteditable` regions, which are genuine tab stops.
- **Focus is restored** to whatever was focused before the dialog opened.
- **The body scroll lock is counted**, and its pre-lock value is captured once, so dialogs closing
  in any order restore the page's own `overflow`.

Documented limitations, accepted rather than fixed in this pass — each is stated at its
implementation site and, where testable, pinned by a test:

- **Shadow DOM.** The trap does not pierce shadow roots. The app ships no web components and never
  calls `attachShadow`; a dialog that ever hosts one must revisit `tabbablesWithin`.
- **Ancestor stacking contexts.** Document position equals paint order only while open dialogs
  share a stacking context. Portalling panels to `document.body` is the robust fix and is tracked
  separately, since it changes how every dialog mounts.
- **Scroll lock snapshot.** Page code that changes `body.style.overflow` while a dialog is open has
  that change overwritten on final release. Nothing outside `lib/ui/modal-stack.ts` touches it.

`lib/__tests__/modal-dom.test.tsx` (jsdom) holds all of the above as requirements; do not relax it
to match new behaviour. In particular, do not assert on the shape of a selector string — an
assertion like `expect(SELECTOR).toContain(…)` cannot fail when the behaviour is wrong and cannot
pass when the implementation is merely refactored. One such test existed here and was deleted, not
updated.

Already canonical and reusable today: `components/SystemPanel.tsx` (Card),
`.system-btn*` (Button variants), `.system-input` (Input), `components/Toaster.tsx` (Toast),
`components/ProgressRing.tsx`, `components/XPBar.tsx`.

All primitives this section called for are now built and exported from `components/ui/index.ts`.
`SystemButton` wraps the five `.system-btn` variants so size and disabled/loading state stop being
re-derived per page; `Tabs` replaces the bespoke button rows; `Chip` replaces the filter toggle;
`Divider` and `MetaRow` replace the `|`-separated metadata line.

What remains is **adoption**, not construction, and it belongs to the migration beads rather than
this section:

- The mode selectors in `app/sahwa/hifz/page.tsx` and `app/study/page.tsx` are still bespoke button
  rows and have not moved onto `Tabs`.
- **10 hand-rolled dialog overlays across 6 files** have not moved onto `Modal`.
  `components/RealmSwitcherModal.tsx` is its only consumer today, and `components/ui/Modal.tsx` is
  the only place in the tree that renders `role="dialog"`/`aria-modal` — so every entry below is
  also an accessibility gap, not merely a styling one (see §5.5). A dialog overlay is counted as a
  `className` containing `fixed inset-0` together with `items-center justify-center` and without
  `pointer-events-none`; that excludes the decorative full-screen canvas in
  `components/ConfettiCelebration.tsx` and the `fixed inset-x-0` mobile nav in
  `components/AppShell.tsx`, neither of which is dialog-shaped. Files carrying more than one
  overlay are counted per overlay, because each is a separate migration.

<!-- BEGIN:hand-rolled-dialog-inventory -->

  | File | Overlays |
  | --- | --- |
  | `components/LevelUpModal.tsx` | 1 |
  | `components/OpenSourceGovernanceModal.tsx` | 1 |
  | `components/ProductConstitutionModal.tsx` | 1 |
  | `components/QuranReaderView.tsx` | 5 |
  | `components/ScorecardExportModal.tsx` | 1 |
  | `components/WordByWordInspectorModal.tsx` | 1 |

<!-- END:hand-rolled-dialog-inventory -->

  This count is not maintained by hand. `lib/__tests__/dialog-inventory.test.ts` recounts the
  overlays from source and fails when the total, the file list or any per-file count above stops
  matching the tree — the previous figure here ("eight") was stale for two review rounds and then
  understated for a third, which is why the number is now pinned rather than prose.
- `app/training/page.tsx` is the one fully migrated reference surface (0 hex, 0 inline styles), and
  is what "pixel-identical to canon" is checked against.

---

## 4. Rules for module authors

A module gets the look **for free** by doing three things and nothing more:

1. Wrap every section in `<SystemPanel title=… />`, or use `PanelHeader` inside a
   `.system-panel .solo-cut` container.
2. Use only primitives from `components/ui/` plus the `.system-*` utility classes.
3. Declare an accent and let it flow through the `accent` prop.

**May customise:** exactly one thing — an **accent hue** from the closed set
`blue | purple | gold | red | green`. Sahwa is gold, Workout is blue, Study is purple.
This should become a `accent: Accent` field on `ModuleManifest`
(`docs/design/module-architecture.md:161`), so the shell can theme nav, panel borders and
progress fills without the module touching CSS.

**May not customise, ever:** panel chrome (fill gradient, border weight, clip-path, scanlines,
corner brackets), typography (families, tracking, uppercase treatment), motion (durations,
easings, entrance convention), spacing scale, z-layer values, focus ring, button geometry.

**Anti-patterns to eliminate:**

- Hardcoded hex in TSX. The worst offenders today are
  `components/NooraniQaidaLadderView.tsx` (194), `components/LandingPage.tsx` (147),
  `app/study/page.tsx` (89), `app/treasury/page.tsx` (73), `app/academy/page.tsx` (61).
- `style={{ … }}` objects reimplementing a panel. `components/hub/GlobalCommandCenter.tsx`
  has 94 of them; `app/study/page.tsx:329-332`, `app/treasury/page.tsx:103-106` and
  `app/finance/page.tsx:59-62` are three copies of the same near-identical hand-rolled header
  card with different border rgba values.
- Ad-hoc arbitrary Tailwind values — `text-[#e9edf9]`, `text-[#ff6b6b]`
  (`app/sahwa/hifz/page.tsx:141,174`), `bg-gradient-to-br from-[#061426] via-[#090b17]`
  (`:103`). Arbitrary *sizes* like `text-[0.6rem]` are tolerated; arbitrary *colours* are not.
- Off-palette colours invented per module: `#4d9fff`, `#3ddc97`, `#b26bff`, `#ffd166`,
  `#8892b0` (`components/RealmSwitcherModal.tsx:27-67,141`) are near-misses of the real palette.
- `font-family: monospace` inline as a stand-in for the readout feel
  (`app/training/page.tsx:391`, `app/treasury/page.tsx:119`) — use `font-display`.
- One-off framer-motion configs. Pick a duration token and the `--ease-system` easing.
- `rounded`/`rounded-full` on panels. The system chamfers; it does not round.

---

## 5. Accessibility requirements

The canonical style has real defects. **Do not propagate them.**

1. **Focus.** This was the original defect: `.system-input` set `outline: none` and substituted a
   border/glow change that is easy to miss on a dark field, `.system-btn` had no `:focus` rule at
   all, and a repo-wide search for `focus-visible` returned zero hits.

   A base layer at the foot of `app/globals.css` now supplies the ring, and it is the contract the
   accessibility pass builds on rather than re-implements:

   - Two rules, both wrapped in `:where()` so they carry **zero specificity** — any component rule
     still wins, and nothing about the resting state changes. They paint only on `:focus-visible`,
     so pointer users see no change.
   - The element set is deliberately the same one `isTabbable` in `lib/ui/focus-trap.ts` accepts:
     links, `button`, `input`, `select`, `textarea`, `summary`, `contenteditable` regions, and
     `[tabindex]` excluding **any** negative value (`[tabindex^="-"]`, not just `-1`). "Can be
     tabbed to" and "shows a ring when tabbed to" are one list, so they cannot drift apart.
   - `clip-path` clips an outline, so chamfered elements (`.system-btn*`, `.solo-cut*`,
     `.system-panel`) draw the ring **inward** at `--focus-ring-offset-inset` `-3px` instead of
     outward at `--focus-ring-offset` `2px`. Anything that gains a chamfer must join that selector
     or its ring will be invisible.
   - Because `.system-input` sets `outline: none` earlier in the file, the base layer relies on
     source order at equal specificity. Do not move it above the component rules.

   Measured on `/training`: 33 of 38 focusable elements paint the 2px `#3fd8ff` ring (15 inward,
   18 outward); the remaining 5 are the mobile bottom-nav links, which are `display: none` at
   desktop widths and so cannot take focus at all. Note when verifying by hand that the
   `transition` utility animates `outline-color`, so a computed-style read taken in the same tick
   as `.focus()` shows the pre-focus colour, not the ring.
2. **Muted text fails AA.** The placeholder colour `#4a5d8a` on `--color-void` `#070b18` is
   roughly 2.6:1 against a 4.5:1 requirement. `text-ghost/50` and `text-ghost/60`, used heavily
   for explanatory copy (`app/training/page.tsx:95,127,307`), land near 3:1. Body and
   explanatory text must reach **4.5:1**; large display text and non-text borders **3:1**.
   `--color-text-faint` `#7288b5` is the compliant replacement.
3. **`prefers-reduced-motion`.** A global `@media (prefers-reduced-motion: reduce)` block now
   lives at the foot of `app/globals.css`: it sets `animation: none` on every infinite animation
   (`animate-pulse-glow`, `animate-warn-flicker`, `animate-spin-slow`, `xp-bar-fill`, and
   Tailwind's `spin`/`ping`/`pulse`/`bounce`), collapses every entrance animation to a 120ms
   fade, and clamps all transitions. Component-level opt-outs are no longer needed.

   Entrance animations are collapsed rather than removed. `animation: none` on a keyframe that
   fills `both` from `opacity: 0` is how a sidebar outage happens; degrading to a 120ms fade keeps
   the element, its layout box and its final opacity. Verified by forcing the preference on
   `/training` and `/health`: identical element count, panel count, text length and
   `scrollHeight`, with the two live fades shortening from 250ms to 120ms and nothing left below
   full opacity.

   **Every `animate-*` class must resolve to a defined keyframe.** Three classes
   (`animate-slideIn`, `animate-scale-up`, `animate-spin-slow`) and, earlier,
   `animate-fade`/`animate-fadeIn` were referenced by components with no keyframe behind them,
   so they silently rendered nothing. If you add an `animate-*` class, define its keyframe here
   and add it to the reduced-motion block — `lib/__tests__/design-tokens.test.ts` recounts both
   from source and fails if either is missing, so neither is a matter of remembering.
4. **Glow is decorative, never semantic.** Status must also be carried by text or icon —
   `StatusPill` exists so that "locked" is a word, not just a red halo.
5. **Modals need semantics.** Hand-rolled dialogs currently lack focus trap, `aria-modal`,
   labelled titles and Escape handling.

---

## 6. Migration strategy

Sequenced so that foundation lands before consumers, and highest-leverage surfaces first.

1. **Tokens** (mostly done in this pass, additive, zero render change).
2. **Primitives** under `components/ui/` — still unused, so still zero-risk.
3. **Shared chrome** (`AppShell`, `RealmSwitcherModal`, `Toaster`, modals). One change, every
   page benefits. `RealmSwitcherModal` alone removes five off-palette hexes and 20 inline styles.
4. **Sahwa / Hifz cluster** — the active product focus, and the largest arbitrary-value
   concentration outside the landing page.
5. **Hub + Study + Treasury/Finance + Academy/Circles** — the inline-style cluster, which is
   the furthest from canonical.
6. **Long tail** — nutrition, guilds, leaderboard, intel, settings, onboarding.
7. **Guard rail** — lint/CI rule so drift cannot silently return.
8. **Accessibility pass** — focus rings, contrast, reduced motion, modal semantics.

Each migration must prove itself with `npx tsc --noEmit`, `npm run build`, `npm test`,
`npm run lint`, plus a side-by-side visual check of the migrated route.

---

## 7. Drift ranking

| Rank | Surface | Severity | Why |
| --- | --- | --- | --- |
| 1 | `components/hub/GlobalCommandCenter.tsx` | Critical | 94 inline style objects, 57 hexes, zero `SystemPanel`; `/hub` is the landing surface |
| 2 | `app/study/page.tsx` | Critical | 72 inline styles, 89 hexes, own purple `#b26bff` dialect |
| 3 | `app/treasury/page.tsx` + `app/finance/page.tsx` | Critical | 66 + 45 inline styles, duplicated gold `#ffd166` header card |
| 4 | `app/academy/page.tsx` + `app/circles/page.tsx` | Critical | 63 + 31 inline styles (⚠ owned by another agent — coordinate) |
| 5 | `components/NooraniQaidaLadderView.tsx` | High | 194 hexes, 114 arbitrary values, 62 inline styles — and it is core Sahwa |
| 6 | `components/RealmSwitcherModal.tsx` | High | five off-palette realm colours, 20 inline styles; shared chrome, so it multiplies |
| 7 | `app/sahwa/hifz/**`, `HifzDashboardView`, `QuranReaderView` | High | heavy arbitrary values but structurally close to canon; active focus |
| 8 | `components/LandingPage.tsx` | High | 147 hexes, 161 arbitrary values, 13 bespoke motion configs — first impression |
| 9 | `app/sahwa/salah/page.tsx`, `AppleStylePrayerCalendar` | Medium | 91 / 64 arbitrary values, an explicitly non-System "Apple" idiom |
| 10 | `components/Onboarding.tsx` | Medium | 61 arbitrary values, one-off controls, high stakes for first-run |
| 11 | `components/AppShell.tsx` | Medium | mostly canonical, but 32 arbitrary values and hand-rolled shadows |
| 12 | `app/sahwa/arabic`, voice/makhraj decks | Medium | mixed; sizeable arbitrary-value counts |
| 13 | `app/nutrition`, `app/guilds`, `app/leaderboard`, `app/intel`, `app/settings`, `app/sahwa/{dhikr,fiqh,hadith,history,intel}` | Low | already use `SystemPanel`; small cleanups only |
| — | `app/training`, `app/health` | Reference | the canon (one inline-style fasting banner in `training` to fold into a primitive) |
