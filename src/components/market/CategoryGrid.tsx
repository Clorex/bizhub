// FILE: src/components/market/CategoryGrid.tsx
"use client";

import { memo } from "react";
import {
  Shirt,
  Smartphone,
  Sparkles,
  Home,
  ShoppingBag,
  Wrench,
  Grid3X3,
} from "lucide-react";
import { MARKET_CATEGORIES, type MarketCategoryKey } from "@/lib/search/marketTaxonomy";
import { cn } from "@/lib/cn";

const CATEGORY_ICONS: Record<MarketCategoryKey, any> = {
  fashion: Shirt,
  phones: Smartphone,
  beauty: Sparkles,
  home: Home,
  bags: ShoppingBag,
  services: Wrench,
  other: Grid3X3,
};

const CATEGORY_COLORS: Record<MarketCategoryKey, string> = {
  fashion: "from-pink-500 to-rose-500",
  phones: "from-blue-500 to-indigo-500",
  beauty: "from-purple-500 to-fuchsia-500",
  home: "from-amber-500 to-orange-500",
  bags: "from-teal-500 to-cyan-500",
  services: "from-green-500 to-emerald-500",
  other: "from-gray-500 to-slate-500",
};

interface CategoryGridProps {
  selectedCategory: MarketCategoryKey | null;
  onSelectCategory: (category: MarketCategoryKey | null) => void;
  counts?: Record<string, number>;
}

export const CategoryGrid = memo(function CategoryGrid({
  selectedCategory,
  onSelectCategory,
  counts,
}: CategoryGridProps) {
  const categories = MARKET_CATEGORIES.filter((c) => c.key !== "other");

  return (
    <div className="space-y-3">
      {/* All categories button */}
      <button
        onClick={() => onSelectCategory(null)}
        className={cn(
          "w-full rounded-2xl border p-4 text-left transition-all",
          !selectedCategory
            ? "border-orange-300 bg-gradient-to-br from-orange-50 to-white shadow-md"
            : "border-gray-100 bg-white hover:border-orange-200 hover:shadow-sm"
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center",
                !selectedCategory
                  ? "bg-gradient-to-br from-orange-500 to-orange-600 text-white"
                  : "bg-gray-100 text-gray-600"
              )}
            >
              <Grid3X3 className="w-5 h-5" />
            </div>
            <div>
              <p className={cn(
                "text-sm font-bold",
                !selectedCategory ? "text-orange-600" : "text-gray-900"
              )}>
                All Categories
              </p>
              <p className="text-xs text-gray-500">Browse everything</p>
            </div>
          </div>
        </div>
      </button>

      {/* Category grid */}
      <div className="grid grid-cols-3 gap-2">
        {categories.map((category) => {
          const Icon = CATEGORY_ICONS[category.key];
          const isActive = selectedCategory === category.key;
          const count = counts?.[category.key];

          return (
            <button
              key={category.key}
              onClick={() => onSelectCategory(isActive ? null : category.key)}
              className={cn(
                "rounded-2xl border p-3 text-left transition-all",
                isActive
                  ? "border-orange-300 bg-gradient-to-br from-orange-50 to-white shadow-md"
                  : "border-gray-100 bg-white hover:border-orange-200 hover:shadow-sm"
              )}
            >
              <div
                className={cn(
                  "w-9 h-9 rounded-xl flex items-center justify-center mb-2",
                  isActive
                    ? `bg-gradient-to-br ${CATEGORY_COLORS[category.key]} text-white`
                    : "bg-gray-100 text-gray-600"
                )}
              >
                <Icon className="w-4 h-4" />
              </div>
              <p className={cn(
                "text-xs font-bold truncate",
                isActive ? "text-orange-600" : "text-gray-900"
              )}>
                {category.label}
              </p>
              <p className="text-[10px] text-gray-500 truncate">{category.hint}</p>
              {count !== undefined && count > 0 && (
                <p className="text-[10px] text-gray-400 mt-1">{count} items</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
});