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
    <div className="px-4 pt-5 pb-4 bg-gradient-to-b from-biz-sand/60 to-biz-bg">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="mt-0.5">
            <BrandLogo size={32} priority />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-gray-900">{title}</h1>
            {subtitle && <p className="text-caption text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>

        <button className="h-10 w-10 rounded-xl bg-white border border-gray-200 shadow-soft flex items-center justify-center hover:bg-gray-50 transition">
          <Bell className="h-5 w-5 text-gray-600" />
        </button>
      </div>

      <div className="mt-4 relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          className="w-full rounded-xl border border-gray-200 bg-white px-10 py-3 text-sm outline-none focus:ring-2 focus:ring-orange-200/60 focus:border-orange-300 transition min-h-[48px]"
          placeholder={placeholder}
        />
      </div>
    </div>
  );
}
