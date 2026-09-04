import { Fragment, type ReactNode } from "react";

/**
 * The pipe-separated metadata line under a list row — canonically
 * "Mar 4, 2026 | STRENGTH | 3×10 | 45 min" (app/training/page.tsx history rows).
 *
 * Nullish and empty items are dropped before the separators are interleaved, so
 * a row with no duration never renders a dangling "|".
 */
export function MetaRow({
  items,
  className = "",
}: {
  items: Array<ReactNode | null | undefined | false>;
  className?: string;
}) {
  const parts = items.filter((item) => item !== null && item !== undefined && item !== false && item !== "");
  if (parts.length === 0) return null;
  return (
    <p className={`text-xs text-ghost ${className}`}>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {i > 0 && (
            <span className="mx-1.5 text-line" aria-hidden>
              |
            </span>
          )}
          {part}
        </Fragment>
      ))}
    </p>
  );
}
