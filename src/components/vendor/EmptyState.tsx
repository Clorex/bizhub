// FILE: src/components/vendor/EmptyState.tsx
"use client";

import { memo } from "react";
import { Button } from "@/components/ui/Button";
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
    <div className={cn("text-center", compact ? "py-6" : "py-10")}>
      <div
        className={cn(
          "rounded-full bg-gray-100 flex items-center justify-center mx-auto",
          compact ? "w-12 h-12 mb-3" : "w-16 h-16 mb-4"
        )}
      >
        <Icon className={cn("text-gray-400", compact ? "w-6 h-6" : "w-8 h-8")} />
      </div>

      <p className={cn("font-semibold text-gray-900", compact ? "text-sm" : "text-base")}>
        {title}
      </p>
      <p className={cn("text-gray-500 mt-1 max-w-xs mx-auto", compact ? "text-xs" : "text-sm")}>
        {description}
      </p>

      {actions && actions.length > 0 && (
        <div
          className={cn(
            "flex justify-center gap-3 max-w-xs mx-auto",
            compact ? "mt-4" : "mt-5"
          )}
        >
          {actions.map((action, idx) => {
            const ActionIcon = action.icon;
            return (
              <Button
                key={idx}
                variant={action.variant || "secondary"}
                size={compact ? "sm" : "md"}
                onClick={action.onClick}
                leftIcon={ActionIcon ? <ActionIcon className="w-4 h-4" /> : undefined}
              >
                {action.label}
              </Button>
            );
          })}
        </div>
      )}
    </div>
  );
});