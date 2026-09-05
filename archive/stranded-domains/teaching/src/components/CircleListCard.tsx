import React from "react";
import type { SharingScope } from "@yansha/shared-types";
import { sanitizeSharingScopes } from "@yansha/shared-utils";
import type { CircleView } from "../types/circle";

export interface CircleListCardProps {
  circle: CircleView;
  sharedTelemetry?: SharingScope[];
  onSelect?: (circleId: string) => void;
}

export function CircleListCard({ circle, sharedTelemetry = [], onSelect }: CircleListCardProps) {
  const scopes = sanitizeSharingScopes(sharedTelemetry.length > 0 ? sharedTelemetry : ["hifz"]);

  return (
    <div
      onClick={() => onSelect && onSelect(circle.id)}
      style={{
        border: "1px solid rgba(84, 224, 255, 0.25)",
        background: "linear-gradient(160deg, rgba(10, 20, 32, 0.85), rgba(4, 8, 14, 0.96))",
        padding: "1.35rem",
        borderRadius: "6px",
        display: "flex",
        flexDirection: "column",
        gap: "0.85rem",
        boxShadow: "0 0 20px rgba(84, 224, 255, 0.08)",
        cursor: onSelect ? "pointer" : "default",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <span
            style={{
              fontFamily: "monospace",
              fontSize: "0.6rem",
              color: "#54e0ff",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            CODE: {circle.code}
          </span>
          <h3
            style={{
              fontFamily: "var(--font-orbitron, monospace)",
              fontSize: "1.05rem",
              fontWeight: 700,
              color: "#fff",
              margin: "0.2rem 0",
            }}
          >
            {circle.name}
          </h3>
        </div>
        <span
          style={{
            background: "rgba(61, 220, 151, 0.15)",
            border: "1px solid #3ddc97",
            color: "#3ddc97",
            fontSize: "0.62rem",
            fontFamily: "monospace",
            padding: "2px 6px",
            borderRadius: "3px",
          }}
        >
          ACTIVE CIRCLE
        </span>
      </div>

      <div
        style={{
          background: "rgba(6, 12, 20, 0.6)",
          border: "1px solid #1c283c",
          padding: "0.85rem",
          borderRadius: "4px",
          display: "flex",
          flexDirection: "column",
          gap: "0.35rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "monospace", fontSize: "0.68rem" }}>
          <span style={{ color: "#8892b0" }}>Mentor / Lead:</span>
          <span style={{ color: "#fff", fontWeight: 700 }}>{circle.mentorName || "Mentor Direct"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "monospace", fontSize: "0.68rem" }}>
          <span style={{ color: "#8892b0" }}>Category:</span>
          <span style={{ color: "#54e0ff", textTransform: "capitalize" }}>{circle.category || "General"}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "monospace", fontSize: "0.68rem" }}>
          <span style={{ color: "#8892b0" }}>Weekly Target:</span>
          <span style={{ color: "#ffd166" }}>{circle.weeklyGoal || "Review Assigned Portions"}</span>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "0.25rem" }}>
        <div style={{ display: "flex", gap: "0.3rem" }}>
          {scopes.map((t) => (
            <span
              key={t}
              style={{
                fontFamily: "monospace",
                fontSize: "0.58rem",
                color: "#8892b0",
                background: "rgba(18, 24, 38, 0.7)",
                padding: "1px 5px",
                borderRadius: "2px",
              }}
            >
              🔒 {t}
            </span>
          ))}
        </div>
        <span style={{ fontFamily: "monospace", fontSize: "0.62rem", color: "#3ddc97" }}>
          ✓ RLS Protected
        </span>
      </div>
    </div>
  );
}
