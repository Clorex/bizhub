"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { auth } from "@/lib/firebase/client";
import { formatMoneyNGN } from "@/lib/money";
import {
  Loader2,
  AlertTriangle,
  Package,
  CreditCard,
  ShoppingBag,
  ExternalLink,
} from "lucide-react";

function toMs(v: any) {
  try {
    if (!v) return 0;
    if (typeof v === "number") return v;
    if (typeof v?.toDate === "function") return v.toDate().getTime();
    if (typeof v?.seconds === "number") return v.seconds * 1000;
    if (typeof v?._seconds === "number") return v._seconds * 1000;
    if (typeof v === "string") { const d = new Date(v); return isNaN(d.getTime()) ? 0 : d.getTime(); }
    return 0;
  } catch { return 0; }
}

function fmtDate(v: any) {
  const ms = toMs(v);
  if (!ms) return "\u2014";
  try {
    return new Date(ms).toLocaleString("en-NG", {
      month: "short", day: "numeric", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return "\u2014"; }
}

function getStatusLabel(o: any) {
  const s = String(o?.opsStatus || o?.orderStatus || "processing").toLowerCase();
  const map: Record<string, string> = {
    new: "Processing",
    contacted: "Contacted",
    paid: "Paid",
    in_transit: "In Transit",
    delivered: "Delivered",
    cancelled: "Cancelled",
    awaiting_confirmation: "Awaiting Confirmation",
  };
  return map[s] || s.charAt(0).toUpperCase() + s.slice(1);
}

export default function CustomerOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params?.orderId as string;

  const [authLoading, setAuthLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/account/login?redirect=/orders/" + orderId);
      return;
    }

    async function fetchOrder() {
      setLoading(true);
      setError(null);
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/customer/orders/" + orderId, {
          headers: { Authorization: "Bearer " + token },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Could not load order.");
        setOrder(data.order || null);
      } catch (e: any) {
        setError(e?.message || "Could not load order.");
      } finally {
        setLoading(false);
      }
    }

    fetchOrder();
  }, [authLoading, user, orderId, router]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen">
        <GradientHeader title="Order" subtitle="Loading..." showBack />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen">
        <GradientHeader title="Order" subtitle="Error" showBack />
        <div className="px-4 pb-28 pt-4">
          <Card className="p-6 text-center">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-base font-bold text-gray-900">Could not load order</p>
            <p className="text-sm text-gray-500 mt-1">{error || "Order not found."}</p>
            <div className="mt-4">
              <Button onClick={() => router.push("/orders")}>Back to Orders</Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  const amount = Number(order.amount || (order.amountKobo ? order.amountKobo / 100 : 0) || 0);
  const items = Array.isArray(order.items) ? order.items : [];
  const statusLabel = getStatusLabel(order);
  const displayNo = order.displayOrderRef || (order.orderNumber ? "#" + String(order.orderNumber).padStart(4, "0") : "#" + String(order.id || "").slice(0, 8).toUpperCase());

  return (
    <div className="min-h-screen pb-28">
      <GradientHeader title={"Order " + displayNo} subtitle={statusLabel} showBack />

      <div className="px-4 space-y-3 pt-4">
        <Card className="p-4">
          <p className="text-sm font-extrabold text-biz-ink">Status</p>
          <div className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-50 text-orange-700 text-sm font-bold">
            <Package className="w-4 h-4" />
            {statusLabel}
          </div>
          <p className="text-xs text-biz-muted mt-2">Ordered: {fmtDate(order.createdAtMs || order.createdAt)}</p>
        </Card>

        <Card className="p-4">
          <p className="text-sm font-extrabold text-biz-ink mb-3">Items ({items.length})</p>
          <div className="space-y-3">
            {items.map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-3">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="w-14 h-14 rounded-xl object-cover shrink-0" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                    <ShoppingBag className="w-5 h-5 text-gray-400" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{item.name}</p>
                  <p className="text-xs text-gray-500">Qty: {item.qty || 1}</p>
                  {item.selectedOptions && Object.keys(item.selectedOptions).length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {Object.entries(item.selectedOptions).map(([k, v]) => k + ": " + v).join(", ")}
                    </p>
                  )}
                </div>
                <p className="text-sm font-bold text-gray-900 shrink-0">
                  {formatMoneyNGN(Number(item.price || 0) * Number(item.qty || 1))}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between">
            <p className="text-sm font-extrabold text-biz-ink">Total</p>
            <p className="text-lg font-extrabold text-orange-600">{formatMoneyNGN(amount)}</p>
          </div>
        </Card>

        <Card className="p-4">
          <p className="text-sm font-extrabold text-biz-ink mb-2">Payment</p>
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-gray-400" />
            <p className="text-sm text-gray-700">
              {order.paymentType === "direct_transfer" ? "Bank Transfer" :
               order.paymentType === "chat_whatsapp" ? "WhatsApp Order" :
               order.paymentType === "paystack_escrow" ? "Card Payment" : "Payment"}
            </p>
          </div>
        </Card>

        {order.businessSlug && (
          <Card className="p-4">
            <Button variant="secondary" className="w-full" onClick={() => router.push("/b/" + order.businessSlug)}>
              <span className="inline-flex items-center gap-2">
                <ExternalLink className="w-4 h-4" />
                Visit store
              </span>
            </Button>
          </Card>
        )}

        <Card className="p-4">
          <p className="text-xs text-gray-500">
            Having an issue?{" "}
            <button
              onClick={() => router.push("/orders/" + order.id + "/dispute")}
              className="text-orange-600 font-bold hover:underline"
            >
              Open a dispute
            </button>
          </p>
        </Card>
      </div>
    </div>
  );
}