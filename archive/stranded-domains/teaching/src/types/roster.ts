import type { SharingScope } from "@yansha/shared-types";
import type { CircleRole } from "./circle";

export interface TelemetrySlot {
  label: string;
  value: string;
  highlightColor?: string;
  scope?: SharingScope;
}

export interface StudentRosterEntry {
  userId: string;
  name: string;
  role: CircleRole;
  joinedAt: string;
  lastActive?: string;
  sharedTelemetry: SharingScope[];
  /**
   * Generic domain telemetry slots supplied by domain adapters (e.g. Sahwa, Workout, Study).
   * Generic Teaching contracts never hardcode domain-specific fields.
   */
  telemetrySlots?: TelemetrySlot[];
}
