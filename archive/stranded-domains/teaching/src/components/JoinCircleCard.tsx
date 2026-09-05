import React from "react";
import { Users, Loader2 } from "lucide-react";

export interface JoinCircleCardProps {
  inviteCode: string;
  onInviteCodeChange: (code: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting?: boolean;
  error?: string | null;
}

export function JoinCircleCard({
  inviteCode,
  onInviteCodeChange,
  onSubmit,
  isSubmitting = false,
  error = null,
}: JoinCircleCardProps) {
  return (
    <div
      style={{
        border: "1px solid rgba(61, 220, 151, 0.3)",
        background: "linear-gradient(160deg, rgba(10, 24, 18, 0.8), rgba(4, 10, 8, 0.95))",
        padding: "2rem 1.5rem",
        borderRadius: "6px",
        maxWidth: "500px",
        margin: "0 auto",
        textAlign: "center",
        display: "flex",
        flexDirection: "column",
        gap: "1.25rem",
      }}
    >
      <div>
        <Users size={32} style={{ color: "#3ddc97", margin: "0 auto 0.5rem auto" }} />
        <h2
          style={{
            fontFamily: "var(--font-orbitron, monospace)",
            fontSize: "1.2rem",
            fontWeight: 700,
            color: "#fff",
            margin: 0,
          }}
        >
          JOIN A CIRCLE
        </h2>
        <p style={{ fontFamily: "monospace", fontSize: "0.72rem", color: "#8892b0", marginTop: "0.3rem" }}>
          Enter the code provided by your teacher, coach, or study circle mentor.
        </p>
      </div>

      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <input
          type="text"
          placeholder="e.g. HIFZ-99 or COACH-01"
          value={inviteCode}
          onChange={(e) => onInviteCodeChange(e.target.value)}
          disabled={isSubmitting}
          style={{
            background: "rgba(6, 12, 10, 0.8)",
            border: "1px solid rgba(61, 220, 151, 0.4)",
            color: "#fff",
            padding: "0.75rem 1rem",
            borderRadius: "4px",
            fontFamily: "monospace",
            fontSize: "1rem",
            textAlign: "center",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            outline: "none",
          }}
        />

        {error && (
          <div
            style={{
              color: "#ff6b6b",
              fontFamily: "monospace",
              fontSize: "0.72rem",
              background: "rgba(255, 107, 107, 0.1)",
              padding: "0.4rem",
              borderRadius: "3px",
              border: "1px solid rgba(255, 107, 107, 0.3)",
            }}
          >
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isSubmitting || !inviteCode.trim()}
          style={{
            background: "linear-gradient(120deg, #3ddc97, #4d9fff)",
            color: "#000",
            border: "none",
            padding: "0.75rem",
            borderRadius: "4px",
            fontFamily: "var(--font-orbitron, monospace)",
            fontSize: "0.85rem",
            fontWeight: 800,
            cursor: isSubmitting || !inviteCode.trim() ? "not-allowed" : "pointer",
            opacity: isSubmitting || !inviteCode.trim() ? 0.6 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.5rem",
          }}
        >
          {isSubmitting ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>CONNECTING...</span>
            </>
          ) : (
            <span>CONNECT TO CIRCLE →</span>
          )}
        </button>
      </form>
    </div>
  );
}
