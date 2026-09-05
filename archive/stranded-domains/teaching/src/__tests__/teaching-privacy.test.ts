import { describe, it, expect } from "vitest";
import {
  SHAREABLE_SCOPES,
  FORBIDDEN_SHARING_SCOPES,
  isShareableScope,
  isForbiddenSharingScope,
  sanitizeSharingScopes,
  resolveSharingScopeRequest,
} from "@yansha/shared-utils";
import { filterAllowedTelemetrySlots, isMentor } from "../permissions/guards";
import type { TelemetrySlot } from "../types/roster";

describe("Teaching Privacy & Constitutional Boundary (CONSTITUTION §12)", () => {
  it("never includes salah, prayer, qada, dhikr, faith, or fasting in shareable scopes", () => {
    for (const forbidden of FORBIDDEN_SHARING_SCOPES) {
      expect(isShareableScope(forbidden)).toBe(false);
      expect(isForbiddenSharingScope(forbidden)).toBe(true);
    }
  });

  it("permits only educational, workout, and study scopes", () => {
    expect(SHAREABLE_SCOPES).toEqual(["hifz", "workout", "study"]);
  });

  it("sanitizes untrusted telemetry requests by stripping worship scopes", () => {
    const raw = ["hifz", "salah", "qada", "dhikr", "workout", "fasting", "faith"];
    const sanitized = sanitizeSharingScopes(raw);
    expect(sanitized).toEqual(["hifz", "workout"]);
  });

  it("rejects telemetry requests containing forbidden worship scopes", () => {
    const res = resolveSharingScopeRequest(["hifz", "salah"]);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error).toContain("Worship-adherence data can never be shared");
    }
  });

  it("filters out forbidden or non-granted telemetry slots from student roster", () => {
    const grantedScopes = ["hifz"] as const;
    const allSlots: TelemetrySlot[] = [
      { label: "Hifz Portions", value: "Juz 30", scope: "hifz" },
      { label: "Workout Streak", value: "14 days", scope: "workout" },
      // @ts-expect-error Testing runtime injection of forbidden scope
      { label: "Salah Adherence", value: "5/5", scope: "salah" },
    ];

    const allowed = filterAllowedTelemetrySlots(grantedScopes, allSlots);
    expect(allowed).toHaveLength(1);
    expect(allowed[0].label).toBe("Hifz Portions");
  });

  it("ensures mentor role cannot bypass privacy rules or access ungranted scopes", () => {
    expect(isMentor({ role: "mentor" })).toBe(true);
    // Even if caller is mentor, privacy filter strictly limits to student's granted scopes
    const studentGranted = ["study"] as const;
    const slots: TelemetrySlot[] = [
      { label: "Hifz", value: "Surah Yasin", scope: "hifz" },
      { label: "Study", value: "Chapter 5", scope: "study" },
    ];

    const visibleToMentor = filterAllowedTelemetrySlots(studentGranted, slots);
    expect(visibleToMentor).toHaveLength(1);
    expect(visibleToMentor[0].label).toBe("Study");
  });
});
