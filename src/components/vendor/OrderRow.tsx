// FILE: src/components/vendor/OrderRow.tsx
"use client";

import { memo } from "react";
import { Package, Clock, ChevronRight } from "lucide-react";
import { OrderStatusPill } from "@/components/vendor/OrderStatusPill";

interface OrderRowProps {
  order: any;
  onClick: () => void;
}

function fmtNaira(n: number): string {
  if (typeof n !== "number" || isNaN(n)) return "₦0";
  return `₦${n.toLocaleString("en-NG")}`;
}

function fmtDate(v: any): string {
  try {
    if (!v) return "—";
    if (typeof v?.toDate === "function") {
      return v.toDate().toLocaleString("en-NG", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    if (typeof v === "string" || typeof v === "number") {
      const d = new Date(v);
      if (!isNaN(d.getTime())) {
        return d.toLocaleString("en-NG", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      }
    }
    return String(v);
  } catch {
    return "—";
  }
}

export const OrderRow = memo(function OrderRow({ order, onClick }: OrderRowProps) {
  const status = String(
    order.opsStatusEffective || order.opsStatus || order.orderStatus || "new"
  );
  const amount = Number(
    order.amount || (order.amountKobo ? order.amountKobo / 100 : 0) || 0
  );
  const itemCount = Array.isArray(order.items) ? order.items.length : 0;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-4 p-4 rounded-2xl border border-gray-100 bg-white hover:border-orange-200 hover:shadow-sm transition text-left"
    >
      <div className="w-11 h-11 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
        <Package className="w-5 h-5 text-orange-600" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900">
          Order #{String(order.id).slice(0, 8)}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          <OrderStatusPill status={status} />
          <span className="text-[11px] text-gray-400">
            {order.paymentType || "—"}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-1.5 text-gray-400">
          <Clock className="w-3 h-3" />
          <span className="text-[11px]">{fmtDate(order.createdAt)}</span>
        </div>
      </div>

      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-gray-900">{fmtNaira(amount)}</p>
        <p className="text-[11px] text-gray-400 mt-1">
          {itemCount} item{itemCount !== 1 ? "s" : ""}
        </p>
      </div>

      <ChevronRight className="w-5 h-5 text-gray-300 shrink-0" />
    </button>
  );
});