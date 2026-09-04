"use client";

import type { ReactNode } from "react";
import { useHydrated } from "./useHydrated";

/**
 * Neutral client-side hydration gate.
 * Renders fallback (or null) on the server to prevent localStorage hydration mismatches.
 * Contains ZERO System-theme or domain styles.
 */
export function ClientGate({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const hydrated = useHydrated();
  if (!hydrated) {
    return (
      fallback ?? (
        <div style={{ display: "flex", height: "16rem", alignItems: "center", justifyContent: "center" }}>
          <p style={{ fontFamily: "monospace", fontSize: "0.75rem", letterSpacing: "0.2em", textTransform: "uppercase", opacity: 0.6 }}>
            [ Synchronizing State... ]
          </p>
        </div>
      )
    );
  }
  return <>{children}</>;
}
