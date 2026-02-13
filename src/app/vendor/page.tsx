// FILE: src/app/vendor/page.tsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { AnalyticsChart } from "@/components/charts/AnalyticsChart";
import { StatCard } from "@/components/vendor/StatCard";
import { MenuCard } from "@/components/vendor/MenuCard";
import { OrderRow } from "@/components/vendor/OrderRow";
import { QuickStat } from "@/components/vendor/QuickStat";
import { VendorEmptyState } from "@/components/vendor/EmptyState";
import { PageSkeleton } from "@/components/vendor/PageSkeleton";
import DashboardAnalyticsCard from "@/components/vendor/DashboardAnalyticsCard";
import { auth } from "@/lib/firebase/client";
import { toast } from "@/lib/ui/toast";
import { cn } from "@/lib/cn";
import { formatMoneyNGN } from "@/lib/money";

import {
  RefreshCw,
  Link2,
  Plus,
  BarChart3,
  ShoppingCart,
  Package,
  Users,
  Eye,
  Gem,
  AlertCircle,
  ChevronRight,
  TrendingUp,
  Clock,
  ClipboardList,
  Settings,
  Megaphone,
  Copy,
  ExternalLink,
  Zap,
  Tag,
  Wallet,
  Bell,
  Shield,
} from "lucide-react";

type Range = "today" | "week" | "month";

interface OverviewData {
  totalRevenue: number;
  orders: number;
  visits: number;
  customers: number;
  productsSold: number;
}

interface TodoData {
  outOfStockCount: number;
  lowStockCount: number;
  awaitingConfirmCount: number;
  disputedCount: number;
}

interface ChartDayData {
  dayKey: string;
  label: string;
  revenue: number;
  views: number;
  orders: number;
}

const NGN_COMPACT_FORMATTER = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  notation: "compact",
  maximumFractionDigits: 1,
});

function fmtNaira(n: number): string {
  return formatMoneyNGN(Number(n || 0));
}

function fmtNairaCompact(n: number): string {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return formatMoneyNGN(0);
  try {
    return NGN_COMPACT_FORMATTER.format(v);
  } catch {
    return formatMoneyNGN(v);
  }
}

function fmtNumber(n: number): string {
  if (typeof n !== "number" || isNaN(n)) return "0";
  return n.toLocaleString("en-NG");
}

function getShortDayLabel(dateStr: string): string {
  if (!dateStr) return "";
  if (dateStr.startsWith("Wk")) return dateStr;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      const parts = dateStr.split("-");
      if (parts.length === 3) return parts[2];
      return dateStr.slice(-2);
    }
    return date.toLocaleDateString("en-US", { weekday: "short" });
  } catch {
    return dateStr.slice(-2);
  }
}

function processChartData(rawData: any[], range: Range): ChartDayData[] {
  if (!Array.isArray(rawData) || rawData.length === 0) return [];

  const processed = rawData.map((d) => ({
    dayKey: String(d.dayKey || d.label || Math.random()),
    label: String(d.label || d.dayKey || ""),
    revenue: Math.max(0, Number(d.revenue) || 0),
    views: Math.max(0, Number(d.visits || d.views) || 0),
    orders: Math.max(0, Number(d.orders || d.leads) || 0),
  }));

  if (range === "month" && processed.length > 7) {
    const weeks: ChartDayData[] = [];
    processed.forEach((d, i) => {
      const wi = Math.floor(i / 7);
      if (!weeks[wi]) {
        weeks[wi] = {
          dayKey: `week-${wi + 1}`,
          label: `Wk ${wi + 1}`,
          revenue: 0,
          views: 0,
          orders: 0,
        };
      }
      weeks[wi].revenue += d.revenue;
      weeks[wi].views += d.views;
      weeks[wi].orders += d.orders;
    });
    return weeks;
  }

  return processed;
}

