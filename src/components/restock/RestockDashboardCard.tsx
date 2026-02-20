// FILE: src/components/restock/RestockDashboardCard.tsx
"use client";

import { useRouter } from "next/navigation";
import { useRestockDashboard } from "@/hooks/use-restock-dashboard";
import { SeverityBadge } from "./SeverityBadge";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import {
  ShieldAlert,
  TrendingUp,
  Eye,
  ChevronRight,
  Zap,
  BarChart3,
  Loader2,
} from "lucide-react";

/**
 * Smart Restock & Demand Alerts card for the vendor dashboard.
 * Only renders for Apex vendors. Shows upsell for non-Apex.
 */
export function RestockDashboardCard() {
  const router = useRouter();
  const { data, isLoading, error, isApexRequired, upsell } =
    useRestockDashboard();

  // Non-Apex: show upsell card
  if (isApexRequired) {
    return (
      <Card className="p-5 bg-gradient-to-br from-purple-50 to-orange-50 border-purple-100">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-orange-500 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-900">
              {upsell?.title || "Smart Restock & Demand Alerts"}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              {upsell?.description ||
                "Get intelligent stock predictions, demand spike detection, and conversion insights."}
            </p>
            <p className="text-[10px] font-bold text-purple-600 mt-2 uppercase tracking-wide">
              Apex Feature
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
            <Skeleton className="h-4 w-40 mb-2" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
        <Skeleton className="h-16 w-full rounded-xl" />
      </Card>
    );
  }

  // Error or no data
  if (error || !data) return null;

  // No active flags — everything is fine
  if (data.total_active_flags === 0) {
    return (
      <Card className="p-5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-gray-900">
              Smart Product Insights
            </p>
            <p className="text-xs text-gray-500 mt-1">
              All products are looking healthy. No alerts right now.
            </p>
          </div>
          <button
            onClick={() => router.push("/vendor/restock")}
            className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 shrink-0"
          >
            View all
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </Card>
    );
  }

  // Active flags — show summary
  const riskCount = data.risk_products.length;
  const risingCount = data.rising_demand_products.length;
  const attentionCount = data.needs_attention_products.length;

  // Get the top 2 most urgent items to preview
  const allItems = [
    ...data.risk_products,
    ...data.rising_demand_products,
    ...data.needs_attention_products,
  ];
  const previewItems = allItems.slice(0, 2);

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-900">
              Smart Product Insights
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {data.total_active_flags} alert
              {data.total_active_flags !== 1 ? "s" : ""} need attention
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push("/vendor/restock")}
          className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1 shrink-0"
        >
          View all
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Category pills */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        {riskCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-100 text-red-700 text-[11px] font-bold border border-red-200">
            <ShieldAlert className="w-3.5 h-3.5" />
            {riskCount} Low Stock
          </span>
        )}
        {risingCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold border border-amber-200">
            <TrendingUp className="w-3.5 h-3.5" />
            {risingCount} Rising
          </span>
        )}
        {attentionCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-[11px] font-bold border border-blue-200">
            <Eye className="w-3.5 h-3.5" />
            {attentionCount} Attention
          </span>
        )}
      </div>

      {/* Preview items */}
      <div className="space-y-2">
        {previewItems.map((item) => (
          <button
            key={item.product_id}
            onClick={() =>
              router.push(`/vendor/restock?product=${item.product_id}`)
            }
            className="w-full flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 transition text-left"
          >
            <SeverityBadge severity={item.top_severity} size="xs" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-gray-900 truncate">
                {item.product_name}
              </p>
              <p className="text-[11px] text-gray-500 truncate mt-0.5">
                {item.top_message}
              </p>
            </div>
            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
          </button>
        ))}
      </div>

      {allItems.length > 2 && (
        <button
          onClick={() => router.push("/vendor/restock")}
          className="w-full mt-3 py-2.5 rounded-xl bg-orange-500 text-white text-sm font-bold hover:bg-orange-600 transition"
        >
          View All {data.total_active_flags} Alerts
        </button>
      )}
    </Card>
  );
}
