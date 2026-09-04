import type { ReactNode } from "react";

/**
 * The canonical "nothing logged yet" register: quiet italic ghost text, never
 * an illustration. Matches the training/health history panels.
 */
export function EmptyState({
  title,
  body,
  action,
  className = "",
}: {
  title?: string;
  body: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`py-4 text-center ${className}`}>
      {title && (
        <p className="font-display text-[0.65rem] uppercase tracking-[0.25em] text-text-faint">{title}</p>
      )}
      {/* text-faint at full opacity. The canonical source fades ghost to 60%
          here, which measures 3.4:1 on surface-raised and fails AA — see
          lib/__tests__/contrast.test.ts and design-system.md §5.2. */}
      <p className="mt-1 text-sm italic text-text-faint">{body}</p>
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}
