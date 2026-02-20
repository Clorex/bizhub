// FILE: src/components/restock/SeverityBadge.tsx
"use client";

import { cn } from "@/lib/cn";
import type { RestockSeverity } from "@/types/restock";

const styles: Record<RestockSeverity, string> = {
  urgent: "bg-red-100 text-red-700 border-red-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  warning: "bg-amber-100 text-amber-700 border-amber-200",
  info: "bg-blue-100 text-blue-700 border-blue-200",
};

const dotStyles: Record<RestockSeverity, string> = {
  urgent: "bg-red-500",
  high: "bg-orange-500",
  warning: "bg-amber-500",
  info: "bg-blue-500",
};

const labels: Record<RestockSeverity, string> = {
  urgent: "Urgent",
  high: "High",
  warning: "Warning",
  info: "Info",
};

export function SeverityBadge({
  severity,
  size = "sm",
}: {
  severity: RestockSeverity;
  size?: "xs" | "sm";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-bold",
        styles[severity] || styles.info,
        size === "xs" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
      )}
    >
      <span
        className={cn(
          "rounded-full shrink-0",
          dotStyles[severity] || dotStyles.info,
          size === "xs" ? "w-1.5 h-1.5" : "w-2 h-2"
        )}
      />
      {labels[severity] || "Info"}
    </span>
  );
}
