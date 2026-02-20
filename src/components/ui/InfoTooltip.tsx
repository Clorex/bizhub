"use client";

import React from "react";
import { HelpCircle } from "lucide-react";
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
        className="inline-flex items-center justify-center w-4 h-4 rounded-full text-gray-400 hover:text-gray-600 cursor-help transition"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </span>

      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 hidden group-hover:block group-focus-within:block",
          "top-6 left-1/2 -translate-x-1/2",
          "w-[220px] rounded-xl border border-gray-200 bg-white px-3 py-2.5 shadow-float",
          "text-micro leading-snug text-gray-600"
        )}
      >
        {text}
      </span>
    </span>
  );
}
