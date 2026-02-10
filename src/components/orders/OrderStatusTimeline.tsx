// FILE: src/components/orders/OrderStatusTimeline.tsx
"use client";

import { memo } from "react";
import { 
  ShoppingCart, 
  CreditCard, 
  Package, 
  Truck, 
  CheckCircle2,
  Circle
} from "lucide-react";
import { cn } from "@/lib/cn";

interface OrderStatusTimelineProps {
  currentStatus: string;
  paymentType: string;
}

const STEPS = [
  { key: "ordered", label: "Order Placed", icon: ShoppingCart },
  { key: "paid", label: "Payment Received", icon: CreditCard },
  { key: "processing", label: "Processing", icon: Package },
  { key: "in_transit", label: "In Transit", icon: Truck },
  { key: "delivered", label: "Delivered", icon: CheckCircle2 },
];

function getStepIndex(status: string): number {
  const s = String(status || "").toLowerCase();
  
  if (s.includes("delivered")) return 4;
  if (s.includes("transit")) return 3;
  if (s.includes("processing") || s === "paid" || s === "accepted") return 2;
  if (s.includes("paid") || s === "released") return 1;
  
  return 0;
}

export const OrderStatusTimeline = memo(function OrderStatusTimeline({
  currentStatus,
  paymentType,
}: OrderStatusTimelineProps) {
  const currentIndex = getStepIndex(currentStatus);
  const isTransfer = paymentType === "direct_transfer";

  return (
    <div className="relative">
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        const isCompleted = index <= currentIndex;
        const isCurrent = index === currentIndex;

        // For direct transfer, show "Awaiting Confirmation" instead of "Payment Received"
        let label = step.label;
        if (step.key === "paid" && isTransfer && currentIndex < 2) {
          label = "Awaiting Confirmation";
        }

        return (
          <div key={step.key} className="flex items-start gap-4 relative">
            {/* Vertical line */}
            {index < STEPS.length - 1 && (
              <div
                className={cn(
                  "absolute left-5 top-10 w-0.5 h-12",
                  index < currentIndex ? "bg-green-500" : "bg-gray-200"
                )}
              />
            )}

            {/* Icon */}
            <div
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 transition-all",
                isCompleted
                  ? "bg-green-500 text-white"
                  : isCurrent
                  ? "bg-orange-500 text-white"
                  : "bg-gray-100 text-gray-400"
              )}
            >
              {isCompleted && index < currentIndex ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <Icon className="w-5 h-5" />
              )}
            </div>

            {/* Content */}
            <div className={cn("pb-8", index === STEPS.length - 1 && "pb-0")}>
              <p
                className={cn(
                  "text-sm font-semibold",
                  isCompleted ? "text-gray-900" : "text-gray-400"
                )}
              >
                {label}
              </p>
              {isCurrent && (
                <p className="text-xs text-orange-600 mt-0.5">Current status</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
});