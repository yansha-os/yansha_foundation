import type { ReactNode } from "react";
import { accentGlow, accentText, type Accent } from "../tokens/accent";

/**
 * A single numeric readout: label above, monospaced-feeling value below.
 * Replaces the dozens of ad-hoc "label + big number" divs across the app.
 */
export function StatBlock({
  label,
  value,
  unit,
  accent = "blue",
  glow = false,
  icon,
  className = "",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  accent?: Accent;
  glow?: boolean;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`border border-line bg-void/50 p-3 ${className}`}>
      <p className="flex items-center gap-1.5 text-[0.6rem] uppercase tracking-[0.18em] text-text-faint">
        {icon}
        {label}
      </p>
      <p
        className={`mt-1 font-display text-xl font-bold ${accentText(accent)} ${
          glow ? accentGlow(accent) : ""
        }`}
      >
        {value}
        {unit && <span className="ml-1 text-[0.65rem] font-normal text-ghost">{unit}</span>}
      </p>
    </div>
  );
}

