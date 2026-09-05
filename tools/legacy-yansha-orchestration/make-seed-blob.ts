/** Generates a full, valid persisted-state blob (onboarded user, prayer
 *  tracking on) for browser tests. Run: npx tsx scripts/make-seed-blob.ts */
import { writeFileSync } from "node:fs";

const mem = new Map<string, string>();
const fakeStorage = {
  getItem: (k: string) => (mem.has(k) ? (mem.get(k) as string) : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  get length() {
    return mem.size;
  },
  key: (i: number) => [...mem.keys()][i] ?? null,
};
(globalThis as Record<string, unknown>).window = { localStorage: fakeStorage };
(globalThis as Record<string, unknown>).localStorage = fakeStorage;

async function main() {
  const store = await import("@/lib/store");
  // The key comes from the gateway now; the store no longer re-exports it.
  const { STORAGE_KEY } = await import("@/lib/persisted-state-gateway");
  const sys = store.useSystem;
  sys.getState().completeOnboarding(
    { hunterName: "BrowserQA", prayerEnabled: true, city: "Istanbul", country: "Turkey", weightKg: 75, heightCm: 178, age: 28, sex: "male" },
    1.0
  );
  sys.getState().ensureToday();
  const today = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  const key = `${today.getFullYear()}-${p(today.getMonth() + 1)}-${p(today.getDate())}`;
  sys.getState().setPrayerStatus(key, "Fajr", "on_time");
  sys.getState().setPrayerStatus(key, "Dhuhr", "missed"); // exercises qada UI
  const blob = mem.get(STORAGE_KEY);
  if (!blob) throw new Error("no blob persisted");
  writeFileSync("scripts/seed-blob.json", blob);
  console.log("seed blob written,", blob.length, "bytes");
}

void main();
