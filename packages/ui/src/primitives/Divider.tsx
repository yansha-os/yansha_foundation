/**
 * The fading hairline rule from the canonical panel header, on its own.
 * Horizontal fades left-to-right into transparency; vertical is a flat hairline
 * used between inline readouts.
 */
export function Divider({
  orientation = "horizontal",
  className = "",
}: {
  orientation?: "horizontal" | "vertical";
  className?: string;
}) {
  if (orientation === "vertical") {
    return <span aria-hidden className={`inline-block w-px self-stretch bg-line ${className}`} />;
  }
  return (
    <span
      aria-hidden
      className={`block h-px w-full bg-gradient-to-r from-line to-transparent ${className}`}
    />
  );
}
