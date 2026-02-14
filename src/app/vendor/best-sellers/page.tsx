"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { auth } from "@/lib/firebase/client";
import { toast } from "@/lib/ui/toast";
import { cn } from "@/lib/cn";
import { formatMoneyNGN } from "@/lib/money";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Flame,
  Package,
  ShoppingCart,
  Wallet,
  ChevronRight,
  Crown,
  BarChart3,
} from "lucide-react";

function fmtNaira(n: number) {
  return formatMoneyNGN(Number(n || 0));
}

function fmtNumber(n: number) {
  return Number(n || 0).toLocaleString("en-NG");
}

export default function VendorBestSellersPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [meta, setMeta] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [dailySeries, setDailySeries] = useState<any[]>([]);
  const [apexInsights, setApexInsights] = useState<any>(null);

  const [days, setDays] = useState<number>(7);

  async function authedFetchJson(path: string) {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || data?.code || "Request failed");
    return data;
  }

  async function load(nextDays?: number, isRefresh = false) {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setMsg(null);

      const d = typeof nextDays === "number" ? nextDays : days;
      const data = await authedFetchJson(`/api/vendor/best-sellers?days=${encodeURIComponent(String(d))}&insights=1`);

      setMeta(data?.meta || null);
      setProducts(Array.isArray(data?.products) ? data.products : []);
      setDailySeries(Array.isArray(data?.dailySeries) ? data.dailySeries : []);
      setApexInsights(data?.apexInsights || null);
      setDays(Number(data?.meta?.days || d));

      if (isRefresh) toast.success("Refreshed!");
    } catch (e: any) {
      setMsg(e?.message || "Failed to load best-sellers");
      setMeta(null);
      setProducts([]);
      setDailySeries([]);
      setApexInsights(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load(7);
  }, []);

  const planKey = String(meta?.planKey || "FREE").toUpperCase();
  const allowedDays: number[] = Array.isArray(meta?.allowedDays) ? meta.allowedDays : [7];
  const apexUnlocked = planKey === "APEX";

  const series = useMemo(() => {
    const s = Array.isArray(dailySeries) ? dailySeries : [];
    return s.slice(-Math.max(1, Number(days || 7)));
  }, [dailySeries, days]);

  const totals = useMemo(() => {
    const revenueKobo = series.reduce((s, r) => s + Number(r?.revenueKobo || 0), 0);
    const units = series.reduce((s, r) => s + Number(r?.unitsSold || 0), 0);
    const orders = series.reduce((s, r) => s + Number(r?.ordersCount || 0), 0);
    return { revenueKobo, units, orders };
  }, [series]);

  const risersCount = apexInsights?.risers?.length || 0;
  const droppersCount = apexInsights?.droppers?.length || 0;
  const newHotCount = apexInsights?.newHot?.length || 0;
  const hasInsights = apexUnlocked && apexInsights && (risersCount > 0 || droppersCount > 0 || newHotCount > 0);

  const periodLabel = `Last ${days} days`;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <GradientHeader title="Best Sellers" subtitle="Loading..." showBack />
        <div className="px-4 pt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <GradientHeader
        title="Best Sellers"
        subtitle={periodLabel}
        showBack
        right={
          <button
            onClick={() => load(days, true)}
            disabled={refreshing}
            className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition disabled:opacity-50 min-tap"
            aria-label="Refresh"
          >
            <RefreshCw className={cn("w-5 h-5 text-white", refreshing && "animate-spin")} />
          </button>
        }
      />

      <div className="px-4 space-y-4 pt-4">
        {msg && (
          <Card className="p-4 bg-red-50 border-red-200">
            <p className="text-sm text-red-800">{msg}</p>
          </Card>
        )}

        {/* Date range selector */}
        {allowedDays.length > 1 && (
          <div className="flex gap-2 scrollbar-hide overflow-x-auto">
            {allowedDays.map((d) => (
              <button
                key={d}
                onClick={() => load(d)}
                disabled={loading || refreshing}
                className={cn(
                  "flex-1 rounded-2xl py-2.5 text-xs font-bold transition shrink-0 min-h-[44px]",
                  days === d
                    ? "text-white bg-gradient-to-br from-orange-500 to-orange-600 shadow-sm"
                    : "bg-white border border-gray-200 text-gray-700 hover:border-orange-200"
                )}
              >
                {d} days
              </button>
            ))}
          </div>
        )}

        {/* Summary cards — Wallet icon instead of $ */}
        <div className="grid grid-cols-3 gap-3">
          <SummaryCard icon={Wallet} label="Revenue" value={fmtNaira(totals.revenueKobo / 100)} color="orange" />
          <SummaryCard icon={ShoppingCart} label="Orders" value={fmtNumber(totals.orders)} color="blue" />
          <SummaryCard icon={Package} label="Units Sold" value={fmtNumber(totals.units)} color="green" />
        </div>

        {/* Empty state */}
        {!loading && products.length === 0 && (
          <Card className="p-6 text-center">
            <div className="flex justify-center mb-3">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center">
                <BarChart3 className="w-7 h-7 text-orange-500" />
              </div>
            </div>
            <p className="text-sm font-bold text-gray-900">No sales data yet</p>
            <p className="text-xs text-gray-500 mt-1.5 max-w-[260px] mx-auto">
              Best-selling products appear here after customers place paid orders.
            </p>
            <Button size="sm" variant="secondary" className="mt-4" onClick={() => router.push("/vendor/products")}>
              View products
            </Button>
          </Card>
        )}

        {/* Top products */}
        {products.length > 0 && (
          <SectionCard
            title="Top Products"
            subtitle={`${products.length} product${products.length !== 1 ? "s" : ""} \u00B7 ${periodLabel}`}
          >
            <div className="space-y-2">
              {products.map((p, idx) => (
                <TopProductRow key={p.productId || idx} product={p} rank={idx + 1} />
              ))}
            </div>
          </SectionCard>
        )}

        {/* Apex insights */}
        {hasInsights && (
          <SectionCard
            title="Product Trends"
            subtitle={`${apexInsights.prevLabel || "Previous"} vs ${apexInsights.recentLabel || "Recent"}`}
            right={
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                Apex
              </span>
            }
          >
            <div className="space-y-3">
              {risersCount > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <p className="text-xs font-bold text-emerald-700">Rising ({risersCount})</p>
                  </div>
                  <div className="space-y-2">
                    {apexInsights.risers.map((x: any) => (
                      <TrendRow key={x.productId} item={x} tone="green" />
                    ))}
                  </div>
                </div>
              )}
              {droppersCount > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="w-4 h-4 text-red-600" />
                    <p className="text-xs font-bold text-red-700">Declining ({droppersCount})</p>
                  </div>
                  <div className="space-y-2">
                    {apexInsights.droppers.map((x: any) => (
                      <TrendRow key={x.productId} item={x} tone="red" />
                    ))}
                  </div>
                </div>
              )}
              {newHotCount > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Flame className="w-4 h-4 text-orange-600" />
                    <p className="text-xs font-bold text-orange-700">Newly trending ({newHotCount})</p>
                  </div>
                  <div className="space-y-2">
                    {apexInsights.newHot.map((x: any) => (
                      <div key={x.productId} className="rounded-2xl border border-orange-100 bg-orange-50/50 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900 truncate">{x.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {fmtNaira(Number(x.revenueNgn || 0))} &bull; {Number(x.units || 0)} units
                            </p>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 border border-orange-200 shrink-0">
                            New
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {/* Upgrade CTA for non-apex with data */}
        {!apexUnlocked && products.length > 0 && (
          <Card className="p-4 bg-gradient-to-br from-purple-50 to-orange-50 border-purple-100">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-orange-500 flex items-center justify-center shrink-0">
                <Crown className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">See product trends</p>
                <p className="text-xs text-gray-600 mt-1">
                  Upgrade to Apex to see rising, declining, and trending products.
                </p>
                <Button
                  size="sm"
                  className="mt-2"
                  onClick={() => router.push("/vendor/subscription")}
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                >
                  View plans
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: string;
  color: "orange" | "blue" | "green";
}) {
  const colorStyles = {
    orange: "bg-orange-50 text-orange-600",
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
  };

  return (
    <Card className="p-3 text-center">
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mx-auto", colorStyles[color])}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <p className="text-base font-black text-gray-900 mt-2 truncate">{value}</p>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mt-0.5">{label}</p>
    </Card>
  );
}

function TopProductRow({ product, rank }: { product: any; rank: number }) {
  const revenueNgn = Number(product.revenueNgn || 0);
  const unitsSold = Number(product.unitsSold || 0);

  const rankColors: Record<number, string> = {
    1: "bg-yellow-400 text-white",
    2: "bg-gray-400 text-white",
    3: "bg-orange-400 text-white",
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3">
      <div
        className={cn(
          "w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0",
          rankColors[rank] || "bg-gray-100 text-gray-500"
        )}
      >
        {rank}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-gray-900 truncate">{product.name || "Product"}</p>
        <p className="text-xs text-gray-500 mt-0.5">
          {unitsSold} unit{unitsSold !== 1 ? "s" : ""} sold
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-gray-900">{fmtNaira(revenueNgn)}</p>
      </div>
    </div>
  );
}

function TrendRow({ item, tone }: { item: any; tone: "green" | "red" }) {
  const changeNgn = Math.abs(Number(item.changeNgn || 0));
  const isGreen = tone === "green";

  return (
    <div
      className={cn(
        "rounded-2xl border p-3",
        isGreen ? "border-emerald-100 bg-emerald-50/50" : "border-red-100 bg-red-50/50"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 truncate">{item.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {fmtNaira(Number(item.recentRevenueNgn || 0))}
            <span className="text-gray-400"> vs </span>
            {fmtNaira(Number(item.prevRevenueNgn || 0))}
          </p>
        </div>
        <span
          className={cn(
            "px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0",
            isGreen
              ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
              : "bg-red-100 text-red-700 border border-red-200"
          )}
        >
          {isGreen ? "+" : "-"}{fmtNaira(changeNgn)}
        </span>
      </div>
    </div>
  );
}
