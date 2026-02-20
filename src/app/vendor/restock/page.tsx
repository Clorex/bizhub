// FILE: src/app/vendor/restock/page.tsx
"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { FlagCard } from "@/components/restock/FlagCard";
import { SeverityBadge } from "@/components/restock/SeverityBadge";
import { RestockUpsellCard } from "@/components/restock/RestockUpsellCard";
import { ProductInsightSheet } from "@/components/restock/ProductInsightSheet";
import { useRestockDashboard } from "@/hooks/use-restock-dashboard";
import { cn } from "@/lib/cn";
import {
  RefreshCw,
  ShieldAlert,
  TrendingUp,
  Eye,
  Package,
  BarChart3,
  Settings,
  ChevronRight,
  Loader2,
} from "lucide-react";

export default function VendorRestockPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProduct = searchParams?.get("product") || null;

  const {
    data,
    isLoading,
    error,
    isApexRequired,
    upsell,
    refetch,
    dismissFlag,
  } = useRestockDashboard();

  const [selectedProduct, setSelectedProduct] = useState<string | null>(
    initialProduct
  );
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const handleDismiss = useCallback(
    async (flagId: string) => {
      await dismissFlag(flagId);
    },
    [dismissFlag]
  );

  // Apex required — full page upsell
  if (!isLoading && isApexRequired) {
    return (
      <div className="min-h-screen bg-gray-50">
        <GradientHeader
          title="Smart Restock"
          subtitle="Demand & Stock Alerts"
          showBack={true}
        />
        <div className="px-4 pt-4">
          <RestockUpsellCard />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 bg-gray-50">
      <GradientHeader
        title="Smart Restock"
        subtitle="Demand & Stock Alerts"
        showBack={true}
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/vendor/restock/settings")}
              className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition"
              aria-label="Settings"
            >
              <Settings className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw
                className={cn(
                  "w-5 h-5 text-white",
                  refreshing && "animate-spin"
                )}
              />
            </button>
          </div>
        }
      />

      <div className="px-4 space-y-4 pt-4">
        {/* Loading */}
        {isLoading && (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        )}

        {/* Error */}
        {error && !isLoading && (
          <Card className="p-5 bg-red-50 border-red-200">
            <p className="text-sm text-red-800">{error}</p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-3"
              onClick={handleRefresh}
            >
              Try again
            </Button>
          </Card>
        )}

        {/* Data loaded */}
        {data && !isLoading && (
          <>
            {/* Summary stats bar */}
            <div className="grid grid-cols-3 gap-3">
              <StatPill
                icon={ShieldAlert}
                label="Low Stock"
                count={data.risk_products.length}
                color="red"
              />
              <StatPill
                icon={TrendingUp}
                label="Rising"
                count={data.rising_demand_products.length}
                color="amber"
              />
              <StatPill
                icon={Eye}
                label="Attention"
                count={data.needs_attention_products.length}
                color="blue"
              />
            </div>

            {/* All clear */}
            {data.total_active_flags === 0 && (
              <Card className="p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="w-8 h-8 text-green-600" />
                </div>
                <p className="text-base font-bold text-gray-900">
                  All Clear!
                </p>
                <p className="text-sm text-gray-500 mt-2 max-w-[280px] mx-auto">
                  Your products are looking healthy. We will alert you when
                  anything needs attention.
                </p>
                {data.last_computed_at && (
                  <p className="text-[11px] text-gray-400 mt-4">
                    Last analyzed:{" "}
                    {new Date(data.last_computed_at).toLocaleDateString(
                      "en-US",
                      {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }
                    )}
                  </p>
                )}
              </Card>
            )}

            {/* Risk Products (Low Stock) */}
            {data.risk_products.length > 0 && (
              <SectionCard
                title="Risk Products"
                subtitle="Low stock — may run out soon"
                right={
                  <span className="w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                    {data.risk_products.length}
                  </span>
                }
              >
                <div className="space-y-2">
                  {data.risk_products.map((item) =>
                    item.flags.map((flag) => (
                      <FlagCard
                        key={flag.id}
                        flag_type={flag.flag_type}
                        severity={flag.severity}
                        message={flag.message}
                        product_name={item.product_name}
                        onDismiss={() => handleDismiss(flag.id)}
                        onViewInsight={() =>
                          setSelectedProduct(item.product_id)
                        }
                      />
                    ))
                  )}
                </div>
              </SectionCard>
            )}

            {/* Rising Demand Products */}
            {data.rising_demand_products.length > 0 && (
              <SectionCard
                title="Rising Demand"
                subtitle="Products gaining momentum"
                right={
                  <span className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs font-bold flex items-center justify-center">
                    {data.rising_demand_products.length}
                  </span>
                }
              >
                <div className="space-y-2">
                  {data.rising_demand_products.map((item) =>
                    item.flags.map((flag) => (
                      <FlagCard
                        key={flag.id}
                        flag_type={flag.flag_type}
                        severity={flag.severity}
                        message={flag.message}
                        product_name={item.product_name}
                        onDismiss={() => handleDismiss(flag.id)}
                        onViewInsight={() =>
                          setSelectedProduct(item.product_id)
                        }
                      />
                    ))
                  )}
                </div>
              </SectionCard>
            )}

            {/* Needs Attention */}
            {data.needs_attention_products.length > 0 && (
              <SectionCard
                title="Needs Attention"
                subtitle="Conversion issues or trending"
                right={
                  <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center">
                    {data.needs_attention_products.length}
                  </span>
                }
              >
                <div className="space-y-2">
                  {data.needs_attention_products.map((item) =>
                    item.flags.map((flag) => (
                      <FlagCard
                        key={flag.id}
                        flag_type={flag.flag_type}
                        severity={flag.severity}
                        message={flag.message}
                        product_name={item.product_name}
                        onDismiss={() => handleDismiss(flag.id)}
                        onViewInsight={() =>
                          setSelectedProduct(item.product_id)
                        }
                      />
                    ))
                  )}
                </div>
              </SectionCard>
            )}

            {/* Last computed */}
            {data.last_computed_at && data.total_active_flags > 0 && (
              <p className="text-center text-[11px] text-gray-400 py-2">
                Last analyzed:{" "}
                {new Date(data.last_computed_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            )}
          </>
        )}
      </div>

      {/* Product Insight Sheet */}
      {selectedProduct && (
        <ProductInsightSheet
          productId={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onDismissFlag={handleDismiss}
        />
      )}
    </div>
  );
}

function StatPill({
  icon: Icon,
  label,
  count,
  color,
}: {
  icon: typeof Package;
  label: string;
  count: number;
  color: "red" | "amber" | "blue";
}) {
  const colorStyles = {
    red: count > 0 ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200",
    amber:
      count > 0 ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200",
    blue:
      count > 0 ? "bg-blue-50 border-blue-200" : "bg-gray-50 border-gray-200",
  };
  const iconColor = {
    red: count > 0 ? "text-red-500" : "text-gray-400",
    amber: count > 0 ? "text-amber-500" : "text-gray-400",
    blue: count > 0 ? "text-blue-500" : "text-gray-400",
  };

  return (
    <div
      className={cn(
        "rounded-2xl border p-3 text-center",
        colorStyles[color]
      )}
    >
      <Icon className={cn("w-5 h-5 mx-auto mb-1", iconColor[color])} />
      <p className="text-lg font-black text-gray-900">{count}</p>
      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">
        {label}
      </p>
    </div>
  );
}
