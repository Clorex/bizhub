// FILE: src/app/vendor/analytics/page.tsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { SectionCard } from "@/components/ui/SectionCard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { AnalyticsChart } from "@/components/charts/AnalyticsChart";
import { PageSkeleton } from "@/components/vendor/PageSkeleton";
import { auth } from "@/lib/firebase/client";
import { toast } from "@/lib/ui/toast";
import { cn } from "@/lib/cn";

import {
  TrendingUp,
  TrendingDown,
  Eye,
  ShoppingCart,
  Users,
  DollarSign,
  RefreshCw,
  Calendar,
  Percent,
  Package,
  AlertCircle,
  Lightbulb,
  Target,
  Zap,
  ChevronRight,
} from "lucide-react";

/* ─────────────────────── Types ─────────────────────── */

type Range = "week" | "month";

interface DayData {
  dayKey: string;
  label: string;
  revenue: number;
  views: number;
  orders: number;
}

interface OverviewData {
  totalRevenue: number;
  orders: number;
  visits: number;
  customers: number;
  productsSold: number;
  avgOrderValue: number;
  conversionRate: number;
}

/* ─────────────────────── Helpers ─────────────────────── */

function fmtNaira(n: number): string {
  if (typeof n !== "number" || isNaN(n)) return "₦0";
  return `₦${n.toLocaleString("en-NG")}`;
}

function fmtNairaCompact(n: number): string {
  if (typeof n !== "number" || isNaN(n) || n <= 0) return "₦0";
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `₦${(n / 1_000).toFixed(0)}k`;
  return `₦${n.toFixed(0)}`;
}

function fmtNumber(n: number): string {
  if (typeof n !== "number" || isNaN(n)) return "0";
  return n.toLocaleString("en-NG");
}

function fmtPercent(n: number): string {
  if (typeof n !== "number" || isNaN(n)) return "0%";
  return `${n.toFixed(1)}%`;
}

function getShortDayLabel(dateStr: string): string {
  if (!dateStr) return "";
  if (dateStr.startsWith("Wk")) return dateStr;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr.slice(-2);
    return date.toLocaleDateString("en-US", { weekday: "short" });
  } catch {
    return dateStr.slice(-2);
  }
}

function processChartData(rawData: any[], range: Range): DayData[] {
  if (!Array.isArray(rawData) || rawData.length === 0) return [];

  const processed = rawData.map((d) => ({
    dayKey: String(d.dayKey || d.label || Math.random()),
    label: String(d.label || d.dayKey || ""),
    revenue: Math.max(0, Number(d.revenue) || 0),
    views: Math.max(0, Number(d.visits || d.views) || 0),
    orders: Math.max(0, Number(d.orders || d.leads) || 0),
  }));

  if (range === "month" && processed.length > 7) {
    const weeks: DayData[] = [];
    processed.forEach((d, i) => {
      const wi = Math.floor(i / 7);
      if (!weeks[wi]) {
        weeks[wi] = { dayKey: `week-${wi + 1}`, label: `Wk ${wi + 1}`, revenue: 0, views: 0, orders: 0 };
      }
      weeks[wi].revenue += d.revenue;
      weeks[wi].views += d.views;
      weeks[wi].orders += d.orders;
    });
    return weeks;
  }

  return processed;
}

/* ─────────────────────── Main Component ─────────────────────── */

export default function VendorAnalyticsPage() {
  const router = useRouter();
  const [range, setRange] = useState<Range>("week");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAnalytics = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Please log in to view analytics.");

      const res = await fetch(`/api/vendor/analytics?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to load analytics.");

      setData(json);
      if (isRefresh) toast.success("Analytics refreshed!");
    } catch (e: any) {
      setError(e.message || "Something went wrong.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  /* ─── Derived data ─── */
  const overview: OverviewData = useMemo(() => {
    const ov = data?.overview || {};
    const revenue = Number(ov.totalRevenue) || 0;
    const orders = Number(ov.orders) || 0;
    const visits = Number(ov.visits) || 0;

    return {
      totalRevenue: revenue,
      orders,
      visits,
      customers: Number(ov.customers) || 0,
      productsSold: Number(ov.productsSold) || 0,
      avgOrderValue: orders > 0 ? revenue / orders : 0,
      conversionRate: visits > 0 ? (orders / visits) * 100 : 0,
    };
  }, [data]);

  const chartData = useMemo(() => processChartData(data?.chartDays || [], range), [data?.chartDays, range]);

  const revenueChartData = useMemo(
    () => chartData.map((d) => ({ label: getShortDayLabel(d.label), value: d.revenue })),
    [chartData]
  );
  const viewsChartData = useMemo(
    () => chartData.map((d) => ({ label: getShortDayLabel(d.label), value: d.views })),
    [chartData]
  );
  const ordersChartData = useMemo(
    () => chartData.map((d) => ({ label: getShortDayLabel(d.label), value: d.orders })),
    [chartData]
  );

  /* ─── Insights ─── */
  const insights = useMemo(() => {
    const result: { title: string; description: string; type: "success" | "warning" | "info"; icon: any }[] = [];

    if (overview.conversionRate > 5) {
      result.push({
        title: "Strong Conversion",
        description: `${fmtPercent(overview.conversionRate)} of visitors make a purchase — well above average.`,
        type: "success",
        icon: Target,
      });
    } else if (overview.visits > 10 && overview.conversionRate < 1) {
      result.push({
        title: "Low Conversion Rate",
        description: "Try improving product photos and descriptions to convert more visitors.",
        type: "warning",
        icon: TrendingDown,
      });
    }

    if (overview.avgOrderValue > 0) {
      result.push({
        title: "Average Order Value",
        description: `Customers spend ${fmtNaira(overview.avgOrderValue)} per order on average.`,
        type: "info",
        icon: DollarSign,
      });
    }

    if (overview.visits === 0 && range === "week") {
      result.push({
        title: "No Store Traffic Yet",
        description: "Share your store link on WhatsApp, Instagram, and Twitter to attract visitors.",
        type: "warning",
        icon: Lightbulb,
      });
    }

    return result;
  }, [overview, range]);

  const periodLabel = range === "week" ? "Last 7 Days" : "Last 30 Days";

  /* ─── Render ─── */
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <GradientHeader title="Analytics" subtitle="Loading..." showBack={true} />
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 bg-gray-50">
      <GradientHeader
        title="Analytics"
        subtitle="Business performance"
        showBack={true}
        right={
          <button
            onClick={() => loadAnalytics(true)}
            disabled={refreshing}
            className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition disabled:opacity-50"
          >
            <RefreshCw className={cn("w-5 h-5 text-white", refreshing && "animate-spin")} />
          </button>
        }
      />

      <div className="px-4 space-y-4 pt-4">
        {/* Period Selector */}
        <SegmentedControl<Range>
          value={range}
          onChange={setRange}
          options={[
            { value: "week", label: "Last 7 Days" },
            { value: "month", label: "Last 30 Days" },
          ]}
        />

        {/* Error */}
        {error && (
          <Card className="p-4 bg-red-50 border-red-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">{error}</p>
                <button
                  onClick={() => loadAnalytics()}
                  className="text-xs font-semibold text-red-600 mt-2 hover:underline"
                >
                  Try again
                </button>
              </div>
            </div>
          </Card>
        )}

        {data && (
          <>
            {/* Revenue Hero */}
            <div className="bg-gradient-to-br from-orange-500 via-orange-500 to-orange-600 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />

              <div className="relative z-10">
                <div className="flex items-center gap-2 text-orange-100 mb-1">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-xs font-semibold uppercase tracking-wider">Total Revenue</span>
                </div>
                <p className="text-4xl font-black tracking-tight">{fmtNaira(overview.totalRevenue)}</p>
                <p className="text-sm text-orange-100 mt-2">
                  {periodLabel} · {overview.orders} order{overview.orders !== 1 ? "s" : ""}
                </p>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-3">
              <MetricCard icon={Eye} label="Store Views" value={fmtNumber(overview.visits)} color="blue" />
              <MetricCard icon={ShoppingCart} label="Orders" value={fmtNumber(overview.orders)} color="green" />
              <MetricCard icon={Users} label="Customers" value={fmtNumber(overview.customers)} color="purple" />
              <MetricCard
                icon={Percent}
                label="Conversion"
                value={fmtPercent(overview.conversionRate)}
                color="orange"
                subtitle={overview.visits > 0 ? `${overview.orders} of ${overview.visits}` : undefined}
              />
            </div>

            {/* Revenue Chart */}
            {revenueChartData.length > 0 && (
              <SectionCard title="Revenue Trend" subtitle={periodLabel}>
                <AnalyticsChart
                  data={revenueChartData}
                  color="bg-orange-500"
                  height={180}
                  formatValue={fmtNairaCompact}
                  formatTooltip={(d) => `${d.label}: ${fmtNaira(d.value)}`}
                  emptyMessage="No revenue data yet"
                />
              </SectionCard>
            )}

            {/* Traffic Chart */}
            {viewsChartData.length > 0 && (
              <SectionCard title="Store Traffic" subtitle="Visitors per period">
                <AnalyticsChart
                  data={viewsChartData}
                  color="bg-blue-500"
                  height={150}
                  formatValue={(n) => n.toFixed(0)}
                  formatTooltip={(d) => `${d.label}: ${d.value} view${d.value !== 1 ? "s" : ""}`}
                  emptyMessage="No traffic data yet"
                />
              </SectionCard>
            )}

            {/* Orders Chart */}
            {ordersChartData.length > 0 && (
              <SectionCard title="Orders" subtitle="Orders per period">
                <AnalyticsChart
                  data={ordersChartData}
                  color="bg-green-500"
                  height={150}
                  formatValue={(n) => n.toFixed(0)}
                  formatTooltip={(d) => `${d.label}: ${d.value} order${d.value !== 1 ? "s" : ""}`}
                  emptyMessage="No orders yet"
                />
              </SectionCard>
            )}

            {/* Insights */}
            {insights.length > 0 && (
              <SectionCard title="Insights" subtitle="Tips to grow your business">
                <div className="space-y-2">
                  {insights.map((insight, i) => {
                    const Icon = insight.icon;
                    const styles = {
                      success: "bg-green-50 border-green-100",
                      warning: "bg-amber-50 border-amber-100",
                      info: "bg-blue-50 border-blue-100",
                    };
                    const textStyles = {
                      success: "text-green-800",
                      warning: "text-amber-800",
                      info: "text-blue-800",
                    };
                    const iconStyles = {
                      success: "text-green-600",
                      warning: "text-amber-600",
                      info: "text-blue-600",
                    };

                    return (
                      <div key={i} className={cn("rounded-2xl border p-4", styles[insight.type])}>
                        <div className="flex items-start gap-3">
                          <Icon className={cn("w-5 h-5 shrink-0 mt-0.5", iconStyles[insight.type])} />
                          <div>
                            <p className={cn("text-sm font-semibold", textStyles[insight.type])}>
                              {insight.title}
                            </p>
                            <p className={cn("text-xs mt-1 opacity-80", textStyles[insight.type])}>
                              {insight.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            )}

            {/* Summary Table */}
            <SectionCard title="Summary" subtitle="Key performance indicators">
              <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden divide-y divide-gray-100">
                <SummaryRow label="Average Order Value" value={fmtNaira(overview.avgOrderValue)} />
                <SummaryRow label="Products Sold" value={fmtNumber(overview.productsSold)} />
                <SummaryRow label="Unique Customers" value={fmtNumber(overview.customers)} />
                <SummaryRow label="Conversion Rate" value={fmtPercent(overview.conversionRate)} />
              </div>
            </SectionCard>
          </>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────── Metric Card ─────────────────────── */

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
  subtitle,
}: {
  icon: any;
  label: string;
  value: string;
  color: "orange" | "green" | "blue" | "purple";
  subtitle?: string;
}) {
  const colors = {
    orange: "bg-orange-50 text-orange-600",
    green: "bg-green-50 text-green-600",
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
  };

  return (
    <Card className="p-4">
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center", colors[color])}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <p className="text-2xl font-black text-gray-900 mt-3 tracking-tight">{value}</p>
      <p className="text-xs text-gray-500 mt-1">{label}</p>
      {subtitle && <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>}
    </Card>
  );
}

/* ─────────────────────── Summary Row ─────────────────────── */

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}