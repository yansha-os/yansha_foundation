"use client";

import { useCallback, useEffect, useId, useMemo, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { isDismissKey, tabbablesWithin, TRAP_CONTAINER, trapTabTarget } from "../a11y/focus-trap";
import { createModalId, isTopmostModal, lockBodyScroll, registerModal } from "../a11y/modal-stack";
import { accentText, type Accent } from "../tokens/accent";

const PANEL_VARIANT: Record<Accent, string> = {
  blue: "",
  purple: "system-panel-purple",
  red: "system-panel-red",
  gold: "border-sysgold/40 shadow-[0_0_15px_rgba(212,175,55,0.15)]",
  green: "border-sysgreen/40 shadow-[0_0_15px_rgba(52,211,153,0.15)]",
};

const SIZE_CLASS = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
} as const;

/**
 * The shared System dialog. Before this existed every dialog in the app hand
 * rolled its own backdrop, panel and close button, and none of them trapped
 * focus, handled Escape or announced themselves to a screen reader.
 *
 * Chrome is the canonical `.system-panel .solo-cut` treatment, so a migrated
 * dialog inherits the Workout look rather than restating it.
 */
export function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  eyebrow,
  accent = "blue",
  size = "md",
  closeOnBackdrop = true,
  footer,
  className = "",
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  accent?: Accent;
  size?: keyof typeof SIZE_CLASS;
  closeOnBackdrop?: boolean;
  footer?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreFocusTo = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const modalId = useMemo(() => createModalId(), []);

  const focusables = useCallback((): HTMLElement[] => {
    const root = panelRef.current;
    if (!root) return [];
    return tabbablesWithin(root);
  }, []);

  // Join the shared dialog stack so only the topmost dialog answers keys.
  useEffect(() => {
    if (!isOpen) return;
    return registerModal({ id: modalId, panel: () => panelRef.current });
  }, [isOpen, modalId]);

  // Body scroll lock. Counted, so closing a nested dialog does not unlock the
  // page while its parent is still open.
  useEffect(() => {
    if (!isOpen) return;
    return lockBodyScroll();
  }, [isOpen]);

  // Move focus in on open, and put it back where it came from on close.
  useEffect(() => {
    if (!isOpen) return;
    restoreFocusTo.current = document.activeElement as HTMLElement | null;
    const first = focusables()[0];
    (first ?? panelRef.current)?.focus();
    return () => restoreFocusTo.current?.focus?.();
  }, [isOpen, focusables]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      // A dialog behind this one must not steal Escape or Tab from it.
      if (!isTopmostModal(modalId)) return;
      if (isDismissKey(event.key)) {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const elements = focusables();
      const target = trapTabTarget(
        elements.indexOf(document.activeElement as HTMLElement),
        elements.length,
        event.shiftKey
      );
      // Unconditional: Tab never reaches the page behind the dialog, even when
      // the dialog has nothing focusable in it.
      event.preventDefault();
      if (target === TRAP_CONTAINER) panelRef.current?.focus();
      else elements[target].focus();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [isOpen, onClose, focusables, modalId]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[var(--z-modal)] flex animate-fade items-center justify-center bg-abyss/88 p-4 backdrop-blur-md"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className={`system-panel solo-cut max-h-[90vh] w-full overflow-y-auto p-5 sm:p-6 ${PANEL_VARIANT[accent]} ${SIZE_CLASS[size]} ${className}`}
      >
        <header className="mb-5 flex items-start justify-between gap-4 border-b border-line pb-4">
          <div className="min-w-0">
            {eyebrow && (
              <p className={`font-display text-[0.62rem] uppercase tracking-[0.22em] ${accentText(accent)}`}>
                {eyebrow}
              </p>
            )}
            <h2
              id={titleId}
              className="mt-1 font-display text-base font-bold uppercase tracking-[0.18em] text-white"
            >
              {title}
            </h2>
            {subtitle && <p className="mt-1 text-xs text-text-faint">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="shrink-0 border border-line p-2 text-ghost transition hover:border-sysred hover:text-sysred"
          >
            <X size={18} />
          </button>
        </header>

        {children}

        {footer && <footer className="mt-5 border-t border-line pt-4">{footer}</footer>}
      </div>
    </div>
  );
}

