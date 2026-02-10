// FILE: src/components/orders/OrderCard.tsx
"use client";

import { memo } from "react";
import Link from "next/link";
import { 
  Package, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Truck,
  XCircle,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/cn";

interface OrderCardProps {
  order: any;
}

function fmtNaira(n: number) {
  return `₦${Number(n || 0).toLocaleString("en-NG")}`;
}

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

function formatDate(v: any) {
  const ms = toMs(v);
  if (!ms) return "";
  
  try {
    const date = new Date(ms);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - ms) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return `Today, ${date.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}`;
    } else if (diffDays === 1) {
      return `Yesterday, ${date.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}`;
    } else if (diffDays < 7) {
      return date.toLocaleDateString("en-NG", { weekday: "short", hour: "2-digit", minute: "2-digit" });
    } else {
      return date.toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" });
    }
  } catch {
    return "";
  }
}

type OrderStatus = "processing" | "paid" | "in_transit" | "delivered" | "cancelled" | "attention";

function getOrderStatus(o: any): { status: OrderStatus; label: string } {
  const orderStatus = String(o?.orderStatus || "").toLowerCase();
  const ops = String(o?.opsStatusEffective || o?.opsStatus || "").toLowerCase();
  const escrow = String(o?.escrowStatus || "").toLowerCase();

  if (ops === "delivered" || orderStatus.includes("delivered")) {
    return { status: "delivered", label: "Delivered" };
  }
  if (ops === "cancelled" || orderStatus.includes("cancel")) {
    return { status: "cancelled", label: "Cancelled" };
  }
  if (ops === "in_transit") {
    return { status: "in_transit", label: "In Transit" };
  }
  if (escrow === "disputed") {
    return { status: "attention", label: "Needs Attention" };
  }
  if (ops === "paid" || orderStatus.includes("paid") || escrow === "released") {
    return { status: "paid", label: "Paid" };
  }

  return { status: "processing", label: "Processing" };
}

const STATUS_CONFIG: Record<OrderStatus, { icon: any; bgColor: string; textColor: string; iconColor: string }> = {
  processing: {
    icon: Clock,
    bgColor: "bg-orange-50",
    textColor: "text-orange-700",
    iconColor: "text-orange-500",
  },
  paid: {
    icon: CheckCircle2,
    bgColor: "bg-blue-50",
    textColor: "text-blue-700",
    iconColor: "text-blue-500",
  },
  in_transit: {
    icon: Truck,
    bgColor: "bg-purple-50",
    textColor: "text-purple-700",
    iconColor: "text-purple-500",
  },
  delivered: {
    icon: CheckCircle2,
    bgColor: "bg-green-50",
    textColor: "text-green-700",
    iconColor: "text-green-500",
  },
  cancelled: {
    icon: XCircle,
    bgColor: "bg-gray-100",
    textColor: "text-gray-600",
    iconColor: "text-gray-400",
  },
  attention: {
    icon: AlertCircle,
    bgColor: "bg-red-50",
    textColor: "text-red-700",
    iconColor: "text-red-500",
  },
};

function getPaymentLabel(o: any) {
  const paymentType = String(o?.paymentType || "");
  if (paymentType === "direct_transfer") return "Bank Transfer";
  if (paymentType === "paystack_escrow") return "Card";
  return "";
}

export const OrderCard = memo(function OrderCard({ order: o }: OrderCardProps) {
  const amount = Number(o.amount || (o.amountKobo ? o.amountKobo / 100 : 0) || 0);
  const { status, label } = getOrderStatus(o);
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const vendor = String(o.businessSlug || "").trim() || "Unknown";
  const paymentLabel = getPaymentLabel(o);
  const itemCount = Array.isArray(o.items) ? o.items.length : 0;
  const dateStr = formatDate(o.createdAt);

  return (
    <Link href={`/orders/${o.id}`} className="block">
      <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:border-orange-200 hover:shadow-md transition-all group">
        <div className="flex items-start gap-4">
          {/* Status Icon */}
          <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shrink-0", config.bgColor)}>
            <Icon className={cn("w-6 h-6", config.iconColor)} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900">
                  Order #{String(o.id).slice(0, 8).toUpperCase()}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  @{vendor} • {itemCount} item{itemCount !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-base font-bold text-gray-900">{fmtNaira(amount)}</p>
              </div>
            </div>

            {/* Status and Payment */}
            <div className="flex items-center gap-2 mt-3">
              <span className={cn(
                "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold",
                config.bgColor, config.textColor
              )}>
                {label}
              </span>
              {paymentLabel && (
                <span className="text-xs text-gray-400">{paymentLabel}</span>
              )}
            </div>

            {/* Date */}
            {dateStr && (
              <p className="text-xs text-gray-400 mt-2">{dateStr}</p>
            )}
          </div>

          {/* Arrow */}
          <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-orange-500 transition shrink-0 self-center" />
        </div>
      </div>
    </Link>
  );
});