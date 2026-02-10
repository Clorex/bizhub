// FILE: src/components/vendor/StatCard.tsx
"use client";

import { memo } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

type StatColor = "orange" | "green" | "blue" | "purple" | "red" | "gray";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: any;
  color?: StatColor;
  subtitle?: string;
  onClick?: () => void;
  trend?: {
    value: string;
    direction: "up" | "down" | "neutral";
  };
}

const COLOR_MAP: Record<StatColor, { bg: string; icon: string; trend: string }> = {
  orange: {
    bg: "bg-orange-50",
    icon: "text-orange-600",
    trend: "text-orange-600",
  },
  green: {
    bg: "bg-green-50",
    icon: "text-green-600",
    trend: "text-green-600",
  },
  blue: {
    bg: "bg-blue-50",
    icon: "text-blue-600",
    trend: "text-blue-600",
  },
  purple: {
    bg: "bg-purple-50",
    icon: "text-purple-600",
    trend: "text-purple-600",
  },
  red: {
    bg: "bg-red-50",
    icon: "text-red-600",
    trend: "text-red-600",
  },
  gray: {
    bg: "bg-gray-100",
    icon: "text-gray-600",
    trend: "text-gray-600",
  },
};

export const StatCard = memo(function StatCard({
  label,
  value,
  icon: Icon,
  color = "orange",
  subtitle,
  onClick,
  trend,
}: StatCardProps) {
  const colors = COLOR_MAP[color];
  const Component = onClick ? "button" : "div";

  return (
    <Component
      onClick={onClick}
      className={cn(
        "bg-white rounded-2xl border border-gray-100 p-4 text-left w-full",
        onClick && "hover:border-orange-200 hover:shadow-sm cursor-pointer transition group"
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", colors.bg)}>
          <Icon className={cn("w-5 h-5", colors.icon)} />
        </div>
        {onClick && (
          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-400 transition" />
        )}
      </div>

      <div className="mt-3">
        <p className="text-2xl font-black text-gray-900 tracking-tight">{value}</p>
        <p className="text-[11px] font-medium text-gray-500 mt-1 uppercase tracking-wide">
          {label}
        </p>
        {subtitle && (
          <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>
        )}
        {trend && (
          <p
            className={cn(
              "text-[11px] font-bold mt-1.5",
              trend.direction === "up" && "text-green-600",
              trend.direction === "down" && "text-red-600",
              trend.direction === "neutral" && "text-gray-500"
            )}
          >
            {trend.direction === "up" && "↑ "}
            {trend.direction === "down" && "↓ "}
            {trend.value}
          </p>
        )}
      </div>
    </Component>
  );
});