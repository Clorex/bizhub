// FILE: src/app/orders/[orderId]/page.tsx
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  RefreshCw,
  Store,
  Phone,
  Mail,
  MapPin,
  Package,
  CreditCard,
  AlertTriangle,
  AlertCircle,
  Copy,
  Check,
  ChevronRight,
  Loader2,
  ShoppingBag,
} from "lucide-react";

import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { OrderStatusTimeline } from "@/components/orders/OrderStatusTimeline";
import { ReviewForm } from "@/components/reviews/ReviewForm";
import { ReviewStars } from "@/components/reviews/ReviewStars";
import { auth } from "@/lib/firebase/client";
import { toast } from "@/lib/ui/toast";
import { cn } from "@/lib/cn";
import { formatMoneyNGN } from "@/lib/money";

function toMs(v: any) {
  try {
    if (!v) return 0;
    if (typeof v?.toDate === "function") return v.toDate().getTime();
    if (typeof v?.seconds === "number") return v.seconds * 1000;
    if (typeof v === "number") return v;
    return 0;
  } catch {
    return 0;
  }
}

function formatDate(v: any) {
  const ms = toMs(v);
  if (!ms) return "\u2014";
  try {
    return new Date(ms).toLocaleString("en-NG", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "\u2014";
  }
}

function getStatusLabel(o: any): string {
  const orderStatus = String(o?.orderStatus || "").toLowerCase();
  const ops = String(o?.opsStatusEffective || o?.opsStatus || "").toLowerCase();
  const escrow = String(o?.escrowStatus || "").toLowerCase();

  if (ops === "delivered" || orderStatus.includes("delivered")) return "Delivered";
  if (ops === "cancelled" || orderStatus.includes("cancel")) return "Cancelled";
  if (ops === "in_transit") return "In Transit";
  if (ops === "paid" || escrow === "released") return "Paid";
  if (escrow === "disputed") return "Disputed";

  return "Processing";
}

function getPaymentLabel(o: any): string {
  const paymentType = String(o?.paymentType || "");
  if (paymentType === "direct_transfer") return "Bank Transfer";
  if (paymentType === "paystack_escrow") return "Card Payment";
  return "Payment";
}

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const orderId = String((params as any)?.orderId ?? "");

  const [authLoading, setAuthLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [httpStatus, setHttpStatus] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  // Review state
  const [reviewState, setReviewState] = useState<{
    loading: boolean;
    hasReview: boolean;
    canReview: boolean;
    review: any;
  }>({ loading: true, hasReview: false, canReview: false, review: null });

  // Derived data
  const items = useMemo(() => (Array.isArray(order?.items) ? order.items : []), [order]);
  const amount = Number(order?.amount || (order?.amountKobo ? order.amountKobo / 100 : 0) || 0);
  const vendor = String(order?.businessSlug || "").trim();
  const statusLabel = order ? getStatusLabel(order) : "";
  const paymentLabel = order ? getPaymentLabel(order) : "";
  const paymentType = String(order?.paymentType || "");
  const isTransfer = paymentType === "direct_transfer";

  // Auth check
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setAuthLoading(false);
      if (!u) {
        setLoggedIn(false);
        router.replace(`/account/login?next=${encodeURIComponent(`/orders/${orderId}`)}`);
        return;
      }
      setLoggedIn(true);
    });
    return () => unsub();
  }, [router, orderId]);

  // Load order
  const loadOrder = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }
        setError(null);
        setHttpStatus(null);

        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error("Not logged in");

        const r = await fetch(`/api/orders/${encodeURIComponent(orderId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await r.json().catch(() => ({}));

        // ── Distinct error handling ──
        if (r.status === 401) {
          router.replace(
            `/account/login?next=${encodeURIComponent(`/orders/${orderId}`)}`
          );
          return;
        }
        if (r.status === 403) {
          setHttpStatus(403);
          setError(
            data?.error || "You don\u2019t have permission to view this order."
          );
          setOrder(null);
          return;
        }
        if (r.status === 404) {
          setHttpStatus(404);
          setError(data?.error || "This order could not be found.");
          setOrder(null);
          return;
        }
        if (!r.ok) throw new Error(data?.error || "Failed to load order");

        setOrder(data.order || null);
      } catch (e: any) {
        setError(e?.message || "Failed to load order");
        setOrder(null);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orderId, router]
  );

  useEffect(() => {
    if (orderId && loggedIn) {
      loadOrder();
    }
  }, [orderId, loggedIn, loadOrder]);

  // Auto-verify payment from redirect
  useEffect(() => {
    if (!loggedIn || !orderId) return;
    const reference = searchParams.get("tx_ref") ?? searchParams.get("reference");
    if (!reference) return;
    // Auto verification logic would go here if needed
  }, [searchParams, loggedIn, orderId]);

  // Check review status
  useEffect(() => {
    if (!orderId || !loggedIn || !order) return;

    const checkReview = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;

        const r = await fetch(`/api/orders/${encodeURIComponent(orderId)}/review`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await r.json().catch(() => ({}));

        if (data.ok) {
          setReviewState({
            loading: false,
            hasReview: data.hasReview,
            canReview: data.canReview,
            review: data.review,
          });
        } else {
          setReviewState((prev) => ({ ...prev, loading: false }));
        }
      } catch {
        setReviewState((prev) => ({ ...prev, loading: false }));
      }
    };

    checkReview();
  }, [orderId, loggedIn, order]);

  const copyOrderId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(orderId);
      setCopied(true);
      toast.success("Order ID copied!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }, [orderId]);

  const canDispute =
    order?.paymentType === "paystack_escrow" &&
    order?.escrowStatus !== "released" &&
    order?.escrowStatus !== "disputed";

  // Loading state
  if (authLoading || !loggedIn) {
    return (
      <div className="min-h-screen bg-gray-50">
        <GradientHeader title="Order Details" showBack={true} />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <GradientHeader
        title="Order Details"
        subtitle={`#${orderId.slice(0, 8).toUpperCase()}`}
        showBack={true}
        right={
          <button
            onClick={() => loadOrder(true)}
            disabled={refreshing}
            className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 text-white ${refreshing ? "animate-spin" : ""}`} />
          </button>
        }
      />

      <div className="px-4 space-y-4 mt-4">
        {/* Loading */}
        {loading && (
          <Card className="p-8 text-center">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto" />
            <p className="text-sm text-gray-500 mt-3">Loading order details...</p>
          </Card>
        )}

        {/* Error: Not Found / Access Denied / Generic */}
        {!loading && !order && error && (
          <Card className="p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-lg font-bold text-gray-900">
              {httpStatus === 403 ? "Access Denied" : "Order Not Found"}
            </p>
            <p className="text-sm text-gray-500 mt-2">
              {httpStatus === 403
                ? "You don\u2019t have permission to view this order."
                : error}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button size="sm" onClick={() => loadOrder()}>
                Try Again
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => router.push("/orders")}
              >
                All Orders
              </Button>
            </div>
          </Card>
        )}

        {/* Order Content */}
        {!loading && order && (
          <>
            {/* Summary Header */}
            <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />

              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-orange-100">Order Total</p>
                    <p className="text-3xl font-black mt-1">{formatMoneyNGN(amount)}</p>
                  </div>
                  <div
                    className={cn(
                      "px-4 py-2 rounded-xl font-bold text-sm",
                      statusLabel === "Delivered"
                        ? "bg-green-500"
                        : statusLabel === "Cancelled"
                          ? "bg-gray-500"
                          : statusLabel === "Disputed"
                            ? "bg-red-500"
                            : "bg-white/20"
                    )}
                  >
                    {statusLabel}
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-4 text-sm text-orange-100">
                  <div className="flex items-center gap-1.5">
                    <Store className="w-4 h-4" />
                    <span>@{vendor || "Unknown"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4" />
                    <span>{paymentLabel}</span>
                  </div>
                </div>

                <div className="mt-4 flex items-center gap-2">
                  <button
                    onClick={copyOrderId}
                    className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-3 py-2 rounded-lg text-sm font-medium transition"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? "Copied!" : "Copy Order ID"}
                  </button>
                </div>
              </div>
            </div>

            {/* Status Timeline */}
            <SectionCard title="Order Status" subtitle="Track your order progress">
              <OrderStatusTimeline currentStatus={statusLabel} paymentType={paymentType} />
            </SectionCard>

            {/* Items */}
            <SectionCard title="Items" subtitle={`${items.length} item${items.length !== 1 ? "s" : ""}`}>
              <div className="space-y-3">
                {items.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center gap-4 bg-white rounded-xl border border-gray-100 p-4"
                  >
                    <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                      {item?.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.imageUrl}
                          alt={item.name}
                          className="w-full h-full object-cover rounded-xl"
                        />
                      ) : (
                        <Package className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {item?.name || "Item"}
                      </p>
                      {item?.selectedOptions && Object.keys(item.selectedOptions).length > 0 && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {Object.entries(item.selectedOptions)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(" \u2022 ")}
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">Qty: {item?.qty || 1}</p>
                    </div>
                    <p className="text-sm font-bold text-gray-900 shrink-0">
                      {formatMoneyNGN(Number(item?.price || 0))}
                    </p>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Delivery Info */}
            <SectionCard title="Delivery Details" subtitle="Where your order is going">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                    <Package className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Full Name</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {order?.customer?.fullName || "\u2014"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {order?.customer?.phone || "\u2014"}
                    </p>
                  </div>
                </div>

                {order?.customer?.email && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center">
                      <Mail className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="text-sm font-semibold text-gray-900">{order.customer.email}</p>
                    </div>
                  </div>
                )}

                {order?.customer?.address && (
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5 text-gray-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Address</p>
                      <p className="text-sm font-semibold text-gray-900">{order.customer.address}</p>
                    </div>
                  </div>
                )}
              </div>
            </SectionCard>

            {/* Order Info */}
            <SectionCard title="Order Info" subtitle="Additional details">
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500">Order ID</span>
                  <span className="text-sm font-mono font-semibold text-gray-900">
                    {orderId.slice(0, 12)}...
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500">Placed on</span>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatDate(order.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-500">Payment Method</span>
                  <span className="text-sm font-semibold text-gray-900">{paymentLabel}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-gray-500">Vendor</span>
                  <button
                    onClick={() => router.push(`/b/${vendor}`)}
                    className="text-sm font-semibold text-orange-600 flex items-center gap-1"
                  >
                    @{vendor}
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </SectionCard>

            {/* Review Section */}
            {!reviewState.loading && (
              <>
                {reviewState.hasReview && reviewState.review && (
                  <SectionCard title="Your Review" subtitle="Thank you for your feedback">
                    <div className="p-4 bg-green-50 rounded-2xl border border-green-200">
                      <div className="flex items-center gap-3 mb-2">
                        <ReviewStars rating={reviewState.review.rating} size="md" />
                        <span className="text-sm font-bold text-green-700">
                          {reviewState.review.rating === 5
                            ? "Excellent!"
                            : reviewState.review.rating === 4
                              ? "Good"
                              : reviewState.review.rating === 3
                                ? "Average"
                                : reviewState.review.rating === 2
                                  ? "Poor"
                                  : "Very Bad"}
                        </span>
                      </div>
                      {reviewState.review.comment && (
                        <p className="text-sm text-gray-600 mt-2">
                          &ldquo;{reviewState.review.comment}&rdquo;
                        </p>
                      )}
                    </div>
                  </SectionCard>
                )}

                {!reviewState.hasReview && reviewState.canReview && (
                  <SectionCard title="Rate This Order" subtitle="Share your experience">
                    <ReviewForm
                      orderId={orderId}
                      onSuccess={() =>
                        setReviewState({
                          loading: false,
                          hasReview: true,
                          canReview: false,
                          review: null,
                        })
                      }
                    />
                  </SectionCard>
                )}
              </>
            )}

            {/* Actions */}
            <div className="space-y-3">
              {vendor && (
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => router.push(`/b/${vendor}`)}
                  leftIcon={<Store className="w-4 h-4" />}
                >
                  Visit Store
                </Button>
              )}

              {canDispute && (
                <Button
                  variant="secondary"
                  className="w-full border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => router.push(`/orders/${orderId}/dispute`)}
                  leftIcon={<AlertTriangle className="w-4 h-4" />}
                >
                  Report an Issue
                </Button>
              )}

              <Button
                className="w-full"
                onClick={() => router.push("/market")}
                leftIcon={<ShoppingBag className="w-4 h-4" />}
              >
                Continue Shopping
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}