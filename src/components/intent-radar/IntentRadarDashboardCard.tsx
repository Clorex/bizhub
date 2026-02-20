// FILE: src/components/intent-radar/IntentRadarDashboardCard.tsx
"use client";

import { useRouter } from "next/navigation";
import { useIntentRadar } from "@/hooks/use-intent-radar";
import { IntentBadge } from "./IntentBadge";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  Flame,
  TrendingUp,
  ChevronRight,
  Radar,
  Zap,
} from "lucide-react";

/**
 * Buyer Intent Radar card for the vendor dashboard.
 * Only renders for Apex vendors. Shows upsell for non-Apex.
 */
export function IntentRadarDashboardCard() {
  const router = useRouter();
  const { data, isLoading, error, isApexRequired, upsell } = useIntentRadar();

  // Non-Apex upsell
  if (isApexRequired) {
    return (
      <Card className="p-5 bg-gradient-to-br from-red-50 to-orange-50 border-red-100">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shrink-0">
            <Radar className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-900">
              {upsell?.title || "Buyer Intent Radar"}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {upsell?.description || "Detect when buyers are ready to purchase your products."}
            </p>
            <p className="text-[10px] font-bold text-red-600 mt-2 uppercase tracking-wide">
              Apex Advantage
            </p>
            <Button
              size="sm"
              className="mt-3"
              onClick={() => router.push("/vendor/subscription")}
              rightIcon={<ChevronRight className="w-4 h-4" />}
            >
              {upsell?.cta || "Upgrade to Apex"}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  // Loading
  if (isLoading) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="w-10 h-10 rounded-xl" />
          <div className="flex-1">
            <Skeleton className="h-4 w-36 mb-2" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-16 w-full rounded-xl" />
      </Card>
    );
  }

  if (error || !data) return null;

  const totalFlags = data.total_hot_flags + data.total_strong_flags;

  // No signals
  if (totalFlags === 0) {
    return (
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
            <Radar className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-900">Buyer Intent Radar</p>
            <p className="text-xs text-gray-500 mt-1">
              No strong buyer signals detected right now. We are watching.
            </p>
          </div>
          <button
            onClick={() => router.push("/vendor/intent-radar")}
            className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 shrink-0"
          >
            View
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </Card>
    );
  }

  // Active signals
  const allProducts = [...data.hot_products, ...data.strong_products];
  const preview = allProducts.slice(0, 2);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
            <Flame className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">Hot Buyer Interest</p>
            <p className="text-xs text-gray-500 mt-0.5">
              {totalFlags} product{totalFlags !== 1 ? "s" : ""} with strong buyer signals
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push("/vendor/intent-radar")}
          className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 shrink-0"
        >
          View all
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Category pills */}
      <div className="flex items-center gap-2 mb-4">
        {data.total_hot_flags > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-[11px] font-bold border border-red-200">
            <Flame className="w-3.5 h-3.5" />
            {data.total_hot_flags} Hot
          </span>
        )}
        {data.total_strong_flags > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 text-[11px] font-bold border border-orange-200">
            <TrendingUp className="w-3.5 h-3.5" />
            {data.total_strong_flags} Strong
          </span>
        )}
      </div>

      {/* Preview */}
      <div className="space-y-2">
        {preview.map((item) => (
          <button
            key={item.product_id}
            onClick={() => router.push(`/vendor/intent-radar?product=${item.product_id}`)}
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition text-left"
          >
            <IntentBadge level={item.flag_level} size="xs" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-900 truncate">{item.product_name}</p>
              <p className="text-[11px] text-gray-500 truncate mt-0.5">{item.message}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
          </button>
        ))}
      </div>

      {allProducts.length > 2 && (
        <button
          onClick={() => router.push("/vendor/intent-radar")}
          className="w-full mt-3 py-2.5 rounded-xl bg-red-500 text-white text-sm font-bold hover:bg-red-600 transition"
        >
          View All {totalFlags} Signals
        </button>
      )}
    </Card>
  );
}
