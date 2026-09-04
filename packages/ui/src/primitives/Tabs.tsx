"use client";

import type { ReactNode } from "react";
import { accentText, type Accent } from "../tokens/accent";

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

const ACTIVE_CLASS: Record<Accent, string> = {
  blue: "border-sysblue bg-sysblue/10",
  purple: "border-syspurple bg-syspurple/10",
  gold: "border-sysgold bg-sysgold/10",
  red: "border-sysred bg-sysred/10",
  green: "border-sysgreen bg-sysgreen/10",
};

/**
 * The mode selector that several surfaces hand-roll as a plain button row.
 * Uses the WAI-ARIA tablist pattern so the group is announced as tabs and
 * arrow-key roving works; the panel itself stays the caller's responsibility.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  accent = "blue",
  className = "",
  label = "Mode",
}: {
  items: ReadonlyArray<TabItem<T>>;
  value: T;
  onChange: (id: T) => void;
  accent?: Accent;
  className?: string;
  label?: string;
}) {
  const enabled = items.filter((item) => !item.disabled);

  const move = (delta: number) => {
    if (enabled.length === 0) return;
    const at = enabled.findIndex((item) => item.id === value);
    const next = enabled[(at + delta + enabled.length) % enabled.length];
    onChange(next.id);
  };

  return (
    <div role="tablist" aria-label={label} className={`flex flex-wrap gap-2 ${className}`}>
      {items.map((item) => {
        const active = item.id === value;
        return (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            disabled={item.disabled}
            onClick={() => onChange(item.id)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight" || event.key === "ArrowDown") {
                event.preventDefault();
                move(1);
              } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
                event.preventDefault();
                move(-1);
              }
            }}
            // solo-cut-sm (8px) is the canonical control chamfer, matching
            // .system-btn; the system chamfers and never rounds. Tracking is the
            // canonical 0.25em.
            className={`solo-cut-sm flex items-center gap-2 border px-3 py-1.5 font-display text-[0.62rem] uppercase tracking-[0.25em] transition disabled:opacity-40 ${
              active
                ? `${ACTIVE_CLASS[accent]} ${accentText(accent)}`
                : "border-line text-ghost hover:border-line hover:text-white"
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

