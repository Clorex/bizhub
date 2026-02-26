import React from "react";
import { cn } from "@/lib/cn";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info" | "neutral" | "brand" | "apex" | "momentum" | "verified" | "hot";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: "sm" | "md";
  className?: string;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-surface-tertiary text-ink-light",
  success: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  warning: "bg-amber-50 text-amber-700 border border-amber-100",
  error: "bg-red-50 text-red-700 border border-red-100",
  info: "bg-blue-50 text-blue-700 border border-blue-100",
  neutral: "bg-gray-100 text-gray-600",
  brand: "bg-brand-light text-brand-dark border border-brand/20",
  apex: "bg-gradient-to-r from-brand to-brand-dark text-white shadow-glow",
  momentum: "bg-gradient-to-r from-amber-400 to-orange-500 text-white shadow-sm",
  verified: "bg-emerald-500 text-white shadow-sm",
  hot: "bg-gradient-to-r from-red-500 to-brand text-white shadow-sm",
};

const sizeStyles: Record<string, string> = {
  sm: "px-2 py-0.5 text-micro gap-1",
  md: "px-2.5 py-1 text-caption gap-1.5",
};

export default function Badge({
  children,
  variant = "default",
  size = "sm",
  className = "",
  dot,
}: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center font-semibold rounded-full whitespace-nowrap",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
    >
      {dot && <span className={cn("w-1.5 h-1.5 rounded-full bg-current", size === "md" && "w-2 h-2")} />}
      {children}
    </span>
  );
}
