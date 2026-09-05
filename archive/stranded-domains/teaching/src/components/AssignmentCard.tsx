import React from "react";
import { CheckCircle2 } from "lucide-react";
import type { ClientAssignmentView } from "../types/assignment";

export interface AssignmentCardProps {
  assignment: ClientAssignmentView;
  onToggleComplete?: (id: string) => void;
}

export function AssignmentCard({ assignment, onToggleComplete }: AssignmentCardProps) {
  const isCompleted = Boolean(assignment.completed);

  return (
    <div
      style={{
        border: `1px solid ${isCompleted ? "#3ddc97" : "rgba(255, 200, 87, 0.3)"}`,
        background: isCompleted ? "rgba(10, 24, 18, 0.7)" : "rgba(16, 14, 8, 0.8)",
        padding: "1.25rem",
        borderRadius: "6px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        transition: "all 0.2s ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
        <button
          type="button"
          onClick={() => onToggleComplete && onToggleComplete(assignment.id)}
          aria-label={isCompleted ? "Mark incomplete" : "Mark complete"}
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "50%",
            border: `1px solid ${isCompleted ? "#3ddc97" : "#ffd166"}`,
            background: isCompleted ? "#3ddc97" : "transparent",
            color: isCompleted ? "#000" : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: onToggleComplete ? "pointer" : "default",
            flexShrink: 0,
            marginTop: "2px",
          }}
        >
          {isCompleted && <CheckCircle2 size={18} />}
        </button>

        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {assignment.circleName && (
              <span style={{ fontFamily: "monospace", fontSize: "0.6rem", color: "#8892b0", textTransform: "uppercase" }}>
                [{assignment.circleName}]
              </span>
            )}
            <span style={{ fontFamily: "monospace", fontSize: "0.6rem", color: "#54e0ff" }}>
              Target: {assignment.targetValue}
            </span>
          </div>

          <h4
            style={{
              fontFamily: "var(--font-orbitron, monospace)",
              fontSize: "0.95rem",
              fontWeight: 700,
              color: isCompleted ? "#3ddc97" : "#fff",
              margin: "0.2rem 0",
            }}
          >
            {assignment.title}
          </h4>

          {assignment.dueDate && (
            <span style={{ fontFamily: "monospace", fontSize: "0.65rem", color: "#8892b0" }}>
              Due Date: {assignment.dueDate}
            </span>
          )}
        </div>
      </div>

      {typeof assignment.xpReward === "number" && (
        <span
          style={{
            fontFamily: "monospace",
            fontSize: "0.75rem",
            color: "#ffd166",
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          +{assignment.xpReward} XP
        </span>
      )}
    </div>
  );
}
