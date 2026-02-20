"use client";

import { memo } from "react";
import { cn } from "@/lib/cn";

interface QuickStatProps {
  icon: any;
  label: string;
  value: string;
  onClick: () => void;
  trend?: "up" | "down" | "neutral";
}

export const QuickStat = memo(function QuickStat({
  icon: Icon,
  label,
  value,
  onClick,
  trend,
}: QuickStatProps) {
  return (
    <button
      onClick={onClick}
      className="flex-1 bg-white/20 hover:bg-white/30 active:bg-white/40 rounded-xl p-3 text-left transition-all duration-150 active:scale-[0.97] min-h-[76px]"
    >
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-white/80" />
        {trend && (
          <span className={cn(
            "text-[10px] font-bold px-1.5 py-0.5 rounded",
            trend === "up" && "bg-green-400/30 text-green-100",
            trend === "down" && "bg-red-400/30 text-red-100",
            trend === "neutral" && "bg-white/20 text-white/70"
          )}>
            {trend === "up" ? "\u2191" : trend === "down" ? "\u2193" : "\u2014"}
          </span>
        )}
      </div>
      <p className="text-micro text-white/70 mt-1.5">{label}</p>
      <p className="text-base font-bold text-white mt-0.5">{value}</p>
    </button>
  );
});
