// FILE: src/app/orders/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  Package,
  ShoppingBag,
  Loader2,
  LogIn,
  RefreshCw,
  Search,
} from "lucide-react";

import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { OrderCard } from "@/components/orders/OrderCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { auth } from "@/lib/firebase/client";
import { getRecentOrderIds } from "@/lib/orders/recent";

function toMs(v: any) {
  try {
    if (!v) return 0;
    if (typeof v?.toDate === "function") return v.toDate().getTime();
    if (typeof v?.seconds === "number") return v.seconds * 1000;
    return 0;
  } catch {
    return 0;
  }
}

function OrderSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="flex items-start gap-4">
        <Skeleton className="w-12 h-12 rounded-xl" />
        <div className="flex-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24 mt-2" />
          <Skeleton className="h-6 w-20 mt-3 rounded-full" />
        </div>
        <Skeleton className="h-5 w-16" />
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setAuthLoading(false);
      setLoggedIn(!!u);
    });
    return () => unsub();
  }, []);

  async function loadOrders(isRefresh = false) {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      if (!auth.currentUser) {
        setOrders([]);
        return;
      }

      const ids = getRecentOrderIds();
      if (!ids.length) {
        setOrders([]);
        return;
      }

      const token = await auth.currentUser.getIdToken();

      const r = await fetch("/api/orders/recent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ids: ids.slice(0, 25) }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Failed to load orders");

      const list = Array.isArray(data.orders) ? data.orders : [];
      list.sort((a: any, b: any) => toMs(b.createdAt) - toMs(a.createdAt));

      setOrders(list);
    } catch (e: any) {
      setError(e?.message || "Failed to load orders");
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (loggedIn) {
      loadOrders();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [loggedIn, authLoading]);

  // Filter orders by search
  const filteredOrders = useMemo(() => {
    if (!searchQuery.trim()) return orders;
    
    const query = searchQuery.toLowerCase();
    return orders.filter((o) => {
      const orderId = String(o.id || "").toLowerCase();
      const vendor = String(o.businessSlug || "").toLowerCase();
      return orderId.includes(query) || vendor.includes(query);
    });
  }, [orders, searchQuery]);

  // Group orders by status
  const { activeOrders, completedOrders } = useMemo(() => {
    const active: any[] = [];
    const completed: any[] = [];

    filteredOrders.forEach((o) => {
      const status = String(o?.opsStatusEffective || o?.opsStatus || o?.orderStatus || "").toLowerCase();
      if (status === "delivered" || status === "cancelled") {
        completed.push(o);
      } else {
        active.push(o);
      }
    });

    return { activeOrders: active, completedOrders: completed };
  }, [filteredOrders]);

  // Not logged in state
  if (!authLoading && !loggedIn) {
    return (
      <div className="min-h-screen bg-gray-50">
        <GradientHeader title="My Orders" subtitle="Track your purchases" showBack={false} />
        
        <div className="px-4 pt-4 pb-24">
          <Card className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-4">
              <LogIn className="w-8 h-8 text-orange-600" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Login Required</h2>
            <p className="text-sm text-gray-500 mt-2">
              Please login to view and track your orders.
            </p>
            <Button
              className="mt-6"
              onClick={() => router.push(`/account/login?next=${encodeURIComponent("/orders")}`)}
            >
              Login to Continue
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <GradientHeader
        title="My Orders"
        subtitle={loading ? "Loading..." : `${orders.length} order${orders.length !== 1 ? "s" : ""}`}
        showBack={false}
        right={
          <button
            onClick={() => loadOrders(true)}
            disabled={refreshing}
            className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 text-white ${refreshing ? "animate-spin" : ""}`} />
          </button>
        }
      />

      <div className="px-4 pt-4 pb-24 space-y-4">
        {/* Search */}
        {orders.length > 3 && (
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by order ID or vendor..."
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-gray-200 bg-white text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
            />
          </div>
        )}

        {/* Error */}
        {error && (
          <Card className="p-4 bg-red-50 border-red-100">
            <p className="text-sm text-red-700">{error}</p>
            <Button variant="secondary" size="sm" className="mt-2" onClick={() => loadOrders()}>
              Try Again
            </Button>
          </Card>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            <OrderSkeleton />
            <OrderSkeleton />
            <OrderSkeleton />
          </div>
        )}

        {/* Empty state */}
        {!loading && orders.length === 0 && (
          <Card className="overflow-hidden">
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8 text-gray-400" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">No Orders Yet</h2>
              <p className="text-sm text-gray-500 mt-2">
                Your orders will appear here after you make a purchase.
              </p>
              <Button
                className="mt-6"
                onClick={() => router.push("/market")}
                leftIcon={<ShoppingBag className="w-4 h-4" />}
              >
                Start Shopping
              </Button>
            </div>
          </Card>
        )}

        {/* Active Orders */}
        {!loading && activeOrders.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              Active Orders ({activeOrders.length})
            </h2>
            <div className="space-y-3">
              {activeOrders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          </div>
        )}

        {/* Completed Orders */}
        {!loading && completedOrders.length > 0 && (
          <div>
            <h2 className="text-sm font-bold text-gray-500 mb-3 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-gray-400" />
              Past Orders ({completedOrders.length})
            </h2>
            <div className="space-y-3">
              {completedOrders.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </div>
          </div>
        )}

        {/* No search results */}
        {!loading && orders.length > 0 && filteredOrders.length === 0 && (
          <Card className="p-6 text-center">
            <p className="text-sm text-gray-500">No orders match your search</p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => setSearchQuery("")}
            >
              Clear Search
            </Button>
          </Card>
        )}

        {/* Continue shopping CTA */}
        {!loading && orders.length > 0 && (
          <Card className="p-4">
            <Button
              variant="secondary"
              className="w-full"
              onClick={() => router.push("/market")}
              leftIcon={<ShoppingBag className="w-4 h-4" />}
            >
              Continue Shopping
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}