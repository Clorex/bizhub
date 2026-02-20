// FILE: src/components/restock/ProductInsightSheet.tsx
"use client";

import { useProductInsight } from "@/hooks/use-product-insight";
import { SeverityBadge } from "./SeverityBadge";
import { FlagCard } from "./FlagCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import {
  X,
  TrendingUp,
  TrendingDown,
  Minus,
  Package,
  BarChart3,
  ShoppingCart,
  Eye,
  Loader2,
} from "lucide-react";
import type { RestockSeverity } from "@/types/restock";

function TrendArrow({ trend }: { trend: "rising" | "falling" | "stable" }) {
  if (trend === "rising") return <TrendingUp className="w-4 h-4 text-green-500" />;
  if (trend === "falling") return <TrendingDown className="w-4 h-4 text-red-500" />;
  return <Minus className="w-4 h-4 text-gray-400" />;
}

function StatBox({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: typeof Package;
}) {
  return (
    <div className="p-3 rounded-xl bg-gray-50 border border-gray-100">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-4 h-4 text-gray-400" />
        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
          {label}
        </span>
      </div>
      <p className="text-lg font-black text-gray-900">{value}</p>
      {sub && <p className="text-[11px] text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export function ProductInsightSheet({
  productId,
  onClose,
  onDismissFlag,
}: {
  productId: string;
  onClose: () => void;
  onDismissFlag?: (flagId: string) => void;
}) {
  const { data, isLoading, error } = useProductInsight(productId);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end justify-center">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative w-full max-w-[430px] mx-auto bg-white rounded-t-3xl max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white z-10 px-5 pt-5 pb-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900">Product Insight</h2>
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
              {/* Product name + trend */}
              <div>
                <h3 className="text-base font-bold text-gray-900">
                  {data.product_name}
                </h3>
                <div className="flex items-center gap-2 mt-1">
                  <TrendArrow trend={data.demand_trend} />
                  <span
                    className={cn(
                      "text-sm font-bold",
                      data.demand_trend === "rising"
                        ? "text-green-600"
                        : data.demand_trend === "falling"
                        ? "text-red-600"
                        : "text-gray-500"
                    )}
                  >
                    {data.demand_trend === "rising"
                      ? `+${data.demand_trend_pct}%`
                      : data.demand_trend === "falling"
                      ? `${data.demand_trend_pct}%`
                      : "Stable"}
                  </span>
                  <span className="text-xs text-gray-400">demand trend</span>
                </div>
              </div>

              {/* Key stats */}
              <div className="grid grid-cols-2 gap-3">
                <StatBox
                  icon={BarChart3}
                  label="Sales Velocity"
                  value={`${data.sales_velocity}/day`}
                  sub="avg units sold"
                />
                <StatBox
                  icon={Eye}
                  label="Conversion"
                  value={`${data.conversion_rate}%`}
                  sub="views to orders"
                />
                {data.track_stock && data.current_stock !== null && (
                  <StatBox
                    icon={Package}
                    label="Current Stock"
                    value={String(data.current_stock)}
                    sub={
                      data.restock_estimate_days !== null
                        ? `~${Math.ceil(data.restock_estimate_days)} days left`
                        : undefined
                    }
                  />
                )}
                {data.restock_estimate_days !== null && (
                  <StatBox
                    icon={ShoppingCart}
                    label="Restock In"
                    value={`~${Math.ceil(data.restock_estimate_days)} days`}
                    sub="at current rate"
                  />
                )}
              </div>

              {/* Conversion hint */}
              {data.conversion_hint && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                  <p className="text-xs text-blue-800 leading-relaxed">
                    <span className="font-bold">Tip:</span>{" "}
                    {data.conversion_hint}
                  </p>
                </div>
              )}

              {/* Active flags */}
              {data.flags.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                    Active Alerts
                  </p>
                  <div className="space-y-2">
                    {data.flags.map((flag) => (
                      <FlagCard
                        key={flag.id}
                        flag_type={flag.flag_type}
                        severity={flag.severity}
                        message={flag.message}
                        product_name={data.product_name}
                        onDismiss={
                          onDismissFlag
                            ? () => onDismissFlag(flag.id)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 14-day mini metrics table */}
              {data.daily_metrics.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
                    14-Day Activity
                  </p>
                  <div className="overflow-x-auto -mx-5 px-5">
                    <table className="w-full text-[11px]">
                      <thead>
                        <tr className="text-gray-400 font-bold uppercase tracking-wider">
                          <th className="text-left py-2 pr-2">Date</th>
                          <th className="text-right py-2 px-1">Views</th>
                          <th className="text-right py-2 px-1">Carts</th>
                          <th className="text-right py-2 px-1">Orders</th>
                          <th className="text-right py-2 pl-1">Sold</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.daily_metrics
                          .slice(-14)
                          .reverse()
                          .map((m) => (
                            <tr
                              key={m.date}
                              className="border-t border-gray-50"
                            >
                              <td className="py-1.5 pr-2 text-gray-600">
                                {new Date(m.date).toLocaleDateString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </td>
                              <td className="py-1.5 px-1 text-right text-gray-900 font-bold">
                                {m.views}
                              </td>
                              <td className="py-1.5 px-1 text-right text-gray-900 font-bold">
                                {m.add_to_carts}
                              </td>
                              <td className="py-1.5 px-1 text-right text-gray-900 font-bold">
                                {m.orders}
                              </td>
                              <td className="py-1.5 pl-1 text-right text-gray-900 font-bold">
                                {m.units_sold}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!data.track_stock && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                  <p className="text-xs text-amber-800 leading-relaxed">
                    <span className="font-bold">Stock tracking not enabled.</span>{" "}
                    Enable stock tracking on this product to get accurate restock
                    predictions and stockout warnings.
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Safe area padding */}
        <div className="h-8" />
      </div>
    </div>
  );
}
