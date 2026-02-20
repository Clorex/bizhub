// FILE: src/components/intent-radar/IntentBadge.tsx
"use client";

import { cn } from "@/lib/cn";
import type { IntentLevel } from "@/types/buyer-intent";
import { Flame, TrendingUp, Thermometer } from "lucide-react";

const styles: Record<IntentLevel, string> = {
  hot: "bg-red-100 text-red-700 border-red-200",
  strong: "bg-orange-100 text-orange-700 border-orange-200",
  warm: "bg-amber-100 text-amber-700 border-amber-200",
};

const icons: Record<IntentLevel, typeof Flame> = {
  hot: Flame,
  strong: TrendingUp,
  warm: Thermometer,
};

const labels: Record<IntentLevel, string> = {
  hot: "Hot Deal",
  strong: "Strong Interest",
  warm: "Warm Interest",
};

export function IntentBadge({
  level,
  size = "sm",
}: {
  level: IntentLevel;
  size?: "xs" | "sm" | "md";
}) {
  const Icon = icons[level];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-bold",
        styles[level],
        size === "xs" ? "px-2 py-0.5 text-[10px]" : size === "md" ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-xs"
      )}
    >
      <Icon className={cn(size === "xs" ? "w-3 h-3" : size === "md" ? "w-4.5 h-4.5" : "w-3.5 h-3.5")} />
      {labels[level]}
    </span>
  );
}
