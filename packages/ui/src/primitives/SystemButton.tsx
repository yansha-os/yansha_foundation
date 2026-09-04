import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * The five `.system-btn*` variants defined in app/globals.css, as one typed
 * component. Geometry, glow, hover lift and the disabled treatment all come
 * from the stylesheet — this only picks a variant and a size, so a page can no
 * longer re-derive "a smaller primary button" with ad-hoc padding utilities.
 */
export type SystemButtonVariant = "primary" | "gold" | "outline" | "purple" | "red";
export type SystemButtonSize = "sm" | "md" | "lg";

const VARIANT_CLASS: Record<SystemButtonVariant, string> = {
  primary: "system-btn",
  gold: "system-btn system-btn-gold",
  outline: "system-btn system-btn-outline",
  purple: "system-btn system-btn-purple",
  red: "system-btn system-btn-red",
};

/** `md` is the stylesheet default, so it deliberately adds nothing. */
const SIZE_CLASS: Record<SystemButtonSize, string> = {
  sm: "px-3 py-1.5 text-[0.6rem]",
  md: "",
  lg: "px-6 py-3 text-[0.78rem]",
};

export function SystemButton({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  icon,
  className = "",
  children,
  ...rest
}: {
  variant?: SystemButtonVariant;
  size?: SystemButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  children?: ReactNode;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children">) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`${VARIANT_CLASS[variant]} ${SIZE_CLASS[size]} ${className}`}
    >
      {loading ? <span className="animate-spin-slow" aria-hidden>◇</span> : icon}
      {children}
    </button>
  );
}
