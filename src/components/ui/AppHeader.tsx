"use client";

import { Search, Bell } from "lucide-react";
import { BrandLogo } from "@/components/brand/BrandLogo";

export function AppHeader({
  title,
  subtitle,
  placeholder = "Search products or stores...",
}: {
  title: string;
  subtitle?: string;
  placeholder?: string;
}) {
  return (
    <div className="px-4 pt-6 pb-5 bg-gradient-to-b from-biz-sand to-biz-bg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5">
            <BrandLogo size={34} priority />
          </div>

          <div className="min-w-0">
            <div className="text-lg font-extrabold tracking-tight text-biz-ink">{title}</div>
            {subtitle ? <div className="text-xs text-gray-600 mt-1">{subtitle}</div> : null}
          </div>
        </div>

        <button className="h-10 w-10 rounded-2xl bg-white border border-biz-line flex items-center justify-center shadow-soft">
          <Bell className="h-5 w-5 text-gray-600" />
        </button>
      </div>

      <div className="mt-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        <input
          className="w-full rounded-2xl border border-biz-line bg-white px-10 py-3 text-sm outline-none focus:ring-2 focus:ring-biz-accent/30"
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}