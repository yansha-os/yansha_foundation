import { clampProgressPercent } from "./progress";
import type { Accent } from "../tokens/accent";

/**
 * Fill recipe per accent, expressed against the token layer rather than the raw
 * palette. `color-mix` reproduces the canonical 60%-alpha glow without pinning
 * a second copy of each hue into a shadow literal.
 */
function fillStyle(accent: Accent): { background: string; boxShadow: string } {
  const hue = `var(--color-accent-${accent})`;
  const dim = `var(--color-accent-${accent}-dim)`;
  // Canon (app/training/page.tsx quest bars) paints a *completed* bar as flat
  // green at full glow strength, and every in-progress hue as a dim→bright
  // gradient at 60% glow. Keeping that distinction is what makes a finished
  // quest read as finished at a glance.
  if (accent === "green") {
    return { background: hue, boxShadow: `0 0 8px ${hue}` };
  }
  return {
    background: `linear-gradient(90deg, ${dim}, ${hue})`,
    boxShadow: `0 0 8px color-mix(in srgb, ${hue} 60%, transparent)`,
  };
}

/**
 * The canonical quest/progress bar: hairline track on the sunken surface with a
 * glowing gradient fill. Matches the quest bars in app/training/page.tsx.
 *
 * `label` is required in spirit — a bar with no accessible name is just a
 * decorative rectangle to a screen reader — but stays optional so a caller can
 * point at an adjacent visible label with `labelledBy` instead.
 */
export function ProgressBar({
  value,
  max = 100,
  accent = "blue",
  height = 8,
  label,
  labelledBy,
  className = "",
}: {
  value: number;
  max?: number;
  accent?: Accent;
  height?: number;
  label?: string;
  labelledBy?: string;
  className?: string;
}) {
  const pct = clampProgressPercent(value, max);
  return (
    <div
      className={`border border-line bg-void ${className}`}
      style={{ height }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      aria-labelledby={labelledBy}
    >
      <div
        className="h-full transition-all duration-500"
        style={{ width: `${pct}%`, ...fillStyle(accent) }}
      />
    </div>
  );
}


