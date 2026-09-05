/**
 * Re-runs the Codex review probe against the Hifz Studio gate.
 *
 * Usage: npx tsx scripts/probe-qaida-gate.ts
 */
import {
  allCurriculumLessonIds,
  isHifzStudioUnlocked,
  legacyLadderCoverage,
} from "../lib/qaida-mastery";
import type { QaidaProgressState } from "../lib/types";

const forged = {
  completedLessons: ["17"],
  completedItems: {},
  isGraduated: true,
  currentStageIndex: 0,
} as QaidaProgressState;

const allLessonIds = allCurriculumLessonIds();
const genuineTokens = {
  isGraduated: true,
  graduatedAt: "2026-06-01T00:00:00.000Z",
  completedLessons: [...allLessonIds],
  completedItems: {},
  currentStageIndex: 5,
} as QaidaProgressState;

const itemsOnly: Record<string, boolean> = {};
allLessonIds.forEach((id, li) => {
  itemsOnly[`${id}:0`] = true;
  itemsOnly[`0-${li}-0`] = true;
});
const genuineItemsOnly = {
  isGraduated: true,
  completedLessons: [],
  completedItems: itemsOnly,
  currentStageIndex: 5,
} as QaidaProgressState;

for (const [label, state] of [
  ["forged (one token + isGraduated)", forged],
  ["genuine legacy graduate (lesson tokens)", genuineTokens],
  ["genuine legacy graduate (item keys only)", genuineItemsOnly],
] as const) {
  console.log(
    `${label}: unlocked=${isHifzStudioUnlocked(state)} coverage=${legacyLadderCoverage(state).toFixed(4)}`
  );
}
