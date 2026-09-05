/**
 * Quran Data Integrity Validation Script
 *
 * This verifies two separate claims:
 * 1. Canonical metadata integrity: 114 surahs and 6,236 Hafs ayahs by count.
 * 2. Local bundled offline coverage: only ayahs present in LOCAL_BUNDLED_VERSES.
 *
 * It intentionally does not claim that all 6,236 ayah texts are bundled until
 * the local dataset actually contains them.
 */

import { ALL_114_SURAHS, LOCAL_BUNDLED_VERSES } from "../lib/quran-data";
import { quranDataEngine } from "../lib/quran-data-engine";

const EXPECTED_SURAH_COUNT = 114;
const EXPECTED_HAFS_AYAH_COUNT = 6236;

function fail(message: string): never {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

function verifyQuranDataIntegrity(): void {
  console.log("[Yansha] Starting Quran data integrity audit.\n");

  if (ALL_114_SURAHS.length !== EXPECTED_SURAH_COUNT) {
    fail(`Expected ${EXPECTED_SURAH_COUNT} surahs, found ${ALL_114_SURAHS.length}.`);
  }

  const seenSurahIds = new Set<number>();
  let totalAyahs = 0;

  for (const surah of ALL_114_SURAHS) {
    if (seenSurahIds.has(surah.id)) {
      fail(`Duplicate surah id found: ${surah.id}.`);
    }
    seenSurahIds.add(surah.id);

    if (surah.id < 1 || surah.id > EXPECTED_SURAH_COUNT) {
      fail(`Surah ${surah.name} has invalid id ${surah.id}.`);
    }
    if (surah.ayahsCount < 1) {
      fail(`Surah ${surah.id} (${surah.name}) has invalid ayah count ${surah.ayahsCount}.`);
    }

    totalAyahs += surah.ayahsCount;
  }

  if (totalAyahs !== EXPECTED_HAFS_AYAH_COUNT) {
    fail(`Expected ${EXPECTED_HAFS_AYAH_COUNT} ayahs by metadata, found ${totalAyahs}.`);
  }

  // Obtain engine's coverage report to verify consistency
  const coverageReport = quranDataEngine.getOfflineCoverageReport();
  if (coverageReport.totalSurahs !== EXPECTED_SURAH_COUNT) {
    fail(`Coverage report totalSurahs mismatch: ${coverageReport.totalSurahs}`);
  }
  if (coverageReport.totalAyahs !== EXPECTED_HAFS_AYAH_COUNT) {
    fail(`Coverage report totalAyahs mismatch: ${coverageReport.totalAyahs}`);
  }

  const bundledSurahIds = Object.keys(LOCAL_BUNDLED_VERSES).map(Number).sort((a, b) => a - b);
  let bundledAyahCount = 0;

  for (const surahId of bundledSurahIds) {
    const surahMeta = ALL_114_SURAHS.find((surah) => surah.id === surahId);
    if (!surahMeta) {
      fail(`Bundled data references unknown surah ${surahId}.`);
    }

    const verses = LOCAL_BUNDLED_VERSES[surahId] ?? [];
    const seenAyahNumbers = new Set<number>();

    for (const verse of verses) {
      if (seenAyahNumbers.has(verse.number)) {
        fail(`Duplicate bundled ayah ${surahId}:${verse.number}.`);
      }
      seenAyahNumbers.add(verse.number);

      if (verse.number < 1 || verse.number > surahMeta.ayahsCount) {
        fail(`Bundled ayah ${surahId}:${verse.number} is outside the surah range.`);
      }
      if (!verse.arabic.trim()) {
        fail(`Bundled ayah ${surahId}:${verse.number} has empty Arabic text.`);
      }
      if (!verse.translation.trim()) {
        fail(`Bundled ayah ${surahId}:${verse.number} has empty translation.`);
      }
      if (!verse.words || verse.words.length === 0) {
        fail(`Bundled ayah ${surahId}:${verse.number} is missing word tokens.`);
      }

      bundledAyahCount++;
    }
  }

  if (coverageReport.bundledAyahCount !== bundledAyahCount) {
    fail(`Report bundled ayah count mismatch: ${coverageReport.bundledAyahCount} vs ${bundledAyahCount}`);
  }

  console.log("Metadata integrity: PASS");
  console.log(`- Surahs: ${ALL_114_SURAHS.length}/${EXPECTED_SURAH_COUNT}`);
  console.log(`- Ayah count metadata: ${totalAyahs}/${EXPECTED_HAFS_AYAH_COUNT}`);
  console.log("\nBundled offline text coverage: PARTIAL");
  console.log(`- Bundled surahs: ${coverageReport.bundledSurahIds.join(", ") || "none"}`);
  console.log(`- Bundled ayahs: ${coverageReport.bundledAyahCount}/${coverageReport.totalAyahs} (${coverageReport.coveragePercentage.toFixed(2)}%)`);
  console.log("\nAudit complete. Full offline Quran text is not complete yet.");
}

verifyQuranDataIntegrity();
