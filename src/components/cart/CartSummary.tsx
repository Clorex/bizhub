// FILE: src/components/cart/CartSummary.tsx
"use client";

import { memo } from "react";
import { ShoppingBag, MessageCircle, CreditCard, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";

interface CartSummaryProps {
  subtotal: number;
  itemCount: number;
  storeSlug: string;
  canChat: boolean;
  chatLoading?: boolean;
  onCheckout: () => void;
  onContinueInChat: () => void;
  onContinueShopping: () => void;
}

function fmtNaira(n: number) {
  return `₦${Number(n || 0).toLocaleString("en-NG")}`;
}

export const CartSummary = memo(function CartSummary({
  subtotal,
  itemCount,
  storeSlug,
  canChat,
  chatLoading = false,
  onCheckout,
  onContinueInChat,
  onContinueShopping,
}: CartSummaryProps) {
  return (
    <div className="bg-white rounded-t-3xl border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] p-5 pb-8">
      {/* Summary */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm text-gray-500">Subtotal</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {itemCount} item{itemCount !== 1 ? "s" : ""}
          </p>
        </div>
        <p className="text-2xl font-bold text-gray-900">{fmtNaira(subtotal)}</p>
      </div>

      {/* Actions */}
      <div className="space-y-2">
        <Button
          onClick={onCheckout}
          className="w-full"
          leftIcon={<CreditCard className="w-4 h-4" />}
        >
          Proceed to Checkout
        </Button>

        {canChat && (
          <Button
            variant="secondary"
            onClick={onContinueInChat}
            className="w-full"
            leftIcon={<MessageCircle className="w-4 h-4" />}
            loading={chatLoading}
            disabled={chatLoading}
          >
            Continue in WhatsApp
          </Button>
        )}

        <button
          onClick={onContinueShopping}
          className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-gray-600 hover:text-orange-600 transition"
        >
          <ShoppingBag className="w-4 h-4" />
          Continue Shopping
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});