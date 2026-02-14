"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { OrderCard } from "@/components/orders/OrderCard";
import { auth } from "@/lib/firebase/client";
import { getRecentOrderIds } from "@/lib/orders/recent";
import { cn } from "@/lib/cn";
import {
  Loader2,
  RefreshCw,
  ShoppingBag,
  Package,
  AlertTriangle,
  LogIn,
} from "lucide-react";

export default function CustomerOrdersPage() {
  const router = useRouter();
  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const lastLoadRef = useRef(0);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setOrders([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }

      // Include localStorage recent IDs as fallback
      const recentIds = getRecentOrderIds();
      const qs = recentIds.length > 0 ? `?recentIds=${encodeURIComponent(recentIds.join(","))}` : "";

      const res = await fetch(`/api/customer/orders${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) throw new Error(data?.error || "Could not load orders.");

      setOrders(Array.isArray(data.orders) ? data.orders : []);
      lastLoadRef.current = Date.now();
    } catch (e: any) {
      setError(e?.message || "Could not load orders.");
      setOrders([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Load when user is ready
  useEffect(() => {
    if (!authLoading && user) load();
  }, [authLoading, user, load]);

  // Refresh on tab focus
  useEffect(() => {
    const onFocus = () => {
      if (Date.now() - lastLoadRef.current > 30000 && user) load(true);
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [load, user]);

  // Not logged in
  if (!authLoading && !user) {
    return (
      <div className="min-h-screen">
        <GradientHeader title="Orders" subtitle="Your purchases" showBack={false} />
        <div className="px-4 pb-28 pt-4">
          <Card className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-4">
              <LogIn className="w-8 h-8 text-orange-500" />
            </div>
            <p className="text-lg font-bold text-gray-900">Sign in to view orders</p>
            <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">
              Log in to see your order history and track deliveries.
            </p>
            <div className="mt-6 space-y-2">
              <Button className="w-full" onClick={() => router.push("/account/login?redirect=/orders")}>
                Sign in
              </Button>
              <Button variant="secondary" className="w-full" onClick={() => router.push("/account/register")}>
                Create account
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Loading
  if (authLoading || loading) {
    return (
      <div className="min-h-screen">
        <GradientHeader title="Orders" subtitle="Loading..." showBack={false} />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28">
      <GradientHeader
        title="Orders"
        subtitle={`${orders.length} order${orders.length !== 1 ? "s" : ""}`}
        showBack={false}
        right={
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn("w-5 h-5 text-biz-ink", refreshing && "animate-spin")} />
          </button>
        }
      />

      <div className="px-4 space-y-3 pt-4">
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

        {!error && orders.length === 0 && (
          <Card className="p-8 text-center">
            <div className="w-20 h-20 rounded-full bg-orange-50 flex items-center justify-center mx-auto mb-5">
              <Package className="w-10 h-10 text-orange-400" />
            </div>
            <p className="text-lg font-bold text-gray-900">No orders yet</p>
            <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">
              When you make a purchase, your orders will appear here.
            </p>
            <div className="mt-6">
              <Button onClick={() => router.push("/market")}>
                <span className="inline-flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4" />
                  Browse marketplace
                </span>
              </Button>
            </div>
          </Card>
        )}

        {orders.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </div>
    </div>
  );
}