export default function VendorDashboardPage() {
  const router = useRouter();

  const [range, setRange] = useState<Range>("week");
  const [me, setMe] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [access, setAccess] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [verificationTier, setVerificationTier] = useState<number>(0);
  const [verificationDismissed, setVerificationDismissed] = useState(false);

  const storeUrl = useMemo(() => {
    if (!me?.businessSlug || typeof window === "undefined") return "";
    return `${window.location.origin}/b/${me.businessSlug}`;
  }, [me]);

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      setError(null);
      setNotice(null);

      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error("Please log in to view your dashboard.");

        const [meRes, analyticsRes] = await Promise.all([
          fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`/api/vendor/analytics?range=${range}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const [meJson, analyticsJson] = await Promise.all([
          meRes.json().catch(() => ({})),
          analyticsRes.json().catch(() => ({})),
        ]);

        if (!meRes.ok) throw new Error(meJson?.error || "Could not load profile.");
        if (!analyticsRes.ok) throw new Error(analyticsJson?.error || "Could not load analytics.");

        setMe(meJson.me);
        setData(analyticsJson);
        setAccess(analyticsJson?.meta?.access || null);

        if (analyticsJson?.meta?.notice) setNotice(String(analyticsJson.meta.notice));

        const usedRange = String(analyticsJson?.meta?.usedRange || range) as Range;
        if (usedRange !== range) setRange(usedRange);

        try {
          const vRes = await fetch("/api/vendor/verification", {
            headers: { Authorization: `Bearer ${token}` },
          });
          const vData = await vRes.json().catch(() => ({}));
          if (vData.ok) {
            setVerificationTier(Number(vData.verificationTier || 0));
          }
        } catch {}

        if (isRefresh) toast.success("Dashboard refreshed!");
      } catch (e: any) {
        setError(e?.message || "Something went wrong.");
        setData(null);
        setAccess(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [range]
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  const copyStoreLink = useCallback(async () => {
    if (!storeUrl) return;
    try {
      await navigator.clipboard.writeText(storeUrl);
      setCopied(true);
      toast.success("Store link copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy link.");
    }
  }, [storeUrl]);

  const overview: OverviewData = useMemo(() => {
    const ov = data?.overview || {};
    return {
      totalRevenue: Number(ov.totalRevenue) || 0,
      orders: Number(ov.orders) || 0,
      visits: Number(ov.visits) || 0,
      customers: Number(ov.customers) || 0,
      productsSold: Number(ov.productsSold) || 0,
    };
  }, [data]);

  const todo: TodoData = useMemo(() => {
    const t = data?.todo || {};
    return {
      outOfStockCount: Number(t.outOfStockCount) || 0,
      lowStockCount: Number(t.lowStockCount) || 0,
      awaitingConfirmCount: Number(t.awaitingConfirmCount) || 0,
      disputedCount: Number(t.disputedCount) || 0,
    };
  }, [data]);

  const recentOrders: any[] = useMemo(
    () => (Array.isArray(data?.recentOrders) ? data.recentOrders : []),
    [data]
  );

  const chartData = useMemo(() => processChartData(data?.chartDays || [], range), [data?.chartDays, range]);

  const revenueChartData = useMemo(
    () => chartData.map((d) => ({ label: getShortDayLabel(d.label), value: d.revenue })),
    [chartData]
  );

  const monthUnlocked = useMemo(() => {
    if (!access) return false;
    if (access.monthAnalyticsUnlocked !== undefined) return !!access.monthAnalyticsUnlocked;
    return !!access?.features?.canUseMonthRange;
  }, [access]);

  const isSubscribed = useMemo(() => {
    const source = String(access?.source || "free");
    const pk = String(access?.planKey || "FREE").toUpperCase();
    return source === "subscription" && pk !== "FREE";
  }, [access]);

  const totalTodoCount =
    todo.outOfStockCount + todo.lowStockCount + todo.awaitingConfirmCount + todo.disputedCount;

  const periodLabel = range === "today" ? "Today" : range === "week" ? "This Week" : "This Month";
  const storeName = me?.businessName || me?.businessSlug || "Your Store";

  const showVerificationReminder = verificationTier < 2 && !verificationDismissed && !loading;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <GradientHeader title="Dashboard" subtitle="Loading your business..." showBack={false} />
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 bg-gray-50">
      <GradientHeader
        title="Dashboard"
        subtitle={storeName}
        showBack={false}
        right={
          <div className="flex items-center gap-2">
            {!isSubscribed && (
              <button
                onClick={() => router.push("/vendor/subscription")}
                className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition"
                aria-label="Upgrade"
              >
                <Gem className="w-5 h-5 text-white" />
              </button>
            )}
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={cn("w-5 h-5 text-white", refreshing && "animate-spin")} />
            </button>
          </div>
        }
      />

      <div className="px-4 space-y-4 pt-4">
        <SegmentedControl<Range>
          value={range}
          onChange={setRange}
          options={[
            { value: "today", label: "Today" },
            { value: "week", label: "Week" },
            { value: "month", label: "Month", disabled: !monthUnlocked },
          ]}
        />

        {notice && (
          <Card className="p-4 bg-orange-50 border-orange-200">
            <div className="flex items-start gap-3">
              <Bell className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
              <p className="text-sm text-orange-800">{notice}</p>
            </div>
          </Card>
        )}

        {error && (
          <Card className="p-4 bg-red-50 border-red-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">{error}</p>
                <Button variant="secondary" size="sm" className="mt-2" onClick={() => loadData()}>
                  Try Again
                </Button>
              </div>
            </div>
          </Card>
        )}

        {showVerificationReminder && (
          <Card className="p-4 bg-blue-50 border-blue-200 relative">
            <button
              onClick={() => setVerificationDismissed(true)}
              className="absolute top-3 right-3 text-blue-400 hover:text-blue-600 text-xs font-bold"
              aria-label="Dismiss"
            >
              ✕
            </button>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-blue-800">
                  {verificationTier === 0 ? "Get verified to start selling" : "Increase your trust level"}
                </p>
                <p className="text-xs text-blue-600 mt-1 leading-relaxed">
                  Verified vendors receive more customer engagement and visibility.
                  {verificationTier === 0
                    ? " Complete basic verification to unlock the marketplace."
                    : " Submit your ID to reach full marketplace access."}
                </p>
                <Button
                  size="sm"
                  className="mt-3"
                  onClick={() => router.push("/vendor/verification")}
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                >
                  {verificationTier === 0 ? "Start verification" : "Continue verification"}
                </Button>
              </div>
            </div>
          </Card>
        )}

        {data && (
          <>
            <div className="bg-gradient-to-br from-orange-500 via-orange-500 to-orange-600 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />

              <div className="relative z-10">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-orange-100">
                      {periodLabel} Revenue
                    </p>
                    <p className="text-4xl font-black mt-2 tracking-tight">
                      {fmtNaira(overview.totalRevenue)}
                    </p>
                    {overview.totalRevenue > 0 && (
                      <p className="text-sm text-orange-100 mt-1 flex items-center gap-1">
                        <TrendingUp className="w-4 h-4" />
                        From {overview.orders} order{overview.orders !== 1 ? "s" : ""}
                      </p>
                    )}
                  </div>
                  {overview.totalRevenue > 0 && (
                    <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
                      <TrendingUp className="w-7 h-7 text-white" />
                    </div>
                  )}
                </div>

                <div className="mt-5 grid grid-cols-3 gap-3">
                  <QuickStat
                    icon={ShoppingCart}
                    label="Orders"
                    value={fmtNumber(overview.orders)}
                    onClick={() => router.push("/vendor/orders")}
                  />
                  <QuickStat
                    icon={Eye}
                    label="Store Views"
                    value={fmtNumber(overview.visits)}
                    onClick={() => router.push("/vendor/analytics")}
                  />
                  <QuickStat
                    icon={Users}
                    label="Customers"
                    value={fmtNumber(overview.customers)}
                    onClick={() => router.push("/vendor/customers")}
                  />
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <button
                    onClick={copyStoreLink}
                    disabled={!storeUrl}
                    className={cn(
                      "flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition",
                      copied ? "bg-green-500 text-white" : "bg-white/20 hover:bg-white/30 text-white"
                    )}
                  >
                    {copied ? (
                      <>
                        <Copy className="w-4 h-4" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Link2 className="w-4 h-4" />
                        Copy link
                      </>
                    )}
                  </button>
                  <button
                    onClick={() => router.push(`/b/${me?.businessSlug || ""}`)}
                    disabled={!me?.businessSlug}
                    className="flex items-center justify-center gap-2 bg-white text-orange-600 hover:bg-orange-50 rounded-xl py-3 text-sm font-bold transition disabled:opacity-50"
                  >
                    <ExternalLink className="w-4 h-4" />
                    View store
                  </button>
                </div>
              </div>
            </div>

            {totalTodoCount > 0 && (
              <SectionCard
                title="Action Required"
                subtitle={`${totalTodoCount} item${totalTodoCount !== 1 ? "s" : ""} need your attention`}
                right={
                  <span className="w-6 h-6 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center">
                    {totalTodoCount}
                  </span>
                }
              >
                <div className="space-y-2">
                  {todo.disputedCount > 0 && (
                    <MenuCard
                      icon={AlertCircle}
                      label="Disputed orders"
                      description="Resolve customer disputes"
                      badge={todo.disputedCount}
                      href="/vendor/orders?filter=disputed"
                      urgent
                    />
                  )}
                  {todo.awaitingConfirmCount > 0 && (
                    <MenuCard
                      icon={Clock}
                      label="Awaiting confirmation"
                      description="Confirm pending payments"
                      badge={todo.awaitingConfirmCount}
                      href="/vendor/orders?filter=pending"
                      urgent
                    />
                  )}
                  {todo.outOfStockCount > 0 && (
                    <MenuCard
                      icon={Package}
                      label="Out of stock"
                      description="Restock or hide products"
                      badge={todo.outOfStockCount}
                      href="/vendor/products?filter=outofstock"
                    />
                  )}
                  {todo.lowStockCount > 0 && (
                    <MenuCard
                      icon={Package}
                      label="Low stock warning"
                      description="Products running low"
                      badge={todo.lowStockCount}
                      href="/vendor/products?filter=lowstock"
                    />
                  )}
                </div>
              </SectionCard>
            )}

            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Products Sold"
                value={fmtNumber(overview.productsSold)}
                icon={Package}
                color="green"
                onClick={() => router.push("/vendor/products")}
              />
              <StatCard
                label="Total Orders"
                value={fmtNumber(overview.orders)}
                icon={ShoppingCart}
                color="blue"
                onClick={() => router.push("/vendor/orders")}
              />
            </div>

            {revenueChartData.length > 0 && (
              <SectionCard
                title="Revenue Trend"
                subtitle={periodLabel}
                right={
                  <button
                    onClick={() => router.push("/vendor/analytics")}
                    className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1"
                  >
                    Details
                    <ChevronRight className="w-4 h-4" />
                  </button>
                }
              >
                <AnalyticsChart
                  data={revenueChartData}
                  color="bg-orange-500"
                  height={140}
                  formatValue={fmtNairaCompact}
                  formatTooltip={(d) => `${d.label}: ${fmtNaira(d.value)}`}
                />
              </SectionCard>
            )}

            <DashboardAnalyticsCard range={range} />

            <SectionCard title="Quick actions" subtitle="Manage your business">
              <div className="grid grid-cols-2 gap-2">
                <QuickActionCard icon={Plus} label="Add product" href="/vendor/products/new" color="orange" />
                <QuickActionCard icon={ClipboardList} label="View orders" href="/vendor/orders" color="blue" />
                <QuickActionCard icon={BarChart3} label="View analytics" href="/vendor/analytics" color="purple" />
                <QuickActionCard icon={Settings} label="Store settings" href="/vendor/store" color="gray" />
              </div>

              <div className="mt-3 space-y-2">
                <MenuCard icon={Tag} label="Coupon codes" description="Create discount codes" href="/vendor/coupons" />
                <MenuCard icon={Megaphone} label="Promotions" description="Boost products in marketplace" href="/vendor/promotions" />
                <MenuCard icon={Wallet} label="Payouts" description="View earnings and withdrawals" href="/vendor/payouts" />
              </div>
            </SectionCard>

            <SectionCard
              title="Recent orders"
              subtitle="Latest activity"
              right={
                recentOrders.length > 0 && (
                  <button
                    onClick={() => router.push("/vendor/orders")}
                    className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1"
                  >
                    View all
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )
              }
            >
              {recentOrders.length === 0 ? (
                <VendorEmptyState
                  icon={ShoppingCart}
                  title="No orders yet"
                  description="Share your store link to start receiving orders from customers."
                  actions={[
                    { label: "Copy link", onClick: copyStoreLink, icon: Link2, variant: "primary" },
                    { label: "Add product", onClick: () => router.push("/vendor/products/new"), icon: Plus, variant: "secondary" },
                  ]}
                />
              ) : (
                <div className="space-y-2">
                  {recentOrders.slice(0, 5).map((order) => (
                    <OrderRow key={order.id} order={order} onClick={() => router.push(`/vendor/orders/${order.id}`)} />
                  ))}
                </div>
              )}
            </SectionCard>

            {!isSubscribed && (
              <Card className="p-5 bg-gradient-to-br from-purple-50 to-orange-50 border-purple-100">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-orange-500 flex items-center justify-center shrink-0">
                    <Zap className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-bold text-gray-900">Unlock more features</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Get monthly analytics, priority support, coupons, and more with Pro.
                    </p>
                    <Button
                      size="sm"
                      className="mt-3"
                      onClick={() => router.push("/vendor/subscription")}
                      rightIcon={<ChevronRight className="w-4 h-4" />}
                    >
                      View plans
                    </Button>
                  </div>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function QuickActionCard({
  icon: Icon,
  label,
  href,
  color = "orange",
}: {
  icon: any;
  label: string;
  href: string;
  color?: "orange" | "blue" | "purple" | "gray" | "green";
}) {
  const colorStyles = {
    orange: "bg-orange-50 text-orange-600 group-hover:bg-orange-100",
    blue: "bg-blue-50 text-blue-600 group-hover:bg-blue-100",
    purple: "bg-purple-50 text-purple-600 group-hover:bg-purple-100",
    gray: "bg-gray-100 text-gray-600 group-hover:bg-gray-200",
    green: "bg-green-50 text-green-600 group-hover:bg-green-100",
  };

  return (
    <Link
      href={href}
      className="group flex flex-col items-center justify-center p-4 rounded-2xl border border-gray-100 bg-white hover:border-orange-200 hover:shadow-sm transition"
    >
      <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center transition", colorStyles[color])}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-xs font-semibold text-gray-900 mt-2 text-center">{label}</p>
    </Link>
  );
}