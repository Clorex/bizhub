// FILE: src/components/market/SmartMatchBadge.tsx
"use client";

import { memo } from "react";
import { Star, ThumbsUp, AlertTriangle } from "lucide-react";
import type { MatchLabel } from "@/lib/smartmatch/types";
import { labelToDisplayText, labelToColorClasses } from "@/lib/smartmatch/config";
import { cn } from "@/lib/cn";

interface SmartMatchBadgeProps {
  label: MatchLabel;
  reason?: string;
  /** Compact mode: just the badge, no reason text */
  compact?: boolean;
  className?: string;
}

const LABEL_ICONS: Record<MatchLabel, any> = {
  best_match: Star,
  recommended: ThumbsUp,
  fair_match: AlertTriangle,
  low_match: null,
};

export const SmartMatchBadge = memo(function SmartMatchBadge({
  label,
  reason,
  compact = false,
  className,
}: SmartMatchBadgeProps) {
  const text = labelToDisplayText(label);
  const colors = labelToColorClasses(label);
  const Icon = LABEL_ICONS[label];

  // Don't show badge for low_match
  if (label === "low_match" || !text) return null;

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <div
        className={cn(
          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border w-fit",
          colors.bg,
          colors.text,
          colors.border
        )}
      >
        {Icon ? <Icon className="h-3 w-3" /> : null}
        <span>{text}</span>
      </div>

      {!compact && reason ? (
        <p className="text-[10px] text-gray-500 leading-tight line-clamp-1 mt-0.5">
          {reason}
        </p>
      ) : null}
    </div>
  );
});