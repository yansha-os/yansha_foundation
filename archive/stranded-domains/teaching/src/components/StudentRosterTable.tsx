import React from "react";
import type { StudentRosterEntry } from "../types/roster";
import { filterAllowedTelemetrySlots } from "../permissions/guards";

export interface StudentRosterTableProps {
  students: StudentRosterEntry[];
  renderCustomSlots?: (student: StudentRosterEntry) => React.ReactNode;
}

export function StudentRosterTable({ students, renderCustomSlots }: StudentRosterTableProps) {
  if (students.length === 0) {
    return (
      <div
        style={{
          border: "1px solid #1c283c",
          background: "rgba(6, 12, 20, 0.6)",
          padding: "2rem 1.5rem",
          borderRadius: "6px",
          textAlign: "center",
        }}
      >
        <p style={{ fontFamily: "monospace", fontSize: "0.78rem", color: "#e9edf9", margin: 0 }}>
          No students on your roster.
        </p>
        <p style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "#8892b0", margin: "0.4rem 0 0 0" }}>
          Students appear here only for circles you mentor, and only for the telemetry they explicitly chose to share.
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
      {students.map((student) => {
        // Enforce privacy: only display slots matching explicitly granted and permitted scopes
        const allowedSlots = filterAllowedTelemetrySlots(student.sharedTelemetry, student.telemetrySlots);

        return (
          <div
            key={student.userId}
            style={{
              border: "1px solid rgba(84, 224, 255, 0.2)",
              background: "rgba(10, 18, 28, 0.7)",
              padding: "1rem 1.25rem",
              borderRadius: "6px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "1rem",
            }}
          >
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span
                  style={{
                    fontFamily: "var(--font-orbitron, monospace)",
                    fontSize: "0.95rem",
                    fontWeight: 700,
                    color: "#fff",
                  }}
                >
                  {student.name}
                </span>
                {student.lastActive && (
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: "0.58rem",
                      color: "#3ddc97",
                      background: "rgba(61, 220, 151, 0.1)",
                      padding: "1px 5px",
                      borderRadius: "2px",
                    }}
                  >
                    {student.lastActive}
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: "0.3rem", marginTop: "0.3rem" }}>
                {student.sharedTelemetry.map((scope) => (
                  <span
                    key={scope}
                    style={{
                      fontFamily: "monospace",
                      fontSize: "0.55rem",
                      color: "#8892b0",
                      background: "rgba(18, 24, 38, 0.6)",
                      padding: "1px 4px",
                      borderRadius: "2px",
                    }}
                  >
                    🔒 {scope}
                  </span>
                ))}
              </div>
            </div>

            {renderCustomSlots ? (
              renderCustomSlots(student)
            ) : (
              <div style={{ display: "flex", gap: "1.5rem", fontFamily: "monospace", fontSize: "0.72rem" }}>
                {allowedSlots.map((slot, idx) => (
                  <div key={idx}>
                    <span style={{ color: "#8892b0", display: "block", fontSize: "0.58rem", textTransform: "uppercase" }}>
                      {slot.label}
                    </span>
                    <span style={{ color: slot.highlightColor || "#fff", fontWeight: 700 }}>
                      {slot.value}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
