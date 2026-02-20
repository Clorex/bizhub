"use client";

import { memo } from "react";
import { Minus, Plus, Trash2, ShoppingBag } from "lucide-react";
import { CloudImage } from "@/components/CloudImage";
import { cn } from "@/lib/cn";
import { formatMoneyNGN } from "@/lib/money";

interface CartItemProps {
  item: {
    lineId: string;
    productId: string;
    name: string;
    price: number;
    qty: number;
    imageUrl?: string;
    selectedOptions?: Record<string, string>;
  };
  onUpdateQty: (lineId: string, qty: number) => void;
  onRemove: (lineId: string) => void;
}

export const CartItem = memo(function CartItem({ item, onUpdateQty, onRemove }: CartItemProps) {
  const hasOptions = item.selectedOptions && Object.keys(item.selectedOptions).length > 0;
  const lineTotal = item.price * item.qty;

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-card animate-card-in">
      <div className="flex gap-3.5">
        <div className="w-20 h-20 rounded-xl bg-gray-100 overflow-hidden shrink-0">
          {item.imageUrl ? (
            <CloudImage src={item.imageUrl} alt={item.name} w={160} h={160} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-gray-300" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">{item.name}</h3>
              {hasOptions && (
                <p className="text-micro text-gray-500 mt-1">
                  {Object.entries(item.selectedOptions!).map(([k, v]) => `${k}: ${v}`).join(" \u2022 ")}
                </p>
              )}
            </div>
            <p className="text-sm font-bold text-gray-900 shrink-0">{formatMoneyNGN(lineTotal)}</p>
          </div>

          <p className="text-micro text-gray-400 mt-1">{formatMoneyNGN(item.price)} each</p>

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => onUpdateQty(item.lineId, item.qty - 1)}
                disabled={item.qty <= 1}
                className={cn(
                  "w-9 h-9 rounded-lg border flex items-center justify-center transition-all duration-150 min-tap",
                  item.qty <= 1
                    ? "border-gray-100 text-gray-300 cursor-not-allowed"
                    : "border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-600 active:scale-95"
                )}
                aria-label="Decrease quantity"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-10 text-center text-sm font-bold text-gray-900 tabular-nums">{item.qty}</span>
              <button
                onClick={() => onUpdateQty(item.lineId, item.qty + 1)}
                className="w-9 h-9 rounded-lg border border-gray-200 flex items-center justify-center text-gray-600 hover:border-orange-300 hover:text-orange-600 transition-all duration-150 active:scale-95 min-tap"
                aria-label="Increase quantity"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => onRemove(item.lineId)}
              className="flex items-center gap-1.5 text-micro font-medium text-red-500 hover:text-red-600 transition px-2 py-1.5 rounded-lg hover:bg-red-50 min-tap"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Remove
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
