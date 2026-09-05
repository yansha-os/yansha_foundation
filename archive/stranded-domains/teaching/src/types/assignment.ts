export interface CircleAssignment {
  id: string;
  circleId: string;
  title: string;
  description: string;
  moduleType: "hifz" | "workout" | "study" | string;
  targetValue: string; // Plain human-readable target string (e.g. "Surah Al-Mulk (Ayah 1-15)")
  dueDate?: string | null;
  createdAt?: string | Date;
}

export interface ClientAssignmentView extends CircleAssignment {
  circleName?: string;
  completed?: boolean;
  xpReward?: number;
}
