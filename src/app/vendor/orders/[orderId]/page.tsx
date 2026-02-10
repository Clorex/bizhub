"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { OrderStatusPill } from "@/components/vendor/OrderStatusPill";
import { OrderStatusTimeline } from "@/components/vendor/OrderStatusTimeline";
import { DetailSkeleton } from "@/components/vendor/PageSkeleton";
import { auth } from "@/lib/firebase/client";
import { toast } from "@/lib/ui/toast";
import { cn } from "@/lib/cn";
import { cloudinaryOptimizedUrl } from "@/lib/cloudinary/url";

import {
  RefreshCw,
  Banknote,
  MessageCircle,
  AlertTriangle,
  Phone,
  Mail,
  MapPin,
  Truck,
  Package,
  ChevronRight,
  Copy,
  CheckCircle2,
  Clock,
  User,
  CreditCard,
  Calendar,
  Hash,
  ExternalLink,
  FileText,
  Download,
  Printer,
  MoreHorizontal,
  X,
  ArrowRight,
  Shield,
  Star,
  Receipt,
  Navigation,
  Building2,
  Sparkles,
  AlertCircle,
  XCircle,
  CheckCircle,
  CircleDot,
  Loader2,
  Send,
  Image as ImageIcon,
} from "lucide-react";

/* ─────────────────────── Types ─────────────────────── */

type OpsStatus = "new" | "contacted" | "paid" | "in_transit" | "delivered" | "cancelled";

interface OrderItem {
  id?: string;
  productId?: string;
  name: string;
  price: number;
  quantity: number;
  variant?: string;
  image?: string;
}

interface Customer {
  fullName?: string;
  name?: string;
  email?: string;
  phone?: string;
}

interface Shipping {
  method?: string;
  address?: string;
  city?: string;
  state?: string;
  fee?: number;
  trackingNumber?: string;
  carrier?: string;
}

/* ─────────────────────── Helpers ─────────────────────── */

function fmtNaira(n: number): string {
  if (typeof n !== "number" || isNaN(n)) return "₦0";
  return `₦${n.toLocaleString("en-NG")}`;
}

