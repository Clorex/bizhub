"use client";

import { memo } from "react";
import { ShoppingBag, MessageCircle, CreditCard, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatMoneyNGN } from "@/lib/money";

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

export const CartSummary = memo(function CartSummary({
  subtotal, itemCount, storeSlug, canChat, chatLoading = false,
  onCheckout, onContinueInChat, onContinueShopping,
}: CartSummaryProps) {
  return (
    <div className="bg-white rounded-t-2xl border-t border-gray-200 shadow-float p-5 pb-8">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-caption text-gray-500">Subtotal</p>
          <p className="text-micro text-gray-400 mt-0.5">
            {itemCount} item{itemCount !== 1 ? "s" : ""}
          </p>
        </div>
        <p className="text-2xl font-extrabold text-gray-900 tracking-tight">{formatMoneyNGN(subtotal)}</p>
      </div>

      <div className="space-y-2.5">
        <Button onClick={onCheckout} className="w-full" leftIcon={<CreditCard className="w-4 h-4" />}>
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
            Continue in Chat
          </Button>
        )}

        <button
          onClick={onContinueShopping}
          className="w-full flex items-center justify-center gap-2 py-3 text-caption font-medium text-gray-500 hover:text-orange-600 transition"
        >
          <ShoppingBag className="w-4 h-4" />
          Continue Shopping
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});
