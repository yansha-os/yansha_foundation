import type { ReactNode } from "react";
import { type Accent } from "../tokens/accent";

const ACTIVE_CLASS: Record<Accent, string> = {
  blue: "border-sysblue text-sysblue",
  purple: "border-syspurple text-syspurple",
  gold: "border-sysgold text-sysgold",
  red: "border-sysred text-sysred",
  green: "border-sysgreen text-sysgreen",
};

/**
 * The filter toggle from the reference module (app/training/page.tsx category
 * row): a hairline box that swaps to the accent hue when selected. Selection is
 * announced through aria-pressed, because the colour swap alone is decorative.
 */
export function Chip({
  active = false,
  accent = "blue",
  onClick,
  disabled,
  className = "",
  children,
}: {
  active?: boolean;
  accent?: Accent;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      // solo-cut-sm (8px) is the canonical control chamfer — the same cut
      // .system-btn uses. The 14px .solo-cut is panel geometry and would eat a
      // chip this short. Tracking is the canonical 0.25em micro-label value.
      className={`solo-cut-sm border px-2 py-1 text-[0.6rem] uppercase tracking-[0.25em] transition disabled:opacity-40 ${
        active ? ACTIVE_CLASS[accent] : "border-line text-ghost"
      } ${className}`}
    >
      {children}
    </button>
  );
}

