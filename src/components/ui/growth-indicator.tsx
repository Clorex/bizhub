import React from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { formatPercentage } from "@/utils/analytics/format-percentage";

interface GrowthIndicatorProps {
  value: number;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  className?: string;
}

export default function GrowthIndicator({
  value,
  size = "md",
  showIcon = true,
  className = "",
}: GrowthIndicatorProps) {
  const isPositive = value > 0;
  const isNegative = value < 0;

  const colorClass = isPositive ? "text-emerald-600" : isNegative ? "text-red-600" : "text-gray-400";
  const bgClass = isPositive ? "bg-emerald-50" : isNegative ? "bg-red-50" : "bg-gray-50";

  const sizeStyles = {
    sm: "text-micro px-1.5 py-0.5",
    md: "text-caption px-2 py-1",
    lg: "text-body px-3 py-1.5",
  };

  const IconComp = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

  return (
    <span className={`inline-flex items-center gap-1 font-semibold rounded-full ${colorClass} ${bgClass} ${sizeStyles[size]} ${className}`}>
      {showIcon && <IconComp className="w-3 h-3" />}
      {formatPercentage(value)}
    </span>
  );
}

export function GrowthLarge({ value, className = "" }: { value: number; className?: string }) {
  const colorClass = value > 0 ? "text-emerald-600" : value < 0 ? "text-red-600" : "text-gray-400";
  const sign = value > 0 ? "+" : "";

  return (
    <span className={`text-4xl font-extrabold tracking-tight ${colorClass} ${className}`}>
      {sign}{Math.round(value)}%
    </span>
  );
}
