// FILE: src/app/vendor/orders/page.tsx
"use client";

import { Suspense, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { VendorEmptyState } from "@/components/vendor/EmptyState";
import { ListSkeleton } from "@/components/vendor/PageSkeleton";
import { auth } from "@/lib/firebase/client";
import { toast } from "@/lib/ui/toast";
import { cn } from "@/lib/cn";
import { formatMoneyNGN } from "@/lib/money";

import {
  RefreshCw,
  Download,
  Link2,
  Plus,
  ChevronRight,
  Search,
  ShoppingCart,
  Loader2,
  Filter,
  CheckCircle2,
  Truck,
  XCircle,
  AlertTriangle,
  MessageCircle,
  X,
  TrendingUp,
  Calendar,
  Sparkles,
  Bell,
  Zap,
} from "lucide-react";

/* ───────────────────────── Types ───────────────────────── */

type FilterTab = "all" | "new" | "active" | "completed" | "disputed";

interface OrderStats {
  total: number;
  new: number;
  active: number;
  completed: number;
  disputed: number;
  todayRevenue: number;
  todayOrders: number;
}

/* ───────────────────────── Helpers ───────────────────────── */

const NGN_COMPACT_FORMATTER = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  notation: "compact",
  maximumFractionDigits: 1,
});

function fmtNaira(n: number): string {
  return formatMoneyNGN(n);
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

function toMs(v: any): number {
  try {
    if (!v) return 0;

    if (typeof v === "number") return v;

    if (typeof v?.toDate === "function") return v.toDate().getTime();

    if (typeof v?.seconds === "number") return v.seconds * 1000;
    if (typeof v?._seconds === "number") return v._seconds * 1000;

    if (typeof v?.ms === "number") return v.ms;
    if (typeof v?.millis === "number") return v.millis;

    if (typeof v === "string") {
      const d = new Date(v);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    }

    return 0;
  } catch {
    return 0;
  }
}

function fmtDate(v: any): string {
  try {
    const ms = toMs(v);
    if (!ms) return "—";
    const date = new Date(ms);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleString("en-NG", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function fmtRelativeTime(v: any): string {
  try {
    const ms = toMs(v);
    if (!ms) return "";

    const date = new Date(ms);
    if (isNaN(date.getTime())) return "";

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return fmtDate(ms);
  } catch {
    return "";
  }
}

function isToday(v: any): boolean {
  try {
    const ms = toMs(v);
    if (!ms) return false;
    const date = new Date(ms);
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  } catch {
    return false;
  }
}

function getOrderCreatedAtValue(o: any) {
  // Prefer server-provided ms to avoid Timestamp serialization issues
  return o?.createdAtMs ?? o?.createdAt;
}

function getStatusInfo(status: string): {
  label: string;
  bg: string;
  text: string;
  icon: any;
  dotColor: string;
} {
  const s = String(status || "").toLowerCase();
  const configs: Record<string, { label: string; bg: string; text: string; icon: any; dotColor: string }> = {
    new: { label: "New", bg: "bg-orange-100", text: "text-orange-700", icon: Sparkles, dotColor: "bg-orange-500" },
    contacted: { label: "Contacted", bg: "bg-blue-100", text: "text-blue-700", icon: MessageCircle, dotColor: "bg-blue-500" },
    paid: { label: "Paid", bg: "bg-green-100", text: "text-green-700", icon: CheckCircle2, dotColor: "bg-green-500" },
    in_transit: { label: "In Transit", bg: "bg-purple-100", text: "text-purple-700", icon: Truck, dotColor: "bg-purple-500" },
    delivered: { label: "Delivered", bg: "bg-emerald-100", text: "text-emerald-700", icon: CheckCircle2, dotColor: "bg-emerald-500" },
    cancelled: { label: "Cancelled", bg: "bg-gray-100", text: "text-gray-600", icon: XCircle, dotColor: "bg-gray-400" },
    disputed: { label: "Disputed", bg: "bg-red-100", text: "text-red-700", icon: AlertTriangle, dotColor: "bg-red-500" },
  };
  return configs[s] || configs.new;
}

/**
 * ✅ Build/Deploy fix:
 * Pages using useSearchParams() must be wrapped in Suspense to avoid prerender/export errors.
 */
export default function VendorOrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50">
          <GradientHeader title="Orders" subtitle="Loading..." showBack={false} />
          <ListSkeleton count={5} />
        </div>
      }
    >
      <VendorOrdersPageInner />
    </Suspense>
  );
}

/* ───────────────────────── Main Component (Inner) ───────────────────────── */

function VendorOrdersPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialFilter = (searchParams.get("filter") as FilterTab) || "all";

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [apiStats, setApiStats] = useState<OrderStats | null>(null);
  const [me, setMe] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [filter, setFilter] = useState<FilterTab>(initialFilter);
  const [searchQuery, setSearchQuery] = useState("");

  const lastLoadedAtRef = useRef<number>(0);

  const storeUrl = useMemo(() => {
    const slug = String(me?.businessSlug || "").trim();
    if (!slug || typeof window === "undefined") return "";
    return `${window.location.origin}/b/${slug}`;
  }, [me]);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    setError(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Please log in to view orders.");

      const meRes = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
      const meData = await meRes.json().catch(() => ({}));
      if (meRes.ok) setMe(meData?.me || null);

      const ordersRes = await fetch("/api/vendor/orders", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const ordersData = await ordersRes.json().catch(() => ({}));

      if (!ordersRes.ok) throw new Error(ordersData?.error || "Could not load orders.");

      const list = Array.isArray(ordersData.orders) ? ordersData.orders : [];
      list.sort((a: any, b: any) => toMs(getOrderCreatedAtValue(b)) - toMs(getOrderCreatedAtValue(a)));

      setOrders(list);
      setMeta(ordersData?.meta || null);
      setApiStats(ordersData?.meta?.stats || null);

      lastLoadedAtRef.current = Date.now();

      if (isRefresh) toast.success("Orders refreshed!");
    } catch (e: any) {
      setError(e?.message || "Could not load orders.");
      setOrders([]);
      setMeta(null);
      setApiStats(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Refresh together when returning to the tab/window (throttled)
  useEffect(() => {
    const THROTTLE_MS = 30_000;

    const maybeRefresh = () => {
      const last = lastLoadedAtRef.current || 0;
      if (Date.now() - last > THROTTLE_MS && !refreshing && !loading) {
        load(true);
      }
    };

    const onFocus = () => maybeRefresh();
    const onVis = () => {
      if (document.visibilityState === "visible") maybeRefresh();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVis);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load, refreshing, loading]);

  const exportCsv = useCallback(async () => {
    setExporting(true);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Please log in again.");

      const res = await fetch("/api/vendor/orders/export", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.code === "FEATURE_LOCKED") {
          toast.info(data?.error || "Export is a Pro feature. Upgrade to access.");
          return;
        }
        throw new Error(data?.error || "Could not export.");
      }

      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") || "";
      const match = cd.match(/filename="([^"]+)"/i);
      const filename = match?.[1] || `orders_${new Date().toISOString().slice(0, 10)}.csv`;

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);

      toast.success("Orders exported successfully!");
    } catch (e: any) {
      toast.error(e?.message || "Could not export orders.");
    } finally {
      setExporting(false);
    }
  }, []);

  const copyStoreLink = useCallback(async () => {
    if (!storeUrl) {
      toast.info("Store link not ready.");
      return;
    }
    try {
      await navigator.clipboard.writeText(storeUrl);
      toast.success("Store link copied!");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }, [storeUrl]);

  const computedStats: OrderStats = useMemo(() => {
    const total = orders.length;

    const newOrders = orders.filter((o) => String(o.opsStatusEffective || o.opsStatus || "").toLowerCase() === "new").length;

    const active = orders.filter((o) => {
      const s = String(o.opsStatusEffective || o.opsStatus || "").toLowerCase();
      return !["delivered", "cancelled", "new"].includes(s);
    }).length;

    const completed = orders.filter((o) => String(o.opsStatusEffective || o.opsStatus || "").toLowerCase() === "delivered").length;

    const disputed = orders.filter((o) => String(o.escrowStatus || "").toLowerCase() === "disputed").length;

    const todayOrders = orders.filter((o) => isToday(getOrderCreatedAtValue(o))).length;

    const todayRevenue = orders
      .filter((o) => isToday(getOrderCreatedAtValue(o)))
      .reduce((sum, o) => {
        const amt = Number(o.amount || (o.amountKobo ? o.amountKobo / 100 : 0) || 0);
        return sum + (Number.isFinite(amt) ? amt : 0);
      }, 0);

    return { total, new: newOrders, active, completed, disputed, todayOrders, todayRevenue };
  }, [orders]);

  const stats = apiStats || computedStats;

  const filteredOrders = useMemo(() => {
    let list = [...orders];

    switch (filter) {
      case "new":
        list = list.filter((o) => String(o.opsStatusEffective || o.opsStatus || "").toLowerCase() === "new");
        break;
      case "active":
        list = list.filter((o) => {
          const s = String(o.opsStatusEffective || o.opsStatus || "").toLowerCase();
          return !["delivered", "cancelled", "new"].includes(s);
        });
        break;
      case "completed":
        list = list.filter((o) => {
          const s = String(o.opsStatusEffective || o.opsStatus || "").toLowerCase();
          return ["delivered", "cancelled"].includes(s);
        });
        break;
      case "disputed":
        list = list.filter((o) => String(o.escrowStatus || "").toLowerCase() === "disputed");
        break;
    }

    const q = searchQuery.trim().toLowerCase();
    if (q) {
      list = list.filter((o) => {
        const id = String(o.id || "").toLowerCase();
        const status = String(o.opsStatusEffective || o.opsStatus || "").toLowerCase();
        const customerName = String(o.customer?.fullName || o.customer?.name || "").toLowerCase();
        const customerPhone = String(o.customer?.phone || "").toLowerCase();
        return id.includes(q) || status.includes(q) || customerName.includes(q) || customerPhone.includes(q);
      });
    }

    return list;
  }, [orders, filter, searchQuery]);

  const groupedOrders = useMemo(() => {
    const groups: { label: string; orders: any[] }[] = [];
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const todayStr = today.toDateString();
    const yesterdayStr = yesterday.toDateString();

    const grouped: Record<string, any[]> = {};

    filteredOrders.forEach((order) => {
      const ms = toMs(getOrderCreatedAtValue(order));
      const date = ms ? new Date(ms) : new Date();
      const dateStr = date.toDateString();

      let label: string;
      if (dateStr === todayStr) label = "Today";
      else if (dateStr === yesterdayStr) label = "Yesterday";
      else label = date.toLocaleDateString("en-NG", { month: "long", day: "numeric", year: "numeric" });

      if (!grouped[label]) grouped[label] = [];
      grouped[label].push(order);
    });

    Object.entries(grouped).forEach(([label, orders]) => groups.push({ label, orders }));
    return groups;
  }, [filteredOrders]);

  const planKey = String(meta?.planKey || "FREE").toUpperCase();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <GradientHeader title="Orders" subtitle="Loading..." showBack={false} />
        <ListSkeleton count={5} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 bg-gray-50">
      <GradientHeader
        title="Orders"
        subtitle={`${stats.total} total order${stats.total !== 1 ? "s" : ""}`}
        showBack={false}
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={exportCsv}
              disabled={exporting || orders.length === 0}
              className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition disabled:opacity-50"
              aria-label="Export"
            >
              {exporting ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Download className="w-5 h-5 text-white" />}
            </button>
            <button
              onClick={() => load(true)}
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
        {error && (
          <Card className="p-4 bg-red-50 border-red-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800">{error}</p>
                <Button size="sm" variant="secondary" className="mt-2" onClick={() => load()}>
                  Try Again
                </Button>
              </div>
            </div>
          </Card>
        )}

        {orders.length > 0 && (
          <div className="bg-gradient-to-br from-orange-500 via-orange-500 to-orange-600 rounded-3xl p-5 text-white shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4" />
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />

            <div className="relative z-10">
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="w-4 h-4 text-orange-200" />
                <span className="text-xs font-bold uppercase tracking-widest text-orange-100">
                  Today&apos;s Summary
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-3xl font-black">{fmtNaira(stats.todayRevenue)}</p>
                  <p className="text-sm text-orange-100 mt-1">Revenue</p>
                </div>
                <div>
                  <p className="text-3xl font-black">{stats.todayOrders}</p>
                  <p className="text-sm text-orange-100 mt-1">Orders</p>
                </div>
              </div>

              {stats.todayOrders > 0 && (
                <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/20">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-sm">Avg. order: {fmtNaira(stats.todayRevenue / stats.todayOrders)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {orders.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            <QuickStatButton label="New" value={stats.new} active={filter === "new"} onClick={() => setFilter(filter === "new" ? "all" : "new")} color="orange" hasNotification={stats.new > 0} />
            <QuickStatButton label="Active" value={stats.active} active={filter === "active"} onClick={() => setFilter(filter === "active" ? "all" : "active")} color="blue" />
            <QuickStatButton label="Done" value={stats.completed} active={filter === "completed"} onClick={() => setFilter(filter === "completed" ? "all" : "completed")} color="green" />
            <QuickStatButton label="Disputed" value={stats.disputed} active={filter === "disputed"} onClick={() => setFilter(filter === "disputed" ? "all" : "disputed")} color="red" hasNotification={stats.disputed > 0} />
          </div>
        )}

        <Card className="p-3">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input placeholder="Search orders, customers..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10" />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center hover:bg-gray-300" aria-label="Clear search">
                  <X className="w-3 h-3 text-gray-600" />
                </button>
              )}
            </div>
          </div>

          {(filter !== "all" || searchQuery) && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-500">Filters:</span>
              {filter !== "all" && (
                <button
                  onClick={() => setFilter("all")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold hover:bg-orange-200"
                >
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                  <X className="w-3 h-3" />
                </button>
              )}
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold hover:bg-blue-200"
                >
                  "{searchQuery}"
                  <X className="w-3 h-3" />
                </button>
              )}
              <button onClick={() => { setFilter("all"); setSearchQuery(""); }} className="text-xs font-medium text-gray-500 hover:text-gray-700 underline">
                Clear all
              </button>
            </div>
          )}
        </Card>

        {orders.length === 0 && !error && (
          <Card className="p-8 text-center bg-gradient-to-br from-orange-50 to-white border-orange-100">
            <div className="w-20 h-20 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-5">
              <ShoppingCart className="w-10 h-10 text-orange-500" />
            </div>
            <p className="text-xl font-bold text-gray-900">No orders yet</p>
            <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">
              Once customers start ordering, their orders will appear here. Share your store link to get started!
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button onClick={copyStoreLink} disabled={!storeUrl} leftIcon={<Link2 className="w-4 h-4" />}>
                Copy Store Link
              </Button>
              <Button variant="secondary" onClick={() => router.push("/vendor/products/new")} leftIcon={<Plus className="w-4 h-4" />}>
                Add Product
              </Button>
            </div>
          </Card>
        )}

        {orders.length > 0 && filteredOrders.length === 0 && (
          <VendorEmptyState
            icon={Filter}
            title="No matching orders"
            description="Try adjusting your filters or search term"
            actions={[
              { label: "Clear Filters", onClick: () => { setFilter("all"); setSearchQuery(""); }, variant: "primary" },
            ]}
          />
        )}

        {groupedOrders.map((group) => (
          <div key={group.label} className="space-y-2">
            <div className="flex items-center gap-3 px-1">
              <span className="text-sm font-bold text-gray-900">{group.label}</span>
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-500">{group.orders.length} orders</span>
            </div>

            <div className="space-y-2">
              {group.orders.map((order) => (
                <OrderCard key={order.id} order={order} onClick={() => router.push(`/vendor/orders/${order.id}`)} />
              ))}
            </div>
          </div>
        ))}

        {stats.new > 0 && filter !== "new" && (
          <button
            onClick={() => setFilter("new")}
            className="w-full p-4 rounded-2xl bg-orange-50 border border-orange-200 flex items-center gap-4 hover:bg-orange-100 transition"
          >
            <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center shrink-0">
              <Bell className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 text-left">
              <p className="text-sm font-bold text-orange-800">
                {stats.new} new order{stats.new !== 1 ? "s" : ""} waiting
              </p>
              <p className="text-xs text-orange-600 mt-0.5">Tap to view and process</p>
            </div>
            <ChevronRight className="w-5 h-5 text-orange-400" />
          </button>
        )}

        {meta && orders.length > 0 && (
          <div className="text-center pt-2 space-y-2">
            <p className="text-xs text-gray-400">
              Plan: {planKey} • Showing {filteredOrders.length} of {orders.length} orders
            </p>
            {planKey === "FREE" && (
              <button
                onClick={() => router.push("/vendor/subscription")}
                className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700"
              >
                <Zap className="w-3 h-3" />
                Upgrade for more features
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────── Quick Stat Button ───────────────────────── */

function QuickStatButton({
  label,
  value,
  active,
  onClick,
  color,
  hasNotification,
}: {
  label: string;
  value: number;
  active: boolean;
  onClick: () => void;
  color: "orange" | "blue" | "green" | "red";
  hasNotification?: boolean;
}) {
  const colorStyles = {
    orange: active
      ? "bg-orange-500 border-orange-500 text-white"
      : "bg-orange-50 border-orange-200 text-orange-700 hover:border-orange-300",
    blue: active
      ? "bg-blue-500 border-blue-500 text-white"
      : "bg-blue-50 border-blue-200 text-blue-700 hover:border-blue-300",
    green: active
      ? "bg-green-500 border-green-500 text-white"
      : "bg-green-50 border-green-200 text-green-700 hover:border-green-300",
    red: active
      ? "bg-red-500 border-red-500 text-white"
      : "bg-red-50 border-red-200 text-red-700 hover:border-red-300",
  };

  return (
    <button onClick={onClick} className={cn("relative rounded-2xl border p-3 text-center transition-all", colorStyles[color])}>
      {hasNotification && !active && <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-red-500 border-2 border-white" />}
      <p className="text-xl font-black">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-wide mt-0.5 opacity-80">{label}</p>
    </button>
  );
}

/* ───────────────────────── Order Card ───────────────────────── */

function OrderCard({ order, onClick }: { order: any; onClick: () => void }) {
  const status = String(order.opsStatusEffective || order.opsStatus || "new");
  const statusInfo = getStatusInfo(status);
  const StatusIcon = statusInfo.icon;

  const amount = Number(order.amount || (order.amountKobo ? order.amountKobo / 100 : 0) || 0);
  const items = Array.isArray(order.items) ? order.items : [];
  const itemCount = items.length;
  const firstItemName = items[0]?.name || "Order";

  const customer = order.customer || {};
  const customerName = customer.fullName || customer.name || "Customer";
  const customerInitial = customerName[0]?.toUpperCase() || "?";

  const paymentType = order.paymentType || "card";
  const isDirectTransfer = paymentType === "direct_transfer";
  const isDisputed = String(order.escrowStatus || "").toLowerCase() === "disputed";

  const relativeTime = fmtRelativeTime(getOrderCreatedAtValue(order));
  const isNew = status.toLowerCase() === "new";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full p-4 rounded-2xl border bg-white text-left transition-all",
        isNew
          ? "border-orange-200 hover:border-orange-300 hover:shadow-md ring-1 ring-orange-100"
          : isDisputed
          ? "border-red-200 hover:border-red-300"
          : "border-gray-100 hover:border-orange-200 hover:shadow-sm"
      )}
    >
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
            <span className="text-lg font-bold text-white">{customerInitial}</span>
          </div>
          <div className={cn("absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full border-2 border-white", statusInfo.dotColor)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-gray-900">{customerName}</p>
              <p className="text-xs text-gray-500 mt-0.5">#{String(order.id).slice(0, 8).toUpperCase()}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-gray-900">{fmtNaira(amount)}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{relativeTime}</p>
            </div>
          </div>

          <p className="text-xs text-gray-600 mt-2 line-clamp-1">
            {itemCount === 1 ? firstItemName : `${firstItemName} +${itemCount - 1} more`}
          </p>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold", statusInfo.bg, statusInfo.text)}>
              <StatusIcon className="w-3 h-3" />
              {statusInfo.label}
            </span>

            <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold">
              {isDirectTransfer ? "Bank Transfer" : "Card"}
            </span>

            {isDisputed && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                <AlertTriangle className="w-3 h-3" />
                Disputed
              </span>
            )}

            {isNew && (
              <span className="px-2 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-bold animate-pulse">
                NEW
              </span>
            )}
          </div>
        </div>

        <ChevronRight className="w-5 h-5 text-gray-300 shrink-0 self-center" />
      </div>
    </button>
  );
}