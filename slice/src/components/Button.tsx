import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "destructive" | "lemon";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  loadingLabel?: string;
  icon?: ReactNode;
}

const base =
  "inline-flex items-center justify-center gap-2 rounded-[var(--radius-control)] px-5 min-h-11 text-[14px] font-medium transition-transform duration-150 disabled:cursor-not-allowed disabled:opacity-60";

const variants: Record<Variant, string> = {
  primary:
    "bg-coral text-white shadow-[0_3px_0_var(--color-coral-dark)] enabled:hover:-translate-y-px enabled:active:translate-y-0 enabled:active:shadow-[0_1px_0_var(--color-coral-dark)]",
  secondary:
    "bg-paper text-ink border border-line-strong enabled:hover:-translate-y-px enabled:active:translate-y-0",
  destructive:
    "bg-lemon-2 text-lemon-ink enabled:hover:-translate-y-px enabled:active:translate-y-0",
  /** For use on the dark rail, where coral loses contrast. */
  lemon: "bg-lemon text-ink shadow-[0_3px_0_oklch(70%_0.15_98)] enabled:hover:-translate-y-px enabled:active:translate-y-0 enabled:active:shadow-[0_1px_0_oklch(70%_0.15_98)]",
};

export function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" width="16" height="16" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export default function Button({
  variant = "primary",
  loading = false,
  loadingLabel,
  icon,
  disabled,
  children,
  className = "",
  ...rest
}: Props) {
  return (
    <button
      className={`${base} ${variants[variant]} ${className}`}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <>
          <Spinner />
          <span>{loadingLabel ?? "Working"}</span>
        </>
      ) : (
        <>
          <span>{children}</span>
          {icon}
        </>
      )}
    </button>
  );
}
