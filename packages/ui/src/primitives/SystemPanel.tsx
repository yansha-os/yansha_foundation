import type { ReactNode } from "react";

type Variant = "blue" | "purple" | "red" | "gold";

export function SystemPanel({
  title,
  variant = "blue",
  corners = false,
  className = "",
  children,
}: {
  title?: string;
  variant?: Variant;
  corners?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const variantClass =
    variant === "purple"
      ? "system-panel-purple"
      : variant === "red"
        ? "system-panel-red"
        : variant === "gold"
          ? "border-sysgold/40 shadow-[0_0_15px_rgba(212,175,55,0.15)]"
          : "";
  const titleColor =
    variant === "purple"
      ? "text-syspurple"
      : variant === "red"
        ? "text-sysred"
        : variant === "gold"
          ? "text-sysgold glow-gold"
          : "text-sysblue";
  return (
    <section
      className={`system-panel solo-cut ${variantClass} ${corners ? "system-corners" : ""} p-4 sm:p-5 ${className}`}
    >
      {title && (
        <header className="mb-4 flex items-center gap-2">
          <span className={`${titleColor} text-xs`}>◆</span>
          <h2 className={`font-display text-[0.7rem] sm:text-xs uppercase tracking-[0.25em] ${titleColor}`}>
            {title}
          </h2>
          <span className="ml-2 h-px flex-1 bg-gradient-to-r from-line to-transparent" />
        </header>
      )}
      {children}
    </section>
  );
}
