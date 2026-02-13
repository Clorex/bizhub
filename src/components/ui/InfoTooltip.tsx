// FILE: src/components/ui/InfoTooltip.tsx
"use client";

import React from "react";
import { cn } from "@/lib/cn";

export function InfoTooltip({
  label = "Info",
  text,
  className,
}: {
  label?: string;
  text: string;
  className?: string;
}) {
  return (
    <span className={cn("relative inline-flex align-middle group", className)}>
      <span className="sr-only">{label}</span>
      <span
        tabIndex={0}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-gray-300 text-[10px] font-bold text-gray-500 bg-white cursor-help"
      >
        i
      </span>

      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 hidden group-hover:block group-focus-within:block",
          "top-6 left-1/2 -translate-x-1/2",
          "w-[240px] rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-lg",
          "text-[11px] leading-snug text-gray-700"
        )}
      >
        {text}
      </span>
    </span>
  );
}