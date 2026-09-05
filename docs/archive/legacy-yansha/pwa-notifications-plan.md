# PWA + Prayer Notifications: Implementation Plan

Status: design reference for the builder. Verified against Next.js **16.3.0** (this repo's installed version, Turbopack-default) and browser platform status as of **August 2026**.

Companion context: [`docs/context/islamic-prayer-reference.md`](../context/islamic-prayer-reference.md) — prayer windows, AlAdhan API shapes, and respectful-gamification rules referenced throughout.

---

## TL;DR decisions

| Question | Decision |
|---|---|
| Service worker library | **Serwist** via `@serwist/turbopack` (route-handler build). next-pwa is unmaintained and webpack-only; hand-rolled is the fallback if Serwist friction appears. |
| Manifest | Next.js native `app/manifest.ts` metadata route — no static `public/manifest.json`. |
| Notifications (v1, no backend) | Layered client-only approach: in-page scheduler firing `showNotification()` while the app is open → app-open catch-up banner → Badging API pending count → **ICS calendar export with `VALARM`s as the only *reliable* background reminder**. Be upfront in the UI that background notifications require the app to be open (or the calendar export). |
| Notifications (future) | Minimal push backend (VAPID + `web-push` + cron). Sketch included; do not build in v1. |
| Offline prayer times | Monthly AlAdhan `/calendar` response in **localStorage** (matches the app's persistence model), keyed by month + calc settings. SW Cache Storage handles the app shell; a runtime-cache rule for the API is a backup layer only. |

---

## 1. Installable PWA

### 1.1 Requirements checklist

A PWA is installable when it has ([Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps)):

1. A valid web app manifest (name, icons ≥192px and ≥512px, `start_url`, `display: standalone`).
2. HTTPS (or `localhost`). For local device testing: `next dev --experimental-https`.
3. (Chromium) A registered service worker with a `fetch` handler — Serwist provides this.

> iOS 26 note: Safari now opens *any* site added to the Home Screen as a web app even without a manifest, but a proper manifest is still required for icons, theme color, and (critically) web-push eligibility on iOS 16.4+. ([State of Declarative Web Push 2026](https://aimtell.com/blog/state-of-declarative-web-push-2026))

### 1.2 Manifest — `app/manifest.ts`

Use the App Router metadata route ([file convention docs](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest)); Next.js serves it at `/manifest.webmanifest` and links it automatically. This is bundled in this repo at `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/01-metadata/manifest.md` — the convention is current for 16.3.

```ts
// app/manifest.ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Arise — Self-Health System",
    short_name: "Arise",
    description:
      "Solo Leveling-styled self-health tracker with prayer-time accountability",
    id: "/",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    // Solo Leveling palette: near-black navy shell, arcane-blue accent
    background_color: "#0b0e1a",
    theme_color: "#0b0e1a",
    categories: ["health", "lifestyle", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable", // full-bleed with ~20% safe-zone padding
      },
    ],
  };
}
```

Icon set to place in `public/icons/`: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, plus a **monochrome `badge-72.png`** (72×72, white-on-transparent) used by Android for the status-bar glyph on notifications. Also add `apple-touch-icon.png` (180×180) via the `app/apple-icon.png` file convention.

### 1.3 Service worker library: evaluation

| Option | Verdict | Reasoning |
|---|---|---|
| **`next-pwa`** (and the `@ducanh2912/next-pwa` fork) | ❌ Rejected | Webpack-only; Next 16 defaults to Turbopack, so every build needs `--webpack`. The original is unmaintained; teams are actively migrating off it for exactly this reason ([Aurora Scharff, updated Nov 2025](https://aurorascharff.no/posts/dynamically-generating-pwa-app-icons-nextjs-16-serwist/)). |
| **Serwist** (`@serwist/turbopack`) | ✅ **Recommended** | Actively maintained Workbox fork; the option the [official Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps) itself points to for SW-based offline caching. The Turbopack integration compiles `app/sw.ts` through a Route Handler with esbuild at build time — no bundler plugin, works with `next build` (Turbopack) as-is ([Serwist Turbopack docs](https://serwist.pages.dev/docs/next/turbo), [migration write-up](https://shinyaz.com/en/blog/2026/02/24/serwist-turbopack-migration)). Gives free precaching of hashed build assets + sane runtime-caching defaults, which hand-rolling gets wrong easily. |
| **Hand-rolled SW** in `public/sw.js` | 🟡 Fallback | What the Next.js docs demonstrate for the push flow; zero dependencies and full control ([Build with Matija](https://www.buildwithmatija.com/blog/turn-nextjs-16-app-into-pwa)). Viable here because our offline needs are small — but you lose automatic precache-manifest generation and cache versioning. Choose this only if `@serwist/turbopack` misbehaves (it has some rough edges — see below). |

**Known Serwist/Turbopack gotchas** (so the builder isn't surprised):

- Dev-mode SW is intentionally off; test PWA behavior with `next build && next start` ([Serwist docs](https://serwist.pages.dev/docs/next/turbo)).
- Needs `esbuild` as a dependency; `withSerwist` adds it to `serverExternalPackages`. If you hit prebundle errors, see [serwist#335](https://github.com/serwist/serwist/issues/335).
- Don't put `/// <reference no-default-lib="true" />` in `app/sw.ts` — it breaks DOM types project-wide. Exclude `app/sw.ts` from the main `tsconfig.json` or add `"webworker"` to `lib` instead ([serwist#348](https://github.com/serwist/serwist/issues/348)).
- The `app/serwist/[path]` route is meant to be statically generated at build time — never `revalidatePath` over it.

### 1.4 Serwist setup (liftable)

```bash
npm i @serwist/turbopack serwist && npm i -D esbuild
```

```ts
// next.config.ts
import { withSerwist } from "@serwist/turbopack";

export default withSerwist({
  /* existing config */
});
```

```ts
// app/serwist/[path]/route.ts
import { createSerwistRoute } from "@serwist/turbopack";

export const { dynamic, dynamicParams, revalidate, generateStaticParams, GET } =
  createSerwistRoute({
    swSrc: "app/sw.ts",
    useNativeEsbuild: true,
    additionalPrecacheEntries: [
      { url: "/~offline", revision: process.env.NEXT_PUBLIC_BUILD_ID ?? crypto.randomUUID() },
    ],
  });
```

```ts
// app/sw.ts  (exclude from main tsconfig; Serwist compiles it separately)
import { defaultCache } from "@serwist/turbopack/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}
declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
  fallbacks: {
    entries: [
      { url: "/~offline", matcher: ({ request }) => request.destination === "document" },
    ],
  },
});

// Focus or open the app when a prayer notification is tapped.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? "/prayers";
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const existing = clients.find((c) => "focus" in c);
      if (existing) {
        await existing.focus();
        existing.navigate?.(url);
      } else {
        await self.clients.openWindow(url);
      }
    })(),
  );
});

serwist.addEventListeners();
```

Registration — small client component mounted once in `app/layout.tsx` (production-only, idle-time so it never competes with first paint):

```tsx
// components/ServiceWorkerRegistration.tsx
"use client";
import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    const register = () =>
      navigator.serviceWorker
        .register("/serwist/sw.js", { scope: "/", updateViaCache: "none" })
        .catch((err) => console.error("SW registration failed", err));
    if ("requestIdleCallback" in window) requestIdleCallback(register);
    else setTimeout(register, 1500);
  }, []);
  return null;
}
```

`updateViaCache: "none"` forces the browser to fetch a fresh SW script on each check instead of the HTTP cache — important for shipping fixes quickly ([Build with Matija](https://www.buildwithmatija.com/blog/turn-nextjs-16-app-into-pwa)).

---

## 2. Prayer-time notifications — honest capability analysis

### 2.1 What each mechanism can and cannot do (no backend)

| Mechanism | Fires when app is **open**? | Fires when app is **closed**? | Support | Notes |
|---|---|---|---|---|
| In-page timer + `registration.showNotification()` | ✅ Yes | ❌ No | Everywhere Notifications API exists | Timers in background tabs are throttled (Chrome: ≥1/min, up to 1/wake-per-hour under intensive throttling) — so poll wall-clock time, never trust one long `setTimeout` ([Chrome timer throttling](https://developer.chrome.com/blog/timer-throttling-in-chrome-88)). An installed PWA left running counts as "open". |
| Service worker alone | — | ❌ No | — | A SW **cannot wake itself at a future time**. It's terminated after ~30s of idle; `setTimeout` state dies with it. There is no client-only scheduled-wake primitive. |
| **Notification Triggers API** (`showTrigger: TimestampTrigger`) | — | — | ❌ **Dead** | Exactly the API this feature needed. Chrome ran two origin trials, saw little use, and **officially abandoned it**; it never shipped anywhere. Do not build against it ([Chrome status page](https://developer.chrome.com/docs/web-platform/notification-triggers), [decision thread](https://github.com/beverloo/notification-triggers/issues/7)). |
| Periodic Background Sync | — | 🟡 Sort of, uselessly | Chromium-only, installed PWA, engagement-gated | Minimum real interval is **12–36 h** depending on site-engagement score; you cannot pick *when* it fires. Useless for 5 precise daily times. Legitimate use: opportunistically refreshing the monthly calendar cache ([Chrome docs](https://developer.chrome.com/docs/capabilities/periodic-background-sync)). |
| Web Push (`push` event) | ✅ | ✅ **Yes — the only real answer** | Chromium, Firefox; Safari/iOS 16.4+ (installed PWA only) | Requires a push server holding subscriptions and sending at prayer times. **Out of scope for v1 (no backend)** — sketched in §2.4. |
| Badging API (`navigator.setAppBadge`) | ✅ (updates while running) | Badge *persists* after close | Chromium desktop/Android; iOS 16.4+ installed PWA | Not a notification, but a set badge stays visible on the home-screen icon after the app closes — a passive "you have pending prayers" signal ([MDN](https://developer.mozilla.org/docs/Web/API/Badging_API)). |
| **ICS calendar export** (`VALARM`) | ✅ | ✅ **Yes** | Universal | Generate a `.ics` of the month's prayer times with alarms; the device's calendar app does the (fully reliable, OS-level) reminding. No permissions, no backend, works on iOS out of the box. RFC 5545 `VALARM`. |

**The honest summary for the user-facing settings screen:** without a push server, the web platform cannot ring your phone at Asr while the app is closed. Chrome killed the one API designed for this. What we *can* do reliably client-side: notify while the app is open (including installed-and-running), badge the icon with pending prayers, catch you up the moment you open the app, and hand your calendar app a month of prayer alarms — which *is* fully reliable, just delivered by the calendar instead of us.

### 2.2 Recommended v1 approach (layered, client-only)

1. **Foreground scheduler** (`lib/prayer-notifications.ts` below): a 30-second wall-clock poll while the app is open; fires a dignified notification at each prayer's start, plus a "window closing soon" warning for Maghrib (shortest window — see the prayer reference). Re-syncs on `visibilitychange`/`focus` so a throttled background tab catches up the moment it wakes.
2. **App-open catch-up**: on every launch/focus, compute state from cached times: any un-marked prayer whose window has passed → gentle qada prompt; window currently open → "X closes in NN min" banner. This costs nothing and is where most accountability value actually lives.
3. **Badge**: `navigator.setAppBadge(pendingCount)` whenever pending-prayer count changes; `clearAppBadge()` at 0. Feature-detect silently.
4. **Calendar export**: a "Add this month to my calendar" button producing an `.ics` download (one `VEVENT` + `VALARM` per prayer per day). Recommend it prominently in onboarding as *the* reliable reminder path until push exists.
5. **Copy discipline**: per the prayer reference — no shame copy, no penalty framing, subtle tone. "Maghrib has entered its window" not "⚠️ QUEST FAILING". Notifications must be user-confirmed marks, never auto-marks.

### 2.3 Liftable code

Permission — must be requested from a **user gesture** (a "Enable reminders" button, never on page load; Chrome's quieter-prompts UI punishes unprompted requests):

```ts
// lib/notification-permission.ts
export async function enableNotifications(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}
```

Foreground scheduler:

```ts
// lib/prayer-notifications.ts
import type { PrayerName } from "./types"; // "Fajr" | "Dhuhr" | "Asr" | "Maghrib" | "Isha"

interface DayTimes { date: string; times: Record<PrayerName, Date> }

const FIRED_KEY = "prayer-notifs-fired"; // { "2026-08-12": ["Fajr", ...] } in localStorage
const POLL_MS = 30_000;

async function show(title: string, body: string, tag: string) {
  if (Notification.permission !== "granted") return;
  const reg = await navigator.serviceWorker.ready;
  await reg.showNotification(title, {
    body,
    tag,                    // dedupes if the poll double-fires
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
    data: { url: "/prayers" },
  });
}

export function startPrayerNotificationLoop(getToday: () => DayTimes | null) {
  const tick = async () => {
    const day = getToday();               // from the localStorage month cache (§3)
    if (!day) return;
    const fired: Record<string, string[]> = JSON.parse(localStorage.getItem(FIRED_KEY) ?? "{}");
    const firedToday = new Set(fired[day.date] ?? []);
    const now = Date.now();

    for (const [name, at] of Object.entries(day.times) as [PrayerName, Date][]) {
      // Fire if the time passed within the last 30 min and we haven't fired yet.
      // (The 30-min grace covers throttled background tabs waking up late.)
      if (!firedToday.has(name) && now >= at.getTime() && now - at.getTime() < 30 * 60_000) {
        await show(`${name} — window open`, "It's time to pray. Mark it when you're done.", `prayer-${day.date}-${name}`);
        firedToday.add(name);
      }
    }
    // Maghrib urgency: warn 20 min before Isha (≈ window close).
    const maghrib = day.times.Maghrib.getTime();
    const isha = day.times.Isha.getTime();
    const warnAt = isha - 20 * 60_000;
    if (!firedToday.has("Maghrib-closing") as boolean && now >= warnAt && now < isha && now > maghrib) {
      await show("Maghrib window closing", "About 20 minutes left for Maghrib.", `prayer-${day.date}-maghrib-close`);
      firedToday.add("Maghrib-closing" as PrayerName);
    }

    fired[day.date] = [...firedToday];
    localStorage.setItem(FIRED_KEY, JSON.stringify(fired));
  };

  tick();
  const id = setInterval(tick, POLL_MS);
  const onWake = () => { if (document.visibilityState === "visible") tick(); };
  document.addEventListener("visibilitychange", onWake);
  window.addEventListener("focus", onWake);
  return () => {
    clearInterval(id);
    document.removeEventListener("visibilitychange", onWake);
    window.removeEventListener("focus", onWake);
  };
}
```

Badge:

```ts
// lib/badge.ts
export async function updatePrayerBadge(pendingCount: number) {
  if (!("setAppBadge" in navigator)) return;
  try {
    if (pendingCount > 0) await navigator.setAppBadge(pendingCount);
    else await navigator.clearAppBadge();
  } catch { /* unsupported context; ignore */ }
}
```

ICS export (the reliable background path — one month, alarms at prayer time):

```ts
// lib/ics-export.ts
import type { PrayerName } from "./types";

const pad = (n: number) => String(n).padStart(2, "0");
const toIcsLocal = (d: Date) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;

export function buildMonthIcs(days: { times: Record<PrayerName, Date> }[], tz: string): string {
  const events = days.flatMap((day) =>
    (Object.entries(day.times) as [PrayerName, Date][]).map(([name, start]) => {
      const uid = `${toIcsLocal(start)}-${name}@self-health`;
      return [
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${toIcsLocal(new Date())}`,
        `DTSTART;TZID=${tz}:${toIcsLocal(start)}`,
        `DURATION:PT15M`,
        `SUMMARY:${name} prayer`,
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${name} — the prayer window is open`,
        "TRIGGER:PT0S", // at prayer time; add a second -PT10M alarm if desired
        "END:VALARM",
        "END:VEVENT",
      ].join("\r\n");
    }),
  );
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//self-health//prayer-times//EN",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(ics: string, filename: string) {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const a = Object.assign(document.createElement("a"), {
    href: URL.createObjectURL(blob),
    download: filename,
  });
  a.click();
  URL.revokeObjectURL(a.href);
}
```

> Caveat: bare `TZID` references without an embedded `VTIMEZONE` block are accepted by Google Calendar, Apple Calendar, and Outlook for IANA names (e.g. `America/Detroit`), which is fine for v1. Times come from the AlAdhan cache already localized to the user's configured location.

### 2.4 Future: what a minimal push backend adds

When a backend becomes acceptable, ~1 day of work turns reminders truly reliable:

- **Server pieces**: a table of push subscriptions (endpoint + keys + lat/lng + method/school + tz), one `POST /api/push/subscribe` route, a VAPID keypair (`npx web-push generate-vapid-keys`), and a cron (e.g. Vercel Cron every 5 min) that computes "which subscriptions have a prayer starting this window" and sends via the [`web-push`](https://www.npmjs.com/package/web-push) library. The [Next.js PWA guide](https://nextjs.org/docs/app/guides/progressive-web-apps) shows the exact subscribe/send flow with Server Actions.
- **Client pieces already built**: the SW's `notificationclick` handler (§1.4) works unchanged; add a small `push` event handler (`self.registration.showNotification(data.title, …)`).
- **iOS**: web push works only for the *installed* (Home Screen) PWA on iOS 16.4+; on iOS/iPadOS 18.4+ prefer **Declarative Web Push** (JSON payload, no SW execution, OS renders it, can set the app badge via `app_badge`) — it's the same subscription flow with a different payload content-type ([WebKit: Meet Declarative Web Push](https://webkit.org/blog/16535/meet-declarative-web-push/), [Safari 18.4 release notes](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/)).
- Keep payloads tiny (prayer name + time); send with a short TTL (~20 min) so a phone that was off doesn't get a stale "Fajr now" at noon.

---

## 3. Offline strategy for prayer times

Prayer times for a fixed location + method are deterministic, so cache a whole month once and never hit the network for day-to-day use (this is also what the prayer reference recommends).

**Primary: localStorage month cache** (fits the app's existing persistence model):

```ts
// lib/prayer-times-cache.ts
export interface PrayerSettings {
  latitude: number; longitude: number;
  method: number;   // AlAdhan method id, e.g. 2 = ISNA
  school: 0 | 1;    // 0 Shafi'i, 1 Hanafi
}

const keyFor = (y: number, m: number, s: PrayerSettings) =>
  `aladhan-cal:${y}-${String(m).padStart(2, "0")}:${s.latitude.toFixed(3)},${s.longitude.toFixed(3)}:m${s.method}s${s.school}`;

export async function getMonthCalendar(year: number, month: number, s: PrayerSettings) {
  const key = keyFor(year, month, s);
  const cached = localStorage.getItem(key);
  if (cached) return JSON.parse(cached);

  const url =
    `https://api.aladhan.com/v1/calendar/${year}/${month}` +
    `?latitude=${s.latitude}&longitude=${s.longitude}` +
    `&method=${s.method}&school=${s.school}&iso8601=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`AlAdhan ${res.status}`);
  const json = await res.json();

  localStorage.setItem(key, JSON.stringify(json.data));
  // Evict other months for this settings-combo to stay well under quota
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i)!;
    if (k.startsWith("aladhan-cal:") && k !== key) localStorage.removeItem(k);
  }
  return json.data;
}
```

Rules:

- **Key includes settings** — changing location/method/school naturally misses the cache and refetches.
- Use `iso8601=true` so timestamps are unambiguous (the raw `HH:mm` strings are in the *location's* timezone, not necessarily the device's — see the API quirks section of the prayer reference).
- **Prefetch next month** when within 3 days of month end (and opportunistically in a Periodic Background Sync handler on Chromium, where granted — it's a nice-to-have, not a dependency).
- A month of AlAdhan calendar JSON is ~100–150 KB — trivially within localStorage quota, but evict stale months anyway.

**Secondary: SW runtime cache** as a network-level backstop (covers code paths that fetch directly), added to `app/sw.ts`:

```ts
import { CacheFirst, ExpirationPlugin } from "serwist";

// in the Serwist constructor's runtimeCaching array, before defaultCache:
{
  matcher: ({ url }) => url.hostname === "api.aladhan.com",
  handler: new CacheFirst({
    cacheName: "aladhan-api",
    plugins: [new ExpirationPlugin({ maxEntries: 4, maxAgeSeconds: 40 * 24 * 60 * 60 })],
  }),
},
```

The app shell (JS/CSS/fonts/routes) is handled by Serwist's precache manifest + `defaultCache` automatically; `/~offline` is the navigation fallback for never-visited routes.

---

## 4. Test checklist

1. `next build && next start` (SW is disabled in dev by design), then Chrome DevTools → Application → Manifest: installable, no warnings; Service Workers: activated.
2. Lighthouse PWA pass on the production build.
3. Airplane mode after one load: prayer screen renders today's times from the month cache; navigation falls back to `/~offline` only for never-visited routes.
4. Notification flow: grant permission via the settings button → set device clock or a debug override near a prayer time → notification fires with app open; tap focuses/opens `/prayers`.
5. Background-tab catch-up: background the tab across a prayer time, refocus — the late notification fires (30-min grace), no duplicates on repeated focus (the `tag` + fired-log dedupe).
6. Badge on Android/desktop Chromium installed app; verify graceful no-op on Firefox.
7. ICS import into Google Calendar and Apple Calendar; alarms ring with the app closed.
8. iOS device: install to Home Screen (`display: standalone` respected), verify foreground notifications and badge on iOS 16.4+.

---

## Sources

- [Next.js: Progressive Web Apps guide](https://nextjs.org/docs/app/guides/progressive-web-apps) · [manifest file convention](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest) (also bundled in `node_modules/next/dist/docs/`)
- [Serwist: Turbopack integration docs](https://serwist.pages.dev/docs/next/turbo) · [@serwist/turbopack on npm](https://www.npmjs.com/package/@serwist/turbopack) · [migration write-up (Feb 2026)](https://shinyaz.com/en/blog/2026/02/24/serwist-turbopack-migration) · known issues [#335](https://github.com/serwist/serwist/issues/335), [#348](https://github.com/serwist/serwist/issues/348)
- [Aurora Scharff: PWA icons in Next.js 16 with Serwist (next-pwa → Serwist rationale)](https://aurorascharff.no/posts/dynamically-generating-pwa-app-icons-nextjs-16-serwist/)
- [Chrome: Notification Triggers API — development ended](https://developer.chrome.com/docs/web-platform/notification-triggers) · [decision discussion](https://github.com/beverloo/notification-triggers/issues/7)
- [Chrome: Periodic Background Sync](https://developer.chrome.com/docs/capabilities/periodic-background-sync) · [engagement-score intervals](https://felixgerschau.com/periodic-background-sync-explained/)
- [Chrome: timer throttling in background tabs](https://developer.chrome.com/blog/timer-throttling-in-chrome-88)
- [WebKit: Meet Declarative Web Push](https://webkit.org/blog/16535/meet-declarative-web-push/) · [Safari 18.4 features](https://webkit.org/blog/16574/webkit-features-in-safari-18-4/) · [State of Declarative Web Push 2026](https://aimtell.com/blog/state-of-declarative-web-push-2026)
- [MDN: Badging API](https://developer.mozilla.org/docs/Web/API/Badging_API) · [Notifications API](https://developer.mozilla.org/docs/Web/API/Notifications_API)
- [Manual Next.js 16 PWA + push walkthrough (Build with Matija)](https://www.buildwithmatija.com/blog/turn-nextjs-16-app-into-pwa)
- [AlAdhan Prayer Times API](https://aladhan.com/prayer-times-api) · internal: [`docs/context/islamic-prayer-reference.md`](../context/islamic-prayer-reference.md)
- [`web-push` (future backend)](https://www.npmjs.com/package/web-push) · RFC 5545 (iCalendar/`VALARM`)
