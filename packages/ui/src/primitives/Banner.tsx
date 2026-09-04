import type { ReactNode } from "react";
import { accentText, type Accent } from "../tokens/accent";

const BORDER_CLASS: Record<Accent, string> = {
  blue: "border-sysblue/50",
  purple: "border-syspurple/50",
  gold: "border-sysgold/50",
  red: "border-sysred/50",
  green: "border-sysgreen/50",
};

const TINT_CLASS: Record<Accent, string> = {
  blue: "bg-sysblue/5",
  purple: "bg-syspurple/5",
  gold: "bg-sysgold/5",
  red: "bg-sysred/5",
  green: "bg-sysgreen/5",
};

/**
 * A full-width advisory strip — the heuristic/protocol notice that
 * app/training/page.tsx hand-rolls inline above the page title, and that the
 * app surfaces each reimplement with slightly different
 * rgba borders.
 *
 * `status` is the right-hand readout ("✓ CALIBRATED"). It carries the state in
 * words, so the border hue stays decorative.
 */
export function Banner({
  eyebrow,
  children,
  status,
  statusAccent = "green",
  accent = "gold",
  className = "",
}: {
  eyebrow: ReactNode;
  children?: ReactNode;
  status?: ReactNode;
  statusAccent?: Accent;
  accent?: Accent;
  className?: string;
}) {
  return (
    <div
      className={`solo-cut-sm flex items-center justify-between gap-3 border px-5 py-3.5 ${BORDER_CLASS[accent]} ${TINT_CLASS[accent]} ${className}`}
    >
      <div className="min-w-0">
        <p className={`font-display text-[0.65rem] font-bold uppercase tracking-[0.1em] ${accentText(accent)}`}>
          {eyebrow}
        </p>
        {children && <p className="mt-1 text-xs leading-snug text-text-primary">{children}</p>}
      </div>
      {status && (
        <span
          className={`shrink-0 font-display text-[0.65rem] font-bold uppercase tracking-[0.1em] ${accentText(statusAccent)}`}
        >
          {status}
        </span>
      )}
    </div>
  );
}

