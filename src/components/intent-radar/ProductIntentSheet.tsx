// FILE: src/components/intent-radar/ProductIntentSheet.tsx
"use client";

import { useProductIntentDetail } from "@/hooks/use-product-intent-detail";
import { IntentBadge } from "./IntentBadge";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import {
  X,
  Flame,
  Eye,
  ShoppingCart,
  Heart,
  MessageCircle,
  CreditCard,
  RotateCcw,
  Clock,
  Users,
  Zap,
  Lightbulb,
} from "lucide-react";

function StatBox({
  label,
  value,
  icon: Icon,
  color = "gray",
}: {
  label: string;
  value: string | number;
  icon: typeof Eye;
  color?: "gray" | "red" | "orange" | "green";
}) {
  const iconColors = {
    gray: "text-gray-400",
    red: "text-red-500",
    orange: "text-orange-500",
    green: "text-green-500",
  };

  return (
    <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn("w-4 h-4", iconColors[color])} />
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-lg font-black text-gray-900">{value}</p>
    </div>
  );
}

export function ProductIntentSheet({
  productId,
  onClose,
}: {
  productId: string;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useProductIntentDetail(productId);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-[430px] mx-auto bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Buyer Intent Detail</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition"
              aria-label="Close"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-5">
          {isLoading && (
            <div className="space-y-4">
              <Skeleton className="h-6 w-48" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
              </div>
              <Skeleton className="h-20 rounded-xl" />
            </div>
          )}

          {error && (
            <div className="text-center py-8">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {data && (
            <>
              {/* Product name + level */}
              <div>
                <h3 className="text-base font-bold text-gray-900">{data.product_name}</h3>
                {data.flag_level && (
                  <div className="mt-2">
                    <IntentBadge level={data.flag_level} size="md" />
                  </div>
                )}
              </div>

              {/* Key stats */}
              <div className="grid grid-cols-2 gap-3">
                <StatBox
                  icon={Zap}
                  label="Intent Score"
                  value={data.intent_score_total}
                  color={data.intent_score_total >= 100 ? "red" : data.intent_score_total >= 70 ? "orange" : "gray"}
                />
                <StatBox
                  icon={Users}
                  label="Unique Buyers"
                  value={data.unique_users}
                  color="green"
                />
                <StatBox
                  icon={Flame}
                  label="Hot Interest"
                  value={data.hot_count}
                  color="red"
                />
                <StatBox
                  icon={Eye}
                  label="Strong Interest"
                  value={data.strong_count}
                  color="orange"
                />
              </div>

              {/* Suggested action */}
              {data.suggested_action && (
                <div className="p-4 rounded-xl bg-orange-50 border border-orange-200">
                  <div className="flex items-start gap-3">
                    <Lightbulb className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-orange-800 mb-1">Suggested Action</p>
                      <p className="text-xs text-orange-700 leading-relaxed">{data.suggested_action}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Signal breakdown */}
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                  48-Hour Signal Breakdown
                </p>
                <div className="space-y-2">
                  <SignalRow icon={Eye} label="Product Views" value={data.signal_breakdown.views} />
                  <SignalRow icon={RotateCcw} label="Repeat Viewers" value={data.signal_breakdown.repeat_views} />
                  <SignalRow icon={Clock} label="Time Spent" value={`${data.signal_breakdown.time_minutes} min`} />
                  <SignalRow icon={ShoppingCart} label="Cart Adds" value={data.signal_breakdown.add_to_carts} highlight={data.signal_breakdown.add_to_carts > 0} />
                  <SignalRow icon={Heart} label="Saves / Favorites" value={data.signal_breakdown.saves} highlight={data.signal_breakdown.saves > 0} />
                  <SignalRow icon={MessageCircle} label="Contact Clicks" value={data.signal_breakdown.contact_clicks} highlight={data.signal_breakdown.contact_clicks > 0} />
                  <SignalRow icon={CreditCard} label="Checkout Starts" value={data.signal_breakdown.checkout_starts} highlight={data.signal_breakdown.checkout_starts > 0} />
                </div>
              </div>

              {/* Privacy notice */}
              <div className="p-3 rounded-xl bg-gray-50 border border-gray-200">
                <p className="text-[11px] text-gray-500 leading-relaxed">
                  <span className="font-bold">Privacy-safe:</span> Buyer identities are never exposed. All signals are anonymous and aggregated.
                </p>
              </div>
            </>
          )}
        </div>

        <div className="h-8" />
      </div>
    </div>
  );
}

function SignalRow({
  icon: Icon,
  label,
  value,
  highlight = false,
}: {
  icon: typeof Eye;
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className={cn(
      "flex items-center justify-between p-3 rounded-xl border",
      highlight ? "bg-orange-50 border-orange-200" : "bg-white border-gray-100"
    )}>
      <div className="flex items-center gap-2.5">
        <Icon className={cn("w-4 h-4", highlight ? "text-orange-500" : "text-gray-400")} />
        <span className="text-sm text-gray-700">{label}</span>
      </div>
      <span className={cn("text-sm font-bold", highlight ? "text-orange-700" : "text-gray-900")}>
        {value}
      </span>
    </div>
  );
}
