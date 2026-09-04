import type { ReactNode } from "react";
import type { Accent } from "../tokens/accent";

type Tone = Accent | "neutral";

function toneClass(tone: Tone) {
  switch (tone) {
    case "blue":
      return "border-sysblue/50 bg-sysblue/15 text-sysblue";
    case "purple":
      return "border-syspurple/50 bg-syspurple/15 text-syspurple";
    case "gold":
      return "border-sysgold/50 bg-sysgold/15 text-sysgold";
    case "red":
      return "border-sysred/50 bg-sysred/15 text-sysred";
    case "green":
      return "border-sysgreen/50 bg-sysgreen/15 text-sysgreen";
    default:
      return "border-line bg-void/70 text-ghost";
  }
}

/**
 * Bracketed status readout, e.g. [ACCESS SEALED], [CALIBRATED], [SYNCED].
 * `bracketed` renders the canonical square-bracket affordance.
 */
export function StatusPill({
  tone = "neutral",
  bracketed = true,
  icon,
  children,
  className = "",
}: {
  tone?: Tone;
  bracketed?: boolean;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 font-display text-[0.6rem] font-bold uppercase tracking-[0.18em] ${toneClass(tone)} ${className}`}
    >
      {icon}
      {bracketed ? <>[{children}]</> : children}
    </span>
  );
}

