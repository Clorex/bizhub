// FILE: src/components/vendor/OrderStatusTimeline.tsx
"use client";

import { memo, useMemo } from "react";
import {
  Package,
  Clock,
  CheckCircle2,
  Truck,
  XCircle,
  MessageCircle,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/cn";

interface TimelineEvent {
  label: string;
  date: string;
  icon: any;
  color: string;
  active: boolean;
}

interface OrderStatusTimelineProps {
  order: any;
}

function fmtDate(v: any): string {
  try {
    if (!v) return "—";
    if (typeof v?.toDate === "function") {
      return v.toDate().toLocaleString("en-NG", {
        month: "short",
        day: "numeric",
        year: "numeric",
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
          year: "numeric",
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

const STATUS_CONFIG: Record<string, { icon: any; color: string }> = {
  new: { icon: Package, color: "text-orange-600 bg-orange-50 border-orange-200" },
  contacted: { icon: MessageCircle, color: "text-blue-600 bg-blue-50 border-blue-200" },
  paid: { icon: CheckCircle2, color: "text-green-600 bg-green-50 border-green-200" },
  in_transit: { icon: Truck, color: "text-purple-600 bg-purple-50 border-purple-200" },
  delivered: { icon: CheckCircle2, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  cancelled: { icon: XCircle, color: "text-gray-500 bg-gray-50 border-gray-200" },
  disputed: { icon: AlertTriangle, color: "text-red-600 bg-red-50 border-red-200" },
};

export const OrderStatusTimeline = memo(function OrderStatusTimeline({
  order,
}: OrderStatusTimelineProps) {
  const events = useMemo(() => {
    const list: TimelineEvent[] = [];

    if (order.createdAt) {
      list.push({
        label: "Order Created",
        date: fmtDate(order.createdAt),
        icon: Package,
        color: "text-gray-500 bg-gray-50 border-gray-200",
        active: true,
      });
    }

    if (Array.isArray(order.opsStatusHistory)) {
      order.opsStatusHistory.forEach((h: any) => {
        const s = String(h.status || "").toLowerCase();
        const cfg = STATUS_CONFIG[s] || STATUS_CONFIG.new;

        list.push({
          label: `Status: ${h.status || "Updated"}`,
          date: fmtDate(h.timestamp),
          icon: cfg.icon,
          color: cfg.color,
          active: true,
        });
      });
    }

    return list;
  }, [order]);

  if (events.length === 0) {
    return (
      <p className="text-sm text-gray-500 text-center py-4">
        No timeline events yet.
      </p>
    );
  }

  return (
    <div className="space-y-0">
      {events.map((event, idx) => {
        const Icon = event.icon;
        const isLast = idx === events.length - 1;
        const colorParts = event.color.split(" ");
        const textColor = colorParts[0] || "text-gray-500";
        const bgColor = colorParts[1] || "bg-gray-50";
        const borderColor = colorParts[2] || "border-gray-200";

        return (
          <div key={idx} className="flex items-start gap-3">
            {/* Icon + Line */}
            <div className="relative flex flex-col items-center">
              <div
                className={cn(
                  "w-9 h-9 rounded-xl border flex items-center justify-center shrink-0",
                  bgColor,
                  borderColor
                )}
              >
                <Icon className={cn("w-4 h-4", textColor)} />
              </div>
              {!isLast && (
                <div className="w-0.5 h-8 bg-gray-200 my-1" />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 pt-1.5 pb-4">
              <p className="text-sm font-semibold text-gray-900">{event.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{event.date}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
});