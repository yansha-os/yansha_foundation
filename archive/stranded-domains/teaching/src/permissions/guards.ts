import type { SharingScope } from "@yansha/shared-types";
import { isShareableScope } from "@yansha/shared-utils";
import type { CircleRole, CircleMember } from "../types/circle";
import type { TelemetrySlot } from "../types/roster";

/**
 * Checks if a member has mentor role in a circle.
 * Note: A mentor role is strictly a classroom coordinator within that circle.
 * It carries NO religious scholarly authority or global admin permissions.
 */
export function isMentor(member: { role: string } | CircleRole): boolean {
  if (typeof member === "string") return member === "mentor";
  return member.role === "mentor";
}

export function isStudent(member: { role: string } | CircleRole): boolean {
  if (typeof member === "string") return member === "student";
  return member.role === "student";
}

/**
 * Validates whether a specific telemetry scope has been explicitly granted by the student.
 */
export function hasTelemetryScope(
  grantedScopes: readonly string[] | undefined,
  scope: SharingScope
): boolean {
  if (!grantedScopes || !Array.isArray(grantedScopes)) return false;
  return grantedScopes.includes(scope);
}

/**
 * Filters generic telemetry slots so that only slots with an explicitly granted
 * and constitutionally shareable scope are visible to the mentor.
 */
export function filterAllowedTelemetrySlots(
  grantedScopes: readonly string[] | undefined,
  slots?: TelemetrySlot[]
): TelemetrySlot[] {
  if (!slots || !Array.isArray(slots)) return [];
  if (!grantedScopes || !Array.isArray(grantedScopes)) return [];

  return slots.filter((slot) => {
    if (!slot.scope) return false;
    if (!isShareableScope(slot.scope)) return false;
    return grantedScopes.includes(slot.scope);
  });
}
