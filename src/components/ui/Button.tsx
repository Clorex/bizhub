"use client";

import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      loading = false,
      leftIcon,
      rightIcon,
      children,
      className,
      disabled,
      type,
      ...rest
    },
    ref
  ) {
    const base =
      "inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] min-h-[44px]";

    const variants: Record<string, string> = {
      primary:
        "bg-gradient-to-r from-[#FF4D00] to-[#FF6A00] text-white hover:from-[#E64500] hover:to-[#E65E00] focus-visible:ring-orange-500 shadow-sm hover:shadow-md",
      secondary:
        "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 focus-visible:ring-gray-400",
      danger:
        "bg-red-500 text-white hover:bg-red-600 focus-visible:ring-red-500",
      ghost:
        "bg-transparent text-gray-600 hover:bg-gray-100 focus-visible:ring-gray-400",
    };

    const sizes: Record<string, string> = {
      sm: "px-3.5 py-2 text-[13px]",
      md: "px-5 py-2.5 text-sm",
      lg: "px-6 py-3 text-base",
    };

    return (
      <button
        ref={ref}
        type={type || "button"}
        className={cn(base, variants[variant], sizes[size], className)}
        disabled={disabled || loading}
        {...rest}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : leftIcon ? (
          <span className="shrink-0 -ml-0.5">{leftIcon}</span>
        ) : null}

        {children && <span className="truncate">{children}</span>}

        {!loading && rightIcon && (
          <span className="shrink-0 -mr-0.5">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
