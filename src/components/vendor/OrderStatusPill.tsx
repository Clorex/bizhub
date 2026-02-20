"use client";

import { memo } from "react";
import { Clock, CheckCircle2, Truck, XCircle, MessageCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatOpsStatus } from "@/lib/statusLabel";

interface OrderStatusPillProps {
  status: string;
  size?: "sm" | "md";
}

const STATUS_STYLES: Record<string, { bg: string; text: string; icon: any }> = {
  new: { bg: "bg-orange-50", text: "text-orange-700", icon: Clock },
  contacted: { bg: "bg-blue-50", text: "text-blue-700", icon: MessageCircle },
  paid: { bg: "bg-emerald-50", text: "text-emerald-700", icon: CheckCircle2 },
  in_transit: { bg: "bg-purple-50", text: "text-purple-700", icon: Truck },
  delivered: { bg: "bg-emerald-50", text: "text-emerald-700", icon: CheckCircle2 },
  cancelled: { bg: "bg-gray-100", text: "text-gray-600", icon: XCircle },
  disputed: { bg: "bg-red-50", text: "text-red-700", icon: AlertTriangle },
};

export const OrderStatusPill = memo(function OrderStatusPill({
  status,
  size = "sm",
}: OrderStatusPillProps) {
  const s = String(status || "").toLowerCase();
  const style = STATUS_STYLES[s] || STATUS_STYLES.new;
  const Icon = style.icon;

  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap shrink-0 border",
      style.bg, style.text,
      size === "md" ? "px-3 py-1 text-xs border-transparent" : "px-2 py-0.5 text-micro border-transparent"
    )}>
      <Icon className={size === "md" ? "w-3.5 h-3.5" : "w-3 h-3"} />
      {formatOpsStatus(status)}
    </span>
  );
});
