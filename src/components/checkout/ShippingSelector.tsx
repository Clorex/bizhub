// FILE: src/components/checkout/ShippingSelector.tsx
"use client";

import { memo } from "react";
import { Truck, MapPin, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatMoneyNGN } from "@/lib/money";

interface ShippingOption {
  id: string;
  type: "pickup" | "delivery";
  name: string;
  feeKobo: number;
  etaDays: number;
  areasText?: string | null;
}

interface ShippingSelectorProps {
  options: ShippingOption[];
  selectedId: string;
  onSelect: (option: ShippingOption) => void;
  loading?: boolean;
  error?: string | null;
}

export const ShippingSelector = memo(function ShippingSelector({
  options,
  selectedId,
  onSelect,
  loading = false,
  error = null,
}: ShippingSelectorProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
        <span className="ml-2 text-sm text-gray-500">Loading shipping options...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl bg-red-50 border border-red-100 p-4">
        <p className="text-sm text-red-700">{error}</p>
      </div>
    );
  }

  if (options.length === 0) {
    return (
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
        <p className="text-sm text-gray-600">
          This vendor hasn&apos;t set up shipping options yet. Shipping fee will be{" "}
          {formatMoneyNGN(0)}.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {options.map((option) => {
        const isSelected = option.id === selectedId;
        const feeNgn = option.feeKobo / 100;
        const isPickup = option.type === "pickup";
        const Icon = isPickup ? MapPin : Truck;

        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option)}
            className={cn(
              "w-full text-left rounded-2xl border p-4 transition-all",
              isSelected
                ? "border-orange-300 bg-orange-50 shadow-sm"
                : "border-gray-200 bg-white hover:border-orange-200"
            )}
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                  isSelected ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600"
                )}
              >
                <Icon className="w-5 h-5" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p
                      className={cn(
                        "text-sm font-semibold",
                        isSelected ? "text-orange-700" : "text-gray-900"
                      )}
                    >
                      {option.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {isPickup ? "Pick up at location" : "Home delivery"}
                      {option.etaDays > 0 &&
                        ` • ${option.etaDays} day${option.etaDays !== 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={cn(
                        "text-sm font-bold",
                        isSelected ? "text-orange-700" : "text-gray-900"
                      )}
                    >
                      {feeNgn === 0 ? "Free" : formatMoneyNGN(feeNgn)}
                    </p>
                  </div>
                </div>

                {option.areasText && (
                  <p className="text-xs text-gray-400 mt-1 line-clamp-1">
                    {option.areasText}
                  </p>
                )}
              </div>

              {/* Check indicator */}
              {isSelected && (
                <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4 text-white" />
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
});