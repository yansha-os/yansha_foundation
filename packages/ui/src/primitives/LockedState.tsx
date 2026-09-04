import { Lock } from "lucide-react";
import type { ReactNode } from "react";
import { StatusPill } from "./StatusPill";

/**
 * Gated surface treatment for a feature that has not been unlocked yet.
 * Always states the unlock condition; never hides it behind a bare padlock.
 */
export function LockedState({
  label = "Access Sealed",
  requirement,
  action,
  className = "",
}: {
  label?: string;
  requirement: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center gap-2 py-6 text-center ${className}`}>
      <Lock size={18} className="text-sysred" aria-hidden />
      <StatusPill tone="red">{label}</StatusPill>
      <p className="max-w-sm text-sm text-text-faint">{requirement}</p>
      {action}
    </div>
  );
}
