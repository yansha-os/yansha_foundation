/**
 * Loading placeholder matching the AppShell rank-badge skeleton treatment:
 * hairline border, panel fill, slow pulse. Cut corners, never rounded pills.
 */
export function SkeletonLoader({
  lines = 3,
  className = "",
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`} aria-busy="true" aria-live="polite">
      {Array.from({ length: lines }, (_, i) => (
        <div
          key={i}
          className="solo-cut-sm h-3 animate-pulse border border-line bg-panel/50"
          style={{ width: `${100 - i * 12}%` }}
        />
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}
