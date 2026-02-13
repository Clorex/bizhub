// FILE: src/components/vendor/EmptyState.tsx
"use client";

import { memo } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";

interface EmptyStateAction {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary";
  icon?: any;
}

interface VendorEmptyStateProps {
  icon: any;
  title: string;
  description: string;
  actions?: EmptyStateAction[];
  compact?: boolean;
}

export const VendorEmptyState = memo(function VendorEmptyState({
  icon: Icon,
  title,
  description,
  actions,
  compact,
}: VendorEmptyStateProps) {
  return (
    <EmptyState
      variant="plain"
      watermark={false}
      className={cn(compact ? "py-6" : "py-10")}
      icon={
        <div
          className={cn(
            "rounded-full bg-gray-100 flex items-center justify-center mx-auto",
            compact ? "w-12 h-12" : "w-16 h-16"
          )}
        >
          <Icon className={cn("text-gray-400", compact ? "w-6 h-6" : "w-8 h-8")} />
        </div>
      }
      title={title}
      description={description}
      actions={
        actions?.map((a) => {
          const AIcon = a.icon;
          return {
            label: a.label,
            onClick: a.onClick,
            variant: a.variant === "primary" ? "primary" : "secondary",
            size: compact ? "sm" : "md",
            leftIcon: AIcon ? <AIcon className="w-4 h-4" /> : undefined,
          };
        }) || undefined
      }
    />
  );
});