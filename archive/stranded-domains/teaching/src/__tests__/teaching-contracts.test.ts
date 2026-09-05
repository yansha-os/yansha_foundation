import { describe, it, expect } from "vitest";
import {
  isMentor,
  isStudent,
  hasTelemetryScope,
  type Circle,
  type CircleMember,
  type CircleAssignment,
  type StudentRosterEntry,
} from "../index";

describe("@yansha/teaching Domain Contracts & Guards", () => {
  it("correctly identifies mentor vs student roles", () => {
    const mentorMember: CircleMember = {
      id: "m-1",
      circleId: "c-1",
      userId: "u-1",
      role: "mentor",
      sharedTelemetry: ["hifz"],
    };

    const studentMember: CircleMember = {
      id: "m-2",
      circleId: "c-1",
      userId: "u-2",
      role: "student",
      sharedTelemetry: ["hifz", "study"],
    };

    expect(isMentor(mentorMember)).toBe(true);
    expect(isStudent(mentorMember)).toBe(false);

    expect(isMentor(studentMember)).toBe(false);
    expect(isStudent(studentMember)).toBe(true);
  });

  it("checks whether a member has granted a specific telemetry scope", () => {
    const member: CircleMember = {
      id: "m-1",
      circleId: "c-1",
      userId: "u-1",
      role: "student",
      sharedTelemetry: ["hifz", "workout"],
    };

    expect(hasTelemetryScope(member.sharedTelemetry, "hifz")).toBe(true);
    expect(hasTelemetryScope(member.sharedTelemetry, "workout")).toBe(true);
    expect(hasTelemetryScope(member.sharedTelemetry, "study")).toBe(false);
  });

  it("models generic circle, assignment, and student roster entries cleanly", () => {
    const circle: Circle = {
      id: "c-100",
      code: "HIFZ-01",
      name: "Madinah Hifz Circle",
      category: "hifz",
      mentorId: "user-mentor-1",
    };

    const assignment: CircleAssignment = {
      id: "a-1",
      circleId: "c-100",
      title: "Sabaq: Surah Al-Mulk",
      description: "Recite Ayah 1-10 with proper Tajweed",
      moduleType: "hifz",
      targetValue: "Surah 67, Ayah 1-10",
    };

    const student: StudentRosterEntry = {
      userId: "u-99",
      name: "Tariq",
      role: "student",
      joinedAt: "2026-09-02",
      sharedTelemetry: ["hifz"],
      telemetrySlots: [{ label: "Hifz Portions", value: "Surah Al-Mulk", scope: "hifz" }],
    };

    expect(circle.code).toBe("HIFZ-01");
    expect(assignment.targetValue).toBe("Surah 67, Ayah 1-10");
    expect(student.telemetrySlots?.[0].value).toBe("Surah Al-Mulk");
  });
});
