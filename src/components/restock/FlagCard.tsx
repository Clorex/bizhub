// FILE: src/components/restock/FlagCard.tsx
"use client";

import { cn } from "@/lib/cn";
import { SeverityBadge } from "./SeverityBadge";
import {
  Package,
  TrendingUp,
  AlertTriangle,
  Eye,
  Sparkles,
  X,
  ChevronRight,
} from "lucide-react";
import type { RestockFlagType, RestockSeverity } from "@/types/restock";

const flagIcons: Record<RestockFlagType, typeof Package> = {
  stockout_warning: Package,
  stockout_urgent: AlertTriangle,
  demand_rising: TrendingUp,
  demand_spike: TrendingUp,
  conversion_warning: Eye,
  opportunity_trending: Sparkles,
  no_stock_high_demand: Package,
};

const cardBg: Record<RestockSeverity, string> = {
  urgent: "bg-red-50 border-red-200",
  high: "bg-orange-50 border-orange-200",
  warning: "bg-amber-50 border-amber-200",
  info: "bg-blue-50 border-blue-200",
};

export function FlagCard({
  flag_type,
  severity,
  message,
  product_name,
  onDismiss,
  onViewInsight,
}: {
  flag_type: RestockFlagType;
  severity: RestockSeverity;
  message: string;
  product_name: string;
  onDismiss?: () => void;
  onViewInsight?: () => void;
}) {
  const Icon = flagIcons[flag_type] || AlertTriangle;

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 transition relative",
        cardBg[severity] || cardBg.info
      )}
    >
      {onDismiss && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/80 hover:bg-white flex items-center justify-center transition"
          aria-label="Dismiss alert"
        >
          <X className="w-3.5 h-3.5 text-gray-500" />
        </button>
      )}

      <div className="flex items-start gap-3 pr-6">
        <div className="mt-0.5 shrink-0">
          <Icon className={cn("w-5 h-5", severity === "urgent" ? "text-red-500" : severity === "high" ? "text-orange-500" : severity === "warning" ? "text-amber-500" : "text-blue-500")} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-sm font-bold text-gray-900 truncate">
              {product_name}
            </p>
            <SeverityBadge severity={severity} size="xs" />
          </div>
          <p className="text-xs text-gray-700 leading-relaxed">{message}</p>

          {onViewInsight && (
            <button
              onClick={onViewInsight}
              className="mt-2.5 inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700 transition"
            >
              View insight
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
