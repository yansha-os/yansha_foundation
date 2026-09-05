import type { SharingScope } from "@yansha/shared-types";

export type CircleRole = "mentor" | "student";

export type CircleCategory = "hifz" | "workout" | "study" | "general";

export interface Circle {
  id: string;
  code: string;
  name: string;
  category: CircleCategory | string;
  mentorId: string;
  description?: string | null;
  createdAt?: string | Date;
  updatedAt?: string | Date;
}

export interface CircleMember {
  id: string;
  circleId: string;
  userId: string;
  role: CircleRole;
  sharedTelemetry: SharingScope[];
  joinedAt?: string | Date;
}

export interface CircleView extends Circle {
  mentorName?: string;
  weeklyGoal?: string;
  membersCount?: number;
}
