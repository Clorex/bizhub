import React from "react";
import { cn } from "@/lib/cn";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "success" | "warning" | "danger" | "orange" | "apex" | "momentum" | "verified" | "hot";
  size?: "sm" | "md";
  className?: string;
  icon?: React.ReactNode;
}

const variantStyles: Record<string, string> = {
  default: "bg-gray-100 text-gray-600",
  success: "bg-emerald-50 text-emerald-700 border border-emerald-100",
  warning: "bg-amber-50 text-amber-700 border border-amber-100",
  danger: "bg-red-50 text-red-700 border border-red-100",
  orange: "bg-orange-50 text-orange-700 border border-orange-100",
  apex: "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm",
  momentum: "bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-sm",
  verified: "bg-emerald-500 text-white shadow-sm",
  hot: "bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-sm",
};

const sizeStyles: Record<string, string> = {
  sm: "px-2 py-0.5 text-[10px] gap-1",
  md: "px-2.5 py-1 text-xs gap-1.5",
};

export default function Badge({
  children,
  variant = "default",
  size = "sm",
  className = "",
  icon,
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
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  );
}
