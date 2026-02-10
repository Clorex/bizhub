// FILE: src/components/vendor/DisputeStatusBadge.tsx
"use client";

import { memo } from "react";
import {
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/cn";

interface DisputeStatusBadgeProps {
  status: string;
}

const CONFIG: Record<string, { bg: string; text: string; border: string; icon: any }> = {
  open: {
    bg: "bg-orange-100",
    text: "text-orange-700",
    border: "border-orange-200",
    icon: AlertTriangle,
  },
  investigating: {
    bg: "bg-blue-100",
    text: "text-blue-700",
    border: "border-blue-200",
    icon: Clock,
  },
  resolved: {
    bg: "bg-green-100",
    text: "text-green-700",
    border: "border-green-200",
    icon: CheckCircle2,
  },
  closed: {
    bg: "bg-gray-100",
    text: "text-gray-700",
    border: "border-gray-200",
    icon: XCircle,
  },
};

export const DisputeStatusBadge = memo(function DisputeStatusBadge({
  status,
}: DisputeStatusBadgeProps) {
  const s = status.toLowerCase();
  const c = CONFIG[s] || CONFIG.open;
  const Icon = c.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border",
        c.bg,
        c.text,
        c.border
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {status.toUpperCase()}
    </span>
  );
});