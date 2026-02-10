// FILE: src/components/vendor/MenuCard.tsx
"use client";

import { memo } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";

interface MenuCardProps {
  icon: any;
  label: string;
  description?: string;
  href?: string;
  onClick?: () => void;
  badge?: string | number;
  urgent?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  external?: boolean;
}

export const MenuCard = memo(function MenuCard({
  icon: Icon,
  label,
  description,
  href,
  onClick,
  badge,
  urgent,
  destructive,
  disabled,
  external,
}: MenuCardProps) {
  const Component = href ? Link : "button";
  const baseProps = href
    ? { href, target: external ? "_blank" : undefined, rel: external ? "noopener noreferrer" : undefined }
    : { onClick, type: "button" as const };

  return (
    <Component
      {...(baseProps as any)}
      disabled={disabled}
      className={cn(
        "w-full flex items-center gap-4 p-4 rounded-2xl border bg-white transition text-left",
        disabled
          ? "opacity-50 cursor-not-allowed"
          : destructive
          ? "border-gray-100 hover:border-red-200 hover:bg-red-50/50"
          : urgent
          ? "border-red-200 hover:border-red-300 bg-red-50/30"
          : "border-gray-100 hover:border-orange-200 hover:shadow-sm"
      )}
    >
      <div
        className={cn(
          "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
          destructive
            ? "bg-red-50 text-red-600"
            : urgent
            ? "bg-red-100 text-red-600"
            : "bg-orange-50 text-orange-600"
        )}
      >
        <Icon className="w-5 h-5" />
      </div>

      <div className="flex-1 min-w-0">
        <p
          className={cn(
            "text-sm font-semibold",
            destructive
              ? "text-red-600"
              : urgent
              ? "text-red-700"
              : "text-gray-900"
          )}
        >
          {label}
        </p>
        {description && (
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{description}</p>
        )}
      </div>

      {badge !== undefined && (
        <span
          className={cn(
            "px-2.5 py-1 rounded-full text-xs font-bold shrink-0",
            urgent
              ? "bg-red-100 text-red-700"
              : "bg-orange-100 text-orange-700"
          )}
        >
          {badge}
        </span>
      )}

      <ChevronRight
        className={cn(
          "w-5 h-5 shrink-0 transition",
          destructive ? "text-red-300" : "text-gray-300 group-hover:text-orange-400"
        )}
      />
    </Component>
  );
});