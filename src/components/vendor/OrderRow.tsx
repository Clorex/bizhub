// FILE: src/components/vendor/OrderRow.tsx
"use client";

import { memo } from "react";
import { Package, Clock, ChevronRight } from "lucide-react";
import { OrderStatusPill } from "@/components/vendor/OrderStatusPill";
import { formatMoneyNGN } from "@/lib/money";
import { formatPaymentType } from "@/lib/statusLabel";

interface OrderRowProps {
  order: any;
  onClick: () => void;
}

function padOrderNumber(n: any, width = 4) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v) || v <= 0) return "";
  return String(v).padStart(width, "0");
}

function fmtDate(v: any): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" };

  try {
    if (!v) return "—";
    if (v instanceof Date) return isNaN(v.getTime()) ? "—" : v.toLocaleString("en-NG", opts);
    if (typeof v?.toDate === "function") {
      const d = v.toDate();
      return d instanceof Date && !isNaN(d.getTime()) ? d.toLocaleString("en-NG", opts) : "—";
    }
    if (typeof v === "string" || typeof v === "number") {
      const d = new Date(v);
      return isNaN(d.getTime()) ? "—" : d.toLocaleString("en-NG", opts);
    }
    if (typeof v === "object") {
      const seconds = v?.seconds ?? v?._seconds;
      if (typeof seconds === "number") {
        const ns = v?.nanoseconds ?? v?._nanoseconds;
        const ms = seconds * 1000 + (typeof ns === "number" ? Math.floor(ns / 1e6) : 0);
        const d = new Date(ms);
        return isNaN(d.getTime()) ? "—" : d.toLocaleString("en-NG", opts);
      }
    }
    return "—";
  } catch {
    return "—";
  }
}

export const OrderRow = memo(function OrderRow({ order, onClick }: OrderRowProps) {
  const status = String(order?.opsStatusEffective || order?.opsStatus || order?.orderStatus || "new");
  const amount = Number(order?.amount || (order?.amountKobo ? order.amountKobo / 100 : 0) || 0);
  const itemCount = Array.isArray(order?.items) ? order.items.length : 0;

  const displayNo = padOrderNumber(order?.orderNumber) || String(order?.id || "").slice(0, 8);

  return (
    <button onClick={onClick} className="w-full flex items-center gap-3 p-4 rounded-2xl border border-gray-100 bg-white hover:border-orange-200 hover:shadow-sm transition text-left">
      <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
        <Package className="w-5 h-5 text-orange-600" />
      </div>

      <div className="flex-1 min-w-0 grid grid-cols-[1fr_auto] gap-3 items-start">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">Order #{displayNo || "—"}</p>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap min-w-0">
            <OrderStatusPill status={status} />
            <span className="text-[11px] text-gray-400 truncate max-w-[10rem]">{formatPaymentType(order?.paymentType)}</span>
          </div>

          <div className="flex items-center gap-1.5 mt-1.5 text-gray-400 min-w-0">
            <Clock className="w-3 h-3 shrink-0" />
            <span className="text-[11px] truncate">{fmtDate(order?.createdAt)}</span>
          </div>
        </div>

        <div className="text-right shrink-0 min-w-[96px]">
          <p className="text-sm font-bold text-gray-900 tabular-nums whitespace-nowrap">{formatMoneyNGN(amount)}</p>
          <p className="text-[11px] text-gray-400 mt-1 whitespace-nowrap">
            {itemCount} item{itemCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
    </button>
  );
});