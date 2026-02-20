// FILE: src/app/vendor/intent-radar/page.tsx
"use client";

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { IntentProductCard } from "@/components/intent-radar/IntentProductCard";
import { IntentRadarUpsellCard } from "@/components/intent-radar/IntentRadarUpsellCard";
import { ProductIntentSheet } from "@/components/intent-radar/ProductIntentSheet";
import { useIntentRadar } from "@/hooks/use-intent-radar";
import { cn } from "@/lib/cn";
import {
  RefreshCw,
  Flame,
  TrendingUp,
  Radar,
  ChevronRight,
} from "lucide-react";

export default function VendorIntentRadarPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialProduct = searchParams?.get("product") || null;

  const { data, isLoading, error, isApexRequired, upsell, refetch } = useIntentRadar();

  const [selectedProduct, setSelectedProduct] = useState<string | null>(initialProduct);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Apex required
  if (!isLoading && isApexRequired) {
    return (
      <div className="min-h-screen bg-gray-50">
        <GradientHeader title="Buyer Intent Radar" subtitle="Hot Deals Advantage" showBack={true} />
        <div className="px-4 pt-4">
          <IntentRadarUpsellCard />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 bg-gray-50">
      <GradientHeader
        title="Buyer Intent Radar"
        subtitle="Hot Deals Advantage"
        showBack={true}
        right={
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn("w-5 h-5 text-white", refreshing && "animate-spin")} />
          </button>
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
            <Button size="sm" variant="secondary" className="mt-3" onClick={handleRefresh}>
              Try again
            </Button>
          </Card>
        )}

        {data && !isLoading && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className={cn(
                "rounded-2xl border p-4 text-center",
                data.total_hot_flags > 0 ? "bg-red-50 border-red-200" : "bg-gray-50 border-gray-200"
              )}>
                <Flame className={cn("w-6 h-6 mx-auto mb-1", data.total_hot_flags > 0 ? "text-red-500" : "text-gray-400")} />
                <p className="text-2xl font-black text-gray-900">{data.total_hot_flags}</p>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Hot Deals</p>
              </div>
              <div className={cn(
                "rounded-2xl border p-4 text-center",
                data.total_strong_flags > 0 ? "bg-orange-50 border-orange-200" : "bg-gray-50 border-gray-200"
              )}>
                <TrendingUp className={cn("w-6 h-6 mx-auto mb-1", data.total_strong_flags > 0 ? "text-orange-500" : "text-gray-400")} />
                <p className="text-2xl font-black text-gray-900">{data.total_strong_flags}</p>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide">Strong Interest</p>
              </div>
            </div>

            {/* All clear */}
            {data.total_hot_flags === 0 && data.total_strong_flags === 0 && (
              <Card className="p-8 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                  <Radar className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-base font-bold text-gray-900">Radar Active</p>
                <p className="text-sm text-gray-500 mt-2 max-w-[280px] mx-auto">
                  No strong buyer signals detected right now. We are monitoring all your products 24/7.
                </p>
                {data.last_computed_at && (
                  <p className="text-[11px] text-gray-400 mt-4">
                    Last scanned: {new Date(data.last_computed_at).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                )}
              </Card>
            )}

            {/* Hot Deal Products */}
            {data.hot_products.length > 0 && (
              <SectionCard
                title="Hot Deal Signals"
                subtitle="High buyer attention — act now"
                right={
                  <span className="w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                    {data.hot_products.length}
                  </span>
                }
              >
                <div className="space-y-2">
                  {data.hot_products.map((item) => (
                    <IntentProductCard
                      key={item.product_id}
                      product_name={item.product_name}
                      flag_level={item.flag_level}
                      message={item.message}
                      suggested_action={item.suggested_action}
                      unique_interested={item.unique_interested}
                      onViewDetail={() => setSelectedProduct(item.product_id)}
                    />
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Strong Interest Products */}
            {data.strong_products.length > 0 && (
              <SectionCard
                title="Strong Interest"
                subtitle="Buyers are seriously looking"
                right={
                  <span className="w-6 h-6 rounded-full bg-orange-500 text-white text-xs font-bold flex items-center justify-center">
                    {data.strong_products.length}
                  </span>
                }
              >
                <div className="space-y-2">
                  {data.strong_products.map((item) => (
                    <IntentProductCard
                      key={item.product_id}
                      product_name={item.product_name}
                      flag_level={item.flag_level}
                      message={item.message}
                      suggested_action={item.suggested_action}
                      unique_interested={item.unique_interested}
                      onViewDetail={() => setSelectedProduct(item.product_id)}
                    />
                  ))}
                </div>
              </SectionCard>
            )}

            {/* How it works */}
            <Card className="p-4 bg-gray-50 border-gray-200">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">How Intent Radar Works</p>
              <div className="space-y-2 text-xs text-gray-600 leading-relaxed">
                <p>We track anonymous buyer behavior: views, repeat visits, cart adds, saves, contacts, and checkout starts.</p>
                <p>When multiple buyers show strong purchase intent on a product, we flag it as a <span className="font-bold text-red-600">Hot Deal</span>.</p>
                <p>Buyer identities are <span className="font-bold">never</span> exposed. All data is aggregated and privacy-safe.</p>
              </div>
            </Card>

            {data.last_computed_at && (data.total_hot_flags > 0 || data.total_strong_flags > 0) && (
              <p className="text-center text-[11px] text-gray-400 py-2">
                Last scanned: {new Date(data.last_computed_at).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                })}
              </p>
            )}
          </>
        )}
      </div>

      {/* Product Detail Sheet */}
      {selectedProduct && (
        <ProductIntentSheet
          productId={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </div>
  );
}
