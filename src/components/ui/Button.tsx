// FILE: src/components/ui/Button.tsx
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "soft" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

export function Button({
  variant = "primary",
  size = "md",
  loading,
  leftIcon,
  className,
  children,
  disabled,
  type,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
}) {
  const base =
    "inline-flex w-full items-center justify-center gap-2 font-bold transition active:scale-[0.99] disabled:opacity-50 disabled:active:scale-100";

  const sizes =
    size === "sm"
      ? "rounded-2xl px-4 py-2 text-xs"
      : size === "lg"
        ? "rounded-2xl px-5 py-3.5 text-sm"
        : "rounded-2xl px-5 py-3 text-sm";

  const styles =
    variant === "primary"
      ? "text-white bg-gradient-to-br from-biz-accent2 to-biz-accent shadow-float"
      : variant === "secondary"
        ? "bg-white border border-biz-line text-biz-ink shadow-soft"
        : variant === "soft"
          ? "bg-biz-cream text-biz-ink border border-transparent shadow-soft"
          : variant === "danger"
            ? "bg-red-600 text-white shadow-float"
            : "bg-transparent text-biz-ink border border-transparent";

  return (
    <button
      type={type || "button"}
      className={cn(base, sizes, styles, className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <span
          className="h-4 w-4 rounded-full border-2 border-current/40 border-t-current animate-spin"
          aria-label="loading"
        />
      ) : leftIcon ? (
        <span className="shrink-0">{leftIcon}</span>
      ) : null}

      <span>{children}</span>
    </button>
  );
}