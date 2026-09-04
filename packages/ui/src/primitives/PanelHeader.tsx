import type { ReactNode } from "react";
import { accentGlow, accentText, type Accent } from "../tokens/accent";

/**
 * The bracketed system-readout header used by every canonical panel.
 * Mirrors the header block inside components/SystemPanel.tsx so that surfaces
 * which cannot use SystemPanel wholesale still get identical chrome.
 */
export function PanelHeader({
  title,
  accent = "blue",
  glow = false,
  trailing,
  className = "",
}: {
  title: string;
  accent?: Accent;
  glow?: boolean;
  trailing?: ReactNode;
  className?: string;
}) {
  const color = accentText(accent);
  return (
    <header className={`mb-4 flex items-center gap-2 ${className}`}>
      <span className={`${color} text-xs`}>◆</span>
      <h2
        className={`font-display text-[0.7rem] uppercase tracking-[0.25em] sm:text-xs ${color} ${
          glow ? accentGlow(accent) : ""
        }`}
      >
        {title}
      </h2>
      <span className="ml-2 h-px flex-1 bg-gradient-to-r from-line to-transparent" />
      {trailing}
    </header>
  );
}

