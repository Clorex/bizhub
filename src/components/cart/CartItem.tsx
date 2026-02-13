// FILE: src/components/cart/CartItem.tsx
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

export const CartItem = memo(function CartItem({
  item,
  onUpdateQty,
  onRemove,
}: CartItemProps) {
  const hasOptions = item.selectedOptions && Object.keys(item.selectedOptions).length > 0;
  const lineTotal = item.price * item.qty;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
      <div className="flex gap-4">
        {/* Image */}
        <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 overflow-hidden shrink-0">
          {item.imageUrl ? (
            <CloudImage
              src={item.imageUrl}
              alt={item.name}
              w={160}
              h={160}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <ShoppingBag className="w-6 h-6 text-gray-300" />
            </div>
          )}
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">
                {item.name}
              </h3>
              {hasOptions && (
                <p className="text-xs text-gray-500 mt-1">
                  {Object.entries(item.selectedOptions!)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" • ")}
                </p>
              )}
            </div>
            <p className="text-sm font-bold text-gray-900 shrink-0">
              {formatMoneyNGN(lineTotal)}
            </p>
          </div>

          <p className="text-xs text-gray-500 mt-1">
            {formatMoneyNGN(item.price)} each
          </p>

          {/* Quantity controls */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-1">
              <button
                onClick={() => onUpdateQty(item.lineId, item.qty - 1)}
                disabled={item.qty <= 1}
                className={cn(
                  "w-9 h-9 rounded-xl border flex items-center justify-center transition",
                  item.qty <= 1
                    ? "border-gray-100 text-gray-300 cursor-not-allowed"
                    : "border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-600 active:scale-95"
                )}
                aria-label="Decrease quantity"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="w-10 text-center text-sm font-bold text-gray-900">
                {item.qty}
              </span>
              <button
                onClick={() => onUpdateQty(item.lineId, item.qty + 1)}
                className="w-9 h-9 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:border-orange-300 hover:text-orange-600 transition active:scale-95"
                aria-label="Increase quantity"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => onRemove(item.lineId)}
              className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600 transition px-2 py-1 rounded-lg hover:bg-red-50"
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