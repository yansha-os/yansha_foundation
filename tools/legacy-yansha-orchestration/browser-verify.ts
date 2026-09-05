/** Real-browser verification of the React-only bugs.
 *  Run: npx tsx scripts/browser-verify.ts  (dev server must be on :3200) */
import { readFileSync } from "node:fs";
import { chromium, type BrowserContext, type Page } from "playwright";

const BASE = "http://localhost:3200";
const seedBlob = readFileSync("scripts/seed-blob.json", "utf8");

let failures = 0;
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
}

interface Watched {
  errors: string[];
  hydration: string[];
}

function watch(page: Page): Watched {
  const w: Watched = { errors: [], hydration: [] };
  page.on("console", (msg) => {
    const text = msg.text();
    if (/getSnapshot|Maximum update depth/i.test(text)) w.errors.push(text.slice(0, 200));
    if (/hydrat/i.test(text)) w.hydration.push(text.slice(0, 200));
  });
  page.on("pageerror", (err) => {
    const text = String(err.message);
    if (/getSnapshot|Maximum update depth/i.test(text)) w.errors.push(text.slice(0, 200));
    if (/hydrat/i.test(text)) w.hydration.push(text.slice(0, 200));
  });
  return w;
}

async function seededTests(ctx: BrowserContext) {
  await ctx.addInitScript(
    ([key, blob]) => {
      window.localStorage.setItem(key, blob);
    },
    ["arise-system-v1", seedBlob]
  );
  const page = await ctx.newPage();
  const w = watch(page);

  // Dashboard: previously crashed with the getSnapshot infinite loop.
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  check("dashboard renders Status Window", await page.getByText("Status Window").first().isVisible());
  check("dashboard shows Acts of Worship card", await page.getByText("Acts of Worship").first().isVisible());
  check("no infinite-loop errors on /", w.errors.length === 0, w.errors[0] ?? "");

  // Worship page: second reported crash site (+ DhikrPanel duplicate).
  await page.goto(`${BASE}/worship`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  check("worship renders Today's Prayers", await page.getByText("Today's Prayers").first().isVisible());
  check("worship shows qada list (seeded missed prayer)", await page.getByText("Make-up prayers (qada)").first().isVisible());
  check("no infinite-loop errors on /worship", w.errors.length === 0, w.errors[0] ?? "");

  // Records: sidebar link must load the achievements page.
  await page.getByRole("link", { name: "Records" }).first().click();
  await page.waitForURL("**/records");
  await page.waitForTimeout(1500);
  check("sidebar Records link navigates to /records", page.url().endsWith("/records"));
  check("records page shows achievement grid", await page.getByText("Awakening").first().isVisible());

  // Training: hydration check on a full reload (SSR shell vs client).
  const w2 = watch(page);
  await page.goto(`${BASE}/training`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  check("training renders Daily Quest", await page.getByText(/Daily Quest|Recovery Quest/).first().isVisible());
  check("no hydration warnings on /training", w2.hydration.length === 0, w2.hydration[0] ?? "");
  check("no loop errors on /training", w2.errors.length === 0, w2.errors[0] ?? "");
  await page.close();
}

async function onboardingTest(ctx: BrowserContext) {
  const page = await ctx.newPage();
  const w = watch(page);
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  // S0 → S1
  check("fresh profile shows Awakening prompt", await page.getByText("qualifications to be a").first().isVisible());
  await page.getByRole("button", { name: "Accept" }).click();
  await page.getByPlaceholder("Player").fill("QA Hunter");
  await page.getByRole("button", { name: "Register" }).click();

  // S2 · Body Scan
  await page.getByText("[Body Scan]").waitFor();
  const submit = page.getByRole("button", { name: "Submit Scan" });
  check("submit disabled while fields empty", await submit.isDisabled());

  await page.getByRole("button", { name: "male", exact: true }).click();
  await page.locator('label:has-text("Age") input').fill("28");
  await page.locator('label:has-text("Height") input').fill("178");
  await page.locator('label:has-text("Weight") input').fill("78");
  await page.waitForTimeout(300);
  check("submit ENABLED with all fields valid (metric)", await submit.isEnabled());

  // Imperial round-trip must not corrupt values / disable submit.
  await page.getByRole("button", { name: /METRIC|IMPERIAL/ }).click();
  await page.locator('label:has-text("Height") input').fill("70");
  await page.locator('label:has-text("Weight") input').fill("170");
  await page.waitForTimeout(300);
  check("submit still enabled after imperial entry", await submit.isEnabled());

  await submit.click();
  await page.getByText("[Lifestyle Analysis]").waitFor({ timeout: 5000 });
  check("body scan submits and advances to Lifestyle Analysis", true);
  check("no loop/hydration errors during onboarding", w.errors.length === 0 && w.hydration.length === 0, w.errors[0] ?? w.hydration[0] ?? "");
  await page.close();
}

async function main() {
  const browser = await chromium.launch({ channel: "msedge", headless: true });
  try {
    console.log("── seeded (onboarded) profile ──");
    const seeded = await browser.newContext();
    await seededTests(seeded);
    await seeded.close();

    console.log("── fresh profile (onboarding) ──");
    const fresh = await browser.newContext();
    await onboardingTest(fresh);
    await fresh.close();
  } finally {
    await browser.close();
  }
  if (failures > 0) {
    console.error(`\n${failures} browser check(s) FAILED`);
    process.exit(1);
  }
  console.log("\nAll browser checks passed");
}

void main();