function fmtDate(v: any, options?: { includeTime?: boolean }): string {
  try {
    if (!v) return "—";
    
    let date: Date;
    if (typeof v?.toDate === "function") {
      date = v.toDate();
    } else if (typeof v === "string" || typeof v === "number") {
      date = new Date(v);
    } else {
      return String(v);
    }

    if (isNaN(date.getTime())) return "—";

    if (options?.includeTime) {
      return date.toLocaleString("en-NG", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }

    return date.toLocaleDateString("en-NG", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function fmtRelativeTime(v: any): string {
  try {
    if (!v) return "";
    
    let date: Date;
    if (typeof v?.toDate === "function") {
      date = v.toDate();
    } else {
      date = new Date(v);
    }

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
    
    return fmtDate(date);
  } catch {
    return "";
  }
}

function getPhoneDigits(phone: string): string {
  return String(phone || "").replace(/[^\d]/g, "");
}

function getStatusColor(status: string): { bg: string; text: string; border: string } {
  const s = status.toLowerCase();
  const colors: Record<string, { bg: string; text: string; border: string }> = {
    new: { bg: "bg-orange-500", text: "text-white", border: "border-orange-500" },
    contacted: { bg: "bg-blue-500", text: "text-white", border: "border-blue-500" },
    paid: { bg: "bg-green-500", text: "text-white", border: "border-green-500" },
    in_transit: { bg: "bg-purple-500", text: "text-white", border: "border-purple-500" },
    delivered: { bg: "bg-emerald-500", text: "text-white", border: "border-emerald-500" },
    cancelled: { bg: "bg-gray-500", text: "text-white", border: "border-gray-500" },
    disputed: { bg: "bg-red-500", text: "text-white", border: "border-red-500" },
  };
  return colors[s] || colors.new;
}

/* ─────────────────────── Status Flow Data ─────────────────────── */

const STATUS_FLOW: { key: OpsStatus; label: string; icon: any; description: string }[] = [
  { key: "new", label: "New", icon: Sparkles, description: "Order received" },
  { key: "contacted", label: "Contacted", icon: MessageCircle, description: "Customer contacted" },
  { key: "paid", label: "Paid", icon: CheckCircle2, description: "Payment confirmed" },
  { key: "in_transit", label: "In Transit", icon: Truck, description: "Order shipped" },
  { key: "delivered", label: "Delivered", icon: Package, description: "Order completed" },
];

/* ─────────────────────── Main Component ─────────────────────── */

export default function VendorOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = String(params?.orderId || "");

  // State
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Status update
  const [updating, setUpdating] = useState(false);
  const [showStatusSheet, setShowStatusSheet] = useState(false);

  // Action sheet
  const [showActionSheet, setShowActionSheet] = useState(false);

  // Copy state
  const [copied, setCopied] = useState<string | null>(null);

  /* ─────── Load Order ─────── */
  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Please log in to view this order.");

      const r = await fetch(`/api/vendor/orders/${encodeURIComponent(orderId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json().catch(() => ({}));

      if (!r.ok) throw new Error(data?.error || "Could not load order.");

      setOrder(data.order || null);

      if (isRefresh) {
        toast.success("Order refreshed!");
      }
    } catch (e: any) {
      setError(e?.message || "Could not load order.");
      setOrder(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (orderId) {
      load();
    } else {
      setError("Invalid order ID");
      setLoading(false);
    }
  }, [orderId, load]);

  /* ─────── Update Status ─────── */
  const updateStatus = useCallback(async (newStatus: OpsStatus) => {
    setUpdating(true);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Please log in again.");

      const r = await fetch(`/api/vendor/orders/${encodeURIComponent(orderId)}/status`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ opsStatus: newStatus }),
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok) throw new Error(data?.error || "Could not update status.");

      toast.success(`Status updated to "${newStatus}"`);
      setShowStatusSheet(false);
      await load(true);
    } catch (e: any) {
      toast.error(e?.message || "Could not update status.");
    } finally {
      setUpdating(false);
    }
  }, [orderId, load]);

  /* ─────── Copy to Clipboard ─────── */
  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      toast.success(`${label} copied!`);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }, []);

  /* ─────── Derived Data ─────── */
  const currentStatus = useMemo(() => {
    return String(order?.opsStatusEffective || order?.opsStatus || "new") as OpsStatus;
  }, [order]);

  const amount = useMemo(() => {
    if (!order) return 0;
    return Number(order.amount || (order.amountKobo ? order.amountKobo / 100 : 0) || 0);
  }, [order]);

  const items: OrderItem[] = useMemo(() => {
    return Array.isArray(order?.items) ? order.items : [];
  }, [order]);

  const customer: Customer = useMemo(() => {
    return order?.customer || {};
  }, [order]);

  const shipping: Shipping = useMemo(() => {
    return order?.shipping || {};
  }, [order]);

  const subtotal = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.price || 0) * (item.quantity || 1), 0);
  }, [items]);

  const shippingFee = useMemo(() => {
    return Number(shipping.fee) || 0;
  }, [shipping]);

  const whatsappLink = useMemo(() => {
    const phone = getPhoneDigits(customer.phone || "");
    if (!phone) return null;
    const message = `Hi ${customer.fullName || customer.name || "there"}! Regarding your order #${orderId.slice(0, 8)} for ${fmtNaira(amount)}...`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  }, [customer, orderId, amount]);

  const callLink = useMemo(() => {
    const phone = getPhoneDigits(customer.phone || "");
    return phone ? `tel:${phone}` : null;
  }, [customer]);

  const emailLink = useMemo(() => {
    if (!customer.email) return null;
    const subject = `Order #${orderId.slice(0, 8)}`;
    return `mailto:${customer.email}?subject=${encodeURIComponent(subject)}`;
  }, [customer, orderId]);

  const isDisputed = order?.disputeStatus === "open" || order?.hasDispute;
  const paymentType = order?.paymentType || order?.paymentMethod || "card";
  const isDirectTransfer = paymentType === "direct_transfer";

  /* ─────── Render Loading ─────── */
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <GradientHeader
          title="Order Details"
          subtitle="Loading..."
          showBack={true}
        />
        <DetailSkeleton />
      </div>
    );
  }

  /* ─────── Render Error ─────── */
  if (error || !order) {
    return (
      <div className="min-h-screen bg-gray-50">
        <GradientHeader
          title="Order Details"
          subtitle="Error"
          showBack={true}
        />
        <div className="px-4 pt-4 space-y-4">
          <Card className="p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <p className="text-lg font-bold text-gray-900">Order Not Found</p>
            <p className="text-sm text-gray-500 mt-2">
              {error || "This order doesn't exist or you don't have access."}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button onClick={() => load()}>
                Try Again
              </Button>
              <Button variant="secondary" onClick={() => router.push("/vendor/orders")}>
                All Orders
              </Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  /* ─────── Render Order ─────── */
  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      {/* Header */}
      <GradientHeader
        title={`#${orderId.slice(0, 8).toUpperCase()}`}
        subtitle={fmtRelativeTime(order.createdAt)}
        showBack={true}
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={cn("w-5 h-5 text-white", refreshing && "animate-spin")} />
            </button>
            <button
              onClick={() => setShowActionSheet(true)}
              className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition"
              aria-label="More actions"
            >
              <MoreHorizontal className="w-5 h-5 text-white" />
            </button>
          </div>
        }
      />

      <div className="px-4 space-y-4 pt-4">
        {/* Dispute Warning */}
        {isDisputed && (
          <Card className="p-4 bg-red-50 border-red-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-red-800">Order Disputed</p>
                <p className="text-xs text-red-600 mt-0.5">
                  This order has an active dispute. Please resolve it as soon as possible.
                </p>
                <Button
                  size="sm"
                  className="mt-3 bg-red-600 hover:bg-red-700"
                  onClick={() => router.push(`/vendor/orders/${orderId}/dispute`)}
                  rightIcon={<ChevronRight className="w-4 h-4" />}
                >
                  View Dispute
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Order Amount Hero */}
        <div className="bg-gradient-to-br from-orange-500 via-orange-500 to-orange-600 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
          <div className="absolute top-1/2 right-8 w-20 h-20 bg-white/5 rounded-full" />

          <div className="relative z-10">
            {/* Status Badge */}
            <div className="flex items-center justify-between mb-4">
              <OrderStatusPill status={currentStatus} size="md" />
              {isDirectTransfer && (
                <span className="px-3 py-1 rounded-full bg-white/20 text-xs font-bold">
                  Direct Transfer
                </span>
              )}
            </div>

            {/* Amount */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-orange-100 mb-1">
                Order Total
              </p>
              <p className="text-4xl font-black tracking-tight">{fmtNaira(amount)}</p>
            </div>

            {/* Meta Info */}
            <div className="mt-4 flex flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-orange-200" />
                <span className="text-sm text-orange-100">
                  {fmtDate(order.createdAt, { includeTime: true })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-orange-200" />
                <span className="text-sm text-orange-100">
                  {items.length} item{items.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Order ID Copy */}
            <button
              onClick={() => copyToClipboard(orderId, "Order ID")}
              className="mt-4 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/20 hover:bg-white/30 transition"
            >
              <Hash className="w-4 h-4" />
              <span className="text-sm font-mono">{orderId.slice(0, 12)}...</span>
              {copied === "Order ID" ? (
                <CheckCircle2 className="w-4 h-4 text-green-300" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {/* Status Progress */}
        <SectionCard
          title="Order Progress"
          subtitle="Update order status"
          right={
            <button
              onClick={() => setShowStatusSheet(true)}
              className="text-xs font-bold text-orange-600 flex items-center gap-1"
            >
              Change
              <ChevronRight className="w-4 h-4" />
            </button>
          }
        >
          <div className="relative">
            {/* Progress Line */}
            <div className="absolute left-5 top-5 bottom-5 w-0.5 bg-gray-200" />
            
            {/* Progress Fill */}
            {(() => {
              const currentIndex = STATUS_FLOW.findIndex(s => s.key === currentStatus);
              const fillHeight = currentIndex >= 0 ? `${(currentIndex / (STATUS_FLOW.length - 1)) * 100}%` : "0%";
              return (
                <div
                  className="absolute left-5 top-5 w-0.5 bg-orange-500 transition-all duration-500"
                  style={{ height: fillHeight }}
                />
              );
            })()}

            {/* Status Steps */}
            <div className="relative space-y-1">
              {STATUS_FLOW.map((step, idx) => {
                const currentIndex = STATUS_FLOW.findIndex(s => s.key === currentStatus);
                const isPast = idx < currentIndex;
                const isCurrent = step.key === currentStatus;
                const isFuture = idx > currentIndex;
                const Icon = step.icon;

                return (
                  <div
                    key={step.key}
                    className={cn(
                      "flex items-center gap-4 p-3 rounded-2xl transition-all",
                      isCurrent && "bg-orange-50 border border-orange-200",
                      !isCurrent && "hover:bg-gray-50"
                    )}
                  >
                    <div
                      className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all relative z-10",
                        isPast && "bg-orange-500 text-white",
                        isCurrent && "bg-orange-500 text-white ring-4 ring-orange-100",
                        isFuture && "bg-gray-100 text-gray-400"
                      )}
                    >
                      {isPast ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p
                        className={cn(
                          "text-sm font-semibold",
                          isCurrent ? "text-orange-700" : isPast ? "text-gray-900" : "text-gray-400"
                        )}
                      >
                        {step.label}
                      </p>
                      <p
                        className={cn(
                          "text-xs mt-0.5",
                          isCurrent ? "text-orange-600" : "text-gray-500"
                        )}
                      >
                        {step.description}
                      </p>
                    </div>
                    {isCurrent && (
                      <span className="px-2 py-1 rounded-full bg-orange-500 text-white text-[10px] font-bold">
                        CURRENT
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Cancelled state (if applicable) */}
              {currentStatus === "cancelled" && (
                <div className="flex items-center gap-4 p-3 rounded-2xl bg-gray-100">
                  <div className="w-10 h-10 rounded-xl bg-gray-500 text-white flex items-center justify-center shrink-0">
                    <XCircle className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-700">Cancelled</p>
                    <p className="text-xs text-gray-500">Order was cancelled</p>
                  </div>
                  <span className="px-2 py-1 rounded-full bg-gray-500 text-white text-[10px] font-bold">
                    FINAL
                  </span>
                </div>
              )}
            </div>
          </div>
        </SectionCard>

        {/* Quick Contact */}
        <SectionCard title="Contact Customer" subtitle="Reach out to the buyer">
          <div className="grid grid-cols-3 gap-3">
            {whatsappLink && (
              <button
                onClick={() => window.open(whatsappLink, "_blank")}
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-green-50 hover:bg-green-100 border border-green-200 transition"
              >
                <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center mb-2">
                  <MessageCircle className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-bold text-green-700">WhatsApp</span>
              </button>
            )}
            {callLink && (
              <button
                onClick={() => window.open(callLink, "_blank")}
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-blue-50 hover:bg-blue-100 border border-blue-200 transition"
              >
                <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center mb-2">
                  <Phone className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-bold text-blue-700">Call</span>
              </button>
            )}
            {emailLink && (
              <button
                onClick={() => window.open(emailLink, "_blank")}
                className="flex flex-col items-center justify-center p-4 rounded-2xl bg-purple-50 hover:bg-purple-100 border border-purple-200 transition"
              >
                <div className="w-12 h-12 rounded-xl bg-purple-500 flex items-center justify-center mb-2">
                  <Mail className="w-6 h-6 text-white" />
                </div>
                <span className="text-xs font-bold text-purple-700">Email</span>
              </button>
            )}
          </div>

          {/* Customer Card */}
          <div className="mt-4 p-4 rounded-2xl bg-white border border-gray-100">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shrink-0">
                <span className="text-lg font-bold text-white">
                  {(customer.fullName || customer.name || "A")[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold text-gray-900">
                  {customer.fullName || customer.name || "Anonymous"}
                </p>
                {customer.email && (
                  <p className="text-sm text-gray-500 mt-1 truncate">{customer.email}</p>
                )}
                {customer.phone && (
                  <button
                    onClick={() => copyToClipboard(customer.phone!, "Phone")}
                    className="flex items-center gap-1.5 mt-1 text-sm text-gray-600 hover:text-orange-600"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    {customer.phone}
                    {copied === "Phone" ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Order Items */}
        <SectionCard
          title="Order Items"
          subtitle={`${items.length} item${items.length !== 1 ? "s" : ""}`}
        >
          <div className="space-y-3">
            {items.map((item, idx) => {
              const itemImg = item.image ? cloudinaryOptimizedUrl(item.image, { w: 120, h: 120 }) : "";
              const itemTotal = (item.price || 0) * (item.quantity || 1);

              return (
                <div
                  key={idx}
                  className="flex items-start gap-4 p-4 rounded-2xl bg-white border border-gray-100"
                >
                  {/* Image */}
                  <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                    {itemImg ? (
                      <img
                        src={itemImg}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-6 h-6 text-gray-300" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 line-clamp-2">
                      {item.name || "Product"}
                    </p>
                    {item.variant && (
                      <p className="text-xs text-gray-500 mt-1">
                        Variant: {item.variant}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-500">
                        {fmtNaira(item.price || 0)} × {item.quantity || 1}
                      </p>
                      <p className="text-sm font-bold text-gray-900">
                        {fmtNaira(itemTotal)}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Order Summary */}
          <div className="mt-4 p-4 rounded-2xl bg-gray-50 border border-gray-100 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Subtotal</span>
              <span className="font-medium text-gray-900">{fmtNaira(subtotal)}</span>
            </div>
            {shippingFee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Shipping</span>
                <span className="font-medium text-gray-900">{fmtNaira(shippingFee)}</span>
              </div>
            )}
            <div className="pt-3 border-t border-gray-200 flex justify-between">
              <span className="text-base font-bold text-gray-900">Total</span>
              <span className="text-base font-black text-orange-600">{fmtNaira(amount)}</span>
            </div>
          </div>
        </SectionCard>

        {/* Shipping Details */}
        {(shipping.address || shipping.method) && (
          <SectionCard title="Shipping Details" subtitle="Delivery information">
            <div className="p-4 rounded-2xl bg-white border border-gray-100 space-y-4">
              {shipping.method && (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center shrink-0">
                    <Truck className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Method</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">{shipping.method}</p>
                  </div>
                </div>
              )}

              {shipping.address && (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <MapPin className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Address</p>
                    <p className="text-sm font-semibold text-gray-900 mt-0.5">{shipping.address}</p>
                    {(shipping.city || shipping.state) && (
                      <p className="text-sm text-gray-600 mt-0.5">
                        {[shipping.city, shipping.state].filter(Boolean).join(", ")}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => copyToClipboard(shipping.address!, "Address")}
                    className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200"
                  >
                    {copied === "Address" ? (
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4 text-gray-500" />
                    )}
                  </button>
                </div>
              )}

              {shipping.trackingNumber && (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                    <Navigation className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Tracking</p>
                    <p className="text-sm font-mono font-semibold text-gray-900 mt-0.5">
                      {shipping.trackingNumber}
                    </p>
                    {shipping.carrier && (
                      <p className="text-xs text-gray-500 mt-0.5">{shipping.carrier}</p>
                    )}
                  </div>
                </div>
              )}

              {shippingFee > 0 && (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
                    <Banknote className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase tracking-wide">Shipping Fee</p>
                    <p className="text-sm font-bold text-gray-900 mt-0.5">{fmtNaira(shippingFee)}</p>
                  </div>
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {/* Payment Info */}
        <SectionCard title="Payment" subtitle="Payment information">
          <div className="p-4 rounded-2xl bg-white border border-gray-100">
            <div className="flex items-center gap-4">
              <div
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                  isDirectTransfer ? "bg-blue-50" : "bg-green-50"
                )}
              >
                {isDirectTransfer ? (
                  <Building2 className="w-6 h-6 text-blue-600" />
                ) : (
                  <CreditCard className="w-6 h-6 text-green-600" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900 capitalize">
                  {paymentType.replace(/_/g, " ")}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {isDirectTransfer ? "Bank transfer payment" : "Card payment via Paystack"}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold text-gray-900">{fmtNaira(amount)}</p>
                <p className="text-xs text-green-600 font-medium mt-0.5">Paid</p>
              </div>
            </div>

            {/* Transfer proof for direct transfers */}
            {isDirectTransfer && order.transferProof && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <p className="text-xs text-gray-500 mb-2">Payment Proof</p>
                <button
                  onClick={() => window.open(order.transferProof, "_blank")}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 hover:bg-gray-100 transition"
                >
                  <ImageIcon className="w-4 h-4 text-gray-500" />
                  <span className="text-sm text-gray-700">View Screenshot</span>
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            )}
          </div>
        </SectionCard>

        {/* Timeline */}
        <SectionCard title="Activity Timeline" subtitle="Order history">
          <OrderStatusTimeline order={order} />
        </SectionCard>
      </div>

      {/* Status Change Bottom Sheet */}
      {showStatusSheet && (
        <div className="fixed inset-0 z-50 bg-black/50">
          <div className="absolute inset-0" onClick={() => setShowStatusSheet(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-w-[430px] mx-auto">
            <div className="bg-white rounded-t-3xl overflow-hidden safe-pb">
              {/* Header */}
              <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <p className="text-base font-bold text-gray-900">Update Status</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Change order progress
                  </p>
                </div>
                <button
                  onClick={() => setShowStatusSheet(false)}
                  className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200"
                >
                  <X className="w-5 h-5 text-gray-600" />
                </button>
              </div>

              {/* Status Options */}
              <div className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
                {STATUS_FLOW.map((status) => {
                  const Icon = status.icon;
                  const isActive = currentStatus === status.key;

                  return (
                    <button
                      key={status.key}
                      onClick={() => !isActive && updateStatus(status.key)}
                      disabled={updating || isActive}
                      className={cn(
                        "w-full flex items-center gap-4 p-4 rounded-2xl border transition",
                        isActive
                          ? "bg-orange-50 border-orange-200"
                          : "bg-white border-gray-100 hover:border-orange-200 hover:bg-orange-50/50"
                      )}
                    >
                      <div
                        className={cn(
                          "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                          isActive ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600"
                        )}
                      >
                        <Icon className="w-6 h-6" />
                      </div>
                      <div className="flex-1 text-left">
                        <p
                          className={cn(
                            "text-sm font-semibold",
                            isActive ? "text-orange-700" : "text-gray-900"
                          )}
                        >
                          {status.label}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">{status.description}</p>
                      </div>
                      {isActive && (
                        <CheckCircle2 className="w-6 h-6 text-orange-500 shrink-0" />
                      )}
                      {updating && !isActive && (
                        <Loader2 className="w-5 h-5 text-gray-400 animate-spin shrink-0" />
                      )}
                    </button>
                  );
                })}

                {/* Cancel Option */}
                <button
                  onClick={() => updateStatus("cancelled")}
                  disabled={updating || currentStatus === "cancelled"}
                  className={cn(
                    "w-full flex items-center gap-4 p-4 rounded-2xl border transition",
                    currentStatus === "cancelled"
                      ? "bg-gray-100 border-gray-200"
                      : "bg-white border-gray-100 hover:border-red-200 hover:bg-red-50"
                  )}
                >
                  <div
                    className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                      currentStatus === "cancelled" ? "bg-gray-500 text-white" : "bg-red-100 text-red-600"
                    )}
                  >
                    <XCircle className="w-6 h-6" />
                  </div>
                  <div className="flex-1 text-left">
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        currentStatus === "cancelled" ? "text-gray-700" : "text-red-700"
                      )}
                    >
                      Cancel Order
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">Mark as cancelled</p>
                  </div>
                  {currentStatus === "cancelled" && (
                    <CheckCircle2 className="w-6 h-6 text-gray-500 shrink-0" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Action Sheet */}
      {showActionSheet && (
        <div className="fixed inset-0 z-50 bg-black/50">
          <div className="absolute inset-0" onClick={() => setShowActionSheet(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-w-[430px] mx-auto">
            <div className="bg-white rounded-t-3xl overflow-hidden safe-pb">
              <div className="p-4 border-b border-gray-100">
                <p className="text-base font-bold text-gray-900 text-center">Actions</p>
              </div>

              <div className="p-2">
                <button
                  onClick={() => {
                    copyToClipboard(orderId, "Order ID");
                    setShowActionSheet(false);
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 transition"
                >
                  <Copy className="w-5 h-5 text-gray-500" />
                  <span className="text-sm font-medium text-gray-900">Copy Order ID</span>
                </button>

                {whatsappLink && (
                  <button
                    onClick={() => {
                      window.open(whatsappLink, "_blank");
                      setShowActionSheet(false);
                    }}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 transition"
                  >
                    <MessageCircle className="w-5 h-5 text-green-600" />
                    <span className="text-sm font-medium text-gray-900">WhatsApp Customer</span>
                  </button>
                )}

                <button
                  onClick={() => {
                    router.push(`/vendor/orders/${orderId}/dispute`);
                    setShowActionSheet(false);
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 transition"
                >
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  <span className="text-sm font-medium text-gray-900">View/Create Dispute</span>
                </button>

                <button
                  onClick={() => {
                    // Could implement print/download receipt
                    toast.info("Receipt download coming soon!");
                    setShowActionSheet(false);
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-gray-50 transition"
                >
                  <Receipt className="w-5 h-5 text-gray-500" />
                  <span className="text-sm font-medium text-gray-900">Download Receipt</span>
                </button>
              </div>

              <div className="p-4 border-t border-gray-100">
                <Button
                  variant="secondary"
                  onClick={() => setShowActionSheet(false)}
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}