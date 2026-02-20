// FILE: src/components/intent-radar/IntentProductCard.tsx
"use client";

import { cn } from "@/lib/cn";
import { IntentBadge } from "./IntentBadge";
import { ChevronRight, Users, Zap } from "lucide-react";
import type { IntentLevel } from "@/types/buyer-intent";

const cardBg: Record<IntentLevel, string> = {
  hot: "bg-red-50 border-red-200 hover:border-red-300",
  strong: "bg-orange-50 border-orange-200 hover:border-orange-300",
  warm: "bg-amber-50 border-amber-200 hover:border-amber-300",
};

export function IntentProductCard({
  product_name,
  flag_level,
  message,
  suggested_action,
  unique_interested,
  top_signals,
  onViewDetail,
}: {
  product_name: string;
  flag_level: IntentLevel;
  message: string;
  suggested_action: string;
  unique_interested: number;
  top_signals?: string[];
  onViewDetail?: () => void;
}) {
  return (
    <button
      onClick={onViewDetail}
      className={cn(
        "w-full text-left rounded-2xl border p-4 transition",
        cardBg[flag_level]
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <p className="text-sm font-bold text-gray-900 truncate">
              {product_name}
            </p>
            <IntentBadge level={flag_level} size="xs" />
          </div>

          <p className="text-xs text-gray-700 leading-relaxed">{message}</p>

          {/* Signals preview */}
          {top_signals && top_signals.length > 0 && (
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {top_signals.slice(0, 3).map((sig, i) => (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/70 text-[10px] font-bold text-gray-600 border border-gray-200"
                >
                  <Zap className="w-3 h-3" />
                  {sig}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3 mt-2.5">
            {unique_interested > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-gray-500">
                <Users className="w-3.5 h-3.5" />
                {unique_interested} interested buyer{unique_interested !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          <p className="text-[11px] text-gray-500 mt-2 italic">
            {suggested_action}
          </p>
        </div>

        <ChevronRight className="w-5 h-5 text-gray-400 shrink-0 mt-1" />
      </div>
    </button>
  );
}
