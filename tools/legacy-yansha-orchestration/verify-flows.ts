/**
 * Runtime verification of key store flows outside the browser.
 * Run one scenario per process (module state is import-cached):
 *   npx tsx scripts/verify-flows.ts <corrupt|fresh|restday|failday>
 */

// Minimal localStorage polyfill installed BEFORE the store module loads.
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

const scenario = process.argv[2];
let failures = 0;

function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures = failures + 1;
}

function todayKeyLocal(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

async function main() {
  if (scenario === "corrupt") {
    mem.set("arise-system-v1", "{this is not json!!!");
    const store = await import("@/lib/store");
    const backups = [...mem.keys()].filter((k) => k.startsWith("arise-system-v1-backup-"));
    check("corrupt blob backed up to timestamped key", backups.length === 1, backups.join(","));
    check("original bytes preserved in backup", mem.get(backups[0]) === "{this is not json!!!");
    check("recovery notice surfaced", store.storageRecoveryNotice != null);
    const s = store.useSystem.getState();
    check("store restarted with defaults", s.totalXp === 0 && s.workouts.length === 0);
    return;
  }

  if (scenario === "fresh") {
    const store = await import("@/lib/store");
    const sys = store.useSystem;
    const today = todayKeyLocal();

    // Fresh load → onboarding gate open (no onboardedAt), sensible defaults.
    let s = sys.getState();
    check("fresh load: onboarding not yet completed", s.settings.onboardedAt === null);
    check("fresh load: level-1 defaults", s.totalXp === 0 && s.streak.current === 0 && s.streak.freezes === 2);
    check("fresh load: Friday default rest day", JSON.stringify(s.settings.restDays) === "[5]");

    // Complete onboarding → gate closes, fitness modifier applied.
    sys.getState().completeOnboarding({ hunterName: "Tester", calorieGoal: 2100 }, 0.9);
    s = sys.getState();
    check("onboarding completes and persists name", s.settings.onboardedAt !== null && s.settings.hunterName === "Tester");
    check("baseline fitness modifier stored", s.difficulty.modifiers["fitness"] === 0.9);

    // Daily quest generation.
    sys.getState().ensureToday();
    s = sys.getState();
    const day = s.questDays[today];
    check("daily quest slate generated", !!day && day.quests.length > 0, `${day?.quests.length ?? 0} quests`);
    check("quest targets snapshotted with XP values", !!day && day.quests.every((q) => q.target > 0 && q.xp > 0));

    // XP exploit guard: empty slate must not grant full-clear bonus (dayCleared logic).
    const { dayCleared } = await import("@/lib/quests");
    check(
      "empty quest slate never counts as cleared",
      dayCleared({ date: today, rank: "E", isRest: false, quests: [], rolled: false, bonusAwarded: false }) === false
    );
    check(
      "zero-target slate never counts as cleared",
      dayCleared({
        date: today,
        rank: "E",
        isRest: false,
        rolled: false,
        bonusAwarded: false,
        quests: [{ templateId: "x", name: "x", category: "fitness", metric: "pushups", unit: "reps", target: 0, progress: 0, xp: 10, done: true, penaltyBearing: true }],
      }) === false
    );

    // Workout logging → XP + first-workout achievement.
    const xpBefore = s.totalXp;
    sys.getState().logWorkout({ date: today, name: "Push-Up", type: "strength", sets: 3, reps: 20, weightKg: 0, durationMin: 15 });
    s = sys.getState();
    check("workout awards XP", s.totalXp > xpBefore, `+${s.totalXp - xpBefore} XP`);
    check("first-workout achievement (Awakening) unlocked", !!s.achievements.earned["awakening"]);

    // Input clamping: absurd workout duration must be clamped (newest entry is first).
    sys.getState().logWorkout({ date: today, name: "Marathon", type: "cardio", sets: 0, reps: 0, weightKg: 0, durationMin: 99999 });
    s = sys.getState();
    const lastW = s.workouts[0];
    check("absurd duration clamped", lastW.name === "Marathon" && (lastW.durationMin ?? 0) <= 600, `stored ${lastW.durationMin}min`);

    // Prayer flow: on-time award, missed → qada, completeQada resolves it.
    const faithBefore = s.stats.faith;
    sys.getState().setPrayerStatus(today, "Fajr", "on_time");
    s = sys.getState();
    check("on-time prayer +Faith", s.stats.faith === faithBefore + 1);
    sys.getState().setPrayerStatus(today, "Dhuhr", "missed");
    s = sys.getState();
    const qada = s.qada.find((q) => q.date === today && q.prayer === "Dhuhr" && !q.completedAt);
    check("missed prayer creates open qada item", !!qada);
    const noXpLoss = s.totalXp >= xpBefore;
    check("no XP loss on missed prayer", noXpLoss);
    if (qada) {
      const xpBeforeQada = s.totalXp;
      sys.getState().completeQada(qada.id);
      s = sys.getState();
      check("qada completion awards XP and closes item", s.totalXp > xpBeforeQada && !s.qada.some((q) => q.id === qada.id && !q.completedAt));
    }

    // Meal + health logs update counters.
    sys.getState().logMeal({ date: today, name: "Chicken", calories: 400, protein: 40, carbs: 10, fat: 12 });
    sys.getState().logHealth(today, { waterMl: 2500, steps: 9000, sleepHours: 8 });
    s = sys.getState();
    check("meal logged", s.meals.length === 1);
    check("health metrics logged", (s.healthLogs[today]?.waterMl ?? 0) === 2500);

    // Persistence: everything above must be in the (fake) localStorage blob.
    const blob = mem.get("arise-system-v1");
    check("state persisted to storage", !!blob && blob.includes("Tester"));
    return;
  }

  if (scenario === "restday") {
    const store = await import("@/lib/store");
    const sys = store.useSystem;
    const today = todayKeyLocal();
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yesterday = todayKeyLocal(y);

    // Inject: yesterday was a REST day with zero progress, active 5-day streak, no freezes.
    sys.setState({
      settings: { ...sys.getState().settings, onboardedAt: new Date().toISOString() },
      streak: { current: 5, freezes: 0, lastRollover: (() => { const d = new Date(); d.setDate(d.getDate() - 2); return todayKeyLocal(d); })(), redemption: null, reducedBonus: false },
      questDays: {
        [yesterday]: { date: yesterday, rank: "E" as const, isRest: true, quests: [], rolled: false, bonusAwarded: false },
      },
    });
    sys.getState().ensureToday();
    const s = sys.getState();
    check("rest day preserves streak (5 → 6)", s.streak.current === 6, `streak=${s.streak.current}`);
    check("no redemption issued on rest day", s.streak.redemption === null);
    check("freezes untouched", s.streak.freezes === 0);
    check("yesterday marked rolled (snapshot frozen)", s.questDays[yesterday].rolled === true);
    check("today's slate generated after rollover", !!s.questDays[today]);
    return;
  }

  if (scenario === "failday") {
    const store = await import("@/lib/store");
    const sys = store.useSystem;
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yesterday = todayKeyLocal(y);

    // Case A: failed fitness day with a freeze available → streak preserved, freeze consumed.
    sys.setState({
      settings: { ...sys.getState().settings, onboardedAt: new Date().toISOString() },
      streak: { current: 9, freezes: 1, lastRollover: (() => { const d = new Date(); d.setDate(d.getDate() - 2); return todayKeyLocal(d); })(), redemption: null, reducedBonus: false },
      questDays: {
        [yesterday]: {
          date: yesterday,
          rank: "E" as const,
          isRest: false,
          rolled: false,
          bonusAwarded: false,
          quests: [{ templateId: "pushups-basic", name: "Push-Ups", category: "fitness" as const, metric: "pushups", target: 50, progress: 0, unit: "reps", xp: 20, done: false, penaltyBearing: true }],
        },
      },
    });
    sys.getState().ensureToday();
    let s = sys.getState();
    check("failed day consumes freeze, streak survives (9 → 10)", s.streak.current === 10 && s.streak.freezes === 0, `streak=${s.streak.current} freezes=${s.streak.freezes}`);
    check("no redemption while freeze covers it", s.streak.redemption === null);

    // Case B: failed day, no freeze → streak resets, redemption issued, XP untouched.
    const xp = s.totalXp;
    const dayBefore = new Date();
    dayBefore.setDate(dayBefore.getDate() - 1);
    sys.setState({
      streak: { current: 12, freezes: 0, lastRollover: (() => { const d = new Date(); d.setDate(d.getDate() - 2); return todayKeyLocal(d); })(), redemption: null, reducedBonus: false },
      questDays: {
        ...s.questDays,
        [yesterday]: {
          date: yesterday,
          rank: "E" as const,
          isRest: false,
          rolled: false,
          bonusAwarded: false,
          quests: [{ templateId: "pushups-basic", name: "Push-Ups", category: "fitness" as const, metric: "pushups", target: 50, progress: 0, unit: "reps", xp: 20, done: false, penaltyBearing: true }],
        },
      },
    });
    sys.getState().ensureToday();
    s = sys.getState();
    check("no-freeze failure resets streak to 0", s.streak.current === 0, `streak=${s.streak.current}`);
    check("redemption quest issued with saved streak", s.streak.redemption?.savedStreak === 12);
    check("XP never clawed back", s.totalXp === xp);
    return;
  }

  console.error(`Unknown scenario: ${scenario}`);
  process.exitCode = 1;
}

main().then(() => {
  if (failures > 0) {
    console.error(`\n${failures} check(s) FAILED in scenario "${scenario}"`);
    process.exitCode = 1;
  } else {
    console.log(`\nAll checks passed in scenario "${scenario}"`);
  }
});
