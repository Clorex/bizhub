"use client";

import { memo } from "react";
import Link from "next/link";
import { Clock, CheckCircle2, AlertCircle, Truck, XCircle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatMoneyNGN } from "@/lib/money";

interface OrderCardProps { order: any; }

function padOrderNumber(n: any, width = 4) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v <= 0) return "";
  return String(v).padStart(width, "0");
}

function toMs(v: any) {
  try {
    if (!v) return 0;
    if (typeof v?.toDate === "function") return v.toDate().getTime();
    if (typeof v?.seconds === "number") return v.seconds * 1000;
    return 0;
  } catch { return 0; }
}

function formatDate(v: any) {
  const ms = toMs(v);
  if (!ms) return "";
  try {
    const date = new Date(ms);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - ms) / 86400000);
    if (diffDays === 0) return `Today, ${date.toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}`;
    if (diffDays === 1) return `Yesterday`;
    if (diffDays < 7) return date.toLocaleDateString("en-NG", { weekday: "short" });
    return date.toLocaleDateString("en-NG", { month: "short", day: "numeric" });
  } catch { return ""; }
}

type OrderStatus = "processing" | "paid" | "in_transit" | "delivered" | "cancelled" | "attention";

function getOrderStatus(o: any): { status: OrderStatus; label: string } {
  const ops = String(o?.opsStatusEffective || o?.opsStatus || "").toLowerCase();
  const escrow = String(o?.escrowStatus || "").toLowerCase();
  if (ops === "delivered") return { status: "delivered", label: "Delivered" };
  if (ops === "cancelled") return { status: "cancelled", label: "Cancelled" };
  if (ops === "in_transit") return { status: "in_transit", label: "In Transit" };
  if (escrow === "disputed") return { status: "attention", label: "Disputed" };
  if (ops === "paid" || escrow === "released") return { status: "paid", label: "Paid" };
  return { status: "processing", label: "Processing" };
}

const STATUS_CONFIG: Record<OrderStatus, { icon: any; bg: string; text: string }> = {
  processing: { icon: Clock, bg: "bg-orange-50", text: "text-orange-700" },
  paid: { icon: CheckCircle2, bg: "bg-blue-50", text: "text-blue-700" },
  in_transit: { icon: Truck, bg: "bg-purple-50", text: "text-purple-700" },
  delivered: { icon: CheckCircle2, bg: "bg-emerald-50", text: "text-emerald-700" },
  cancelled: { icon: XCircle, bg: "bg-gray-100", text: "text-gray-600" },
  attention: { icon: AlertCircle, bg: "bg-red-50", text: "text-red-700" },
};

export const OrderCard = memo(function OrderCard({ order: o }: OrderCardProps) {
  const amount = Number(o?.amount || (o?.amountKobo ? o.amountKobo / 100 : 0) || 0);
  const { status, label } = getOrderStatus(o);
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const vendor = String(o?.businessSlug || "").trim() || "Unknown";
  const itemCount = Array.isArray(o?.items) ? o.items.length : 0;
  const dateStr = formatDate(o?.createdAt);
  const displayNo = o?.displayOrderRef || padOrderNumber(o?.orderNumber) || String(o?.id || "").slice(0, 8).toUpperCase();

  return (
    <Link href={`/orders/${o.id}`} className="block">
      <div className="bg-white rounded-xl border border-gray-100 p-4 hover:border-orange-200 hover:shadow-float transition-all duration-150 group animate-card-in">
        <div className="flex items-start gap-3.5">
          <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0", config.bg)}>
            <Icon className={cn("w-5 h-5", config.text)} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">Order #{displayNo}</p>
                <p className="text-micro text-gray-400 mt-0.5 truncate">
                  @{vendor} \u2022 {itemCount} item{itemCount !== 1 ? "s" : ""}
                </p>
              </div>
              <p className="text-sm font-bold text-gray-900 tabular-nums whitespace-nowrap shrink-0">{formatMoneyNGN(amount)}</p>
            </div>

            <div className="flex items-center gap-2 mt-2.5">
              <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-micro font-semibold", config.bg, config.text)}>
                {label}
              </span>
              {dateStr && <span className="text-micro text-gray-400">{dateStr}</span>}
            </div>
          </div>

          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500 transition shrink-0 self-center" />
        </div>
      </div>
    </Link>
  );
});
