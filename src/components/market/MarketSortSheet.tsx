"use client";

import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import type { MarketSortKey } from "@/lib/market/filters/types";
import { cn } from "@/lib/cn";

const OPTIONS: { key: MarketSortKey; label: string; hint: string }[] = [
  { key: "recommended", label: "Recommended", hint: "Best overall results" },
  { key: "latest", label: "Latest", hint: "Newest listings first" },
  { key: "price_asc", label: "Price: low to high", hint: "Cheapest first" },
  { key: "price_desc", label: "Price: high to low", hint: "Most expensive first" },
  { key: "best_selling", label: "Best selling", hint: "Popular picks (proxy)" },
  { key: "closest", label: "Closest to me", hint: "Boosts your selected location" },
];

export function MarketSortSheet({
  open,
  onClose,
  value,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  value: MarketSortKey;
  onChange: (v: MarketSortKey) => void;
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Sort"
      footer={
        <Button onClick={onClose} size="md">
          Done
        </Button>
      }
    >
      <div className="space-y-2">
        {OPTIONS.map((o) => {
          const active = o.key === value;
          return (
            <button
              key={o.key}
              onClick={() => onChange(o.key)}
              className={cn(
                "w-full text-left rounded-2xl border p-4 transition",
                active
                  ? "border-biz-accent/30 bg-gradient-to-br from-orange-50 to-white"
                  : "border-biz-line bg-white hover:bg-black/[0.02]"
              )}
            >
              <p className={cn("text-sm font-extrabold", active ? "text-biz-accent" : "text-biz-ink")}>
                {o.label}
              </p>
              <p className="text-[11px] text-biz-muted mt-1">{o.hint}</p>
            </button>
          );
        })}
      </div>
    </BottomSheet>
  );
}