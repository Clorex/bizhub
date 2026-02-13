// FILE: src/components/checkout/CheckoutHeader.tsx
"use client";

import { memo } from "react";
import { Shield, Clock, CreditCard } from "lucide-react";
import { formatMoneyNGN } from "@/lib/money";

interface CheckoutHeaderProps {
  total: number;
  storeSlug: string;
  itemCount: number;
  loading?: boolean;
}

export const CheckoutHeader = memo(function CheckoutHeader({
  total,
  storeSlug,
  itemCount,
  loading = false,
}: CheckoutHeaderProps) {
  return (
    <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />

      <div className="relative z-10">
        <div className="flex items-center gap-2 text-orange-100 text-xs font-medium">
          <CreditCard className="w-4 h-4" />
          <span>Order Total</span>
        </div>

        <p className="text-3xl font-bold mt-2 tracking-tight">
          {loading ? "Calculating..." : formatMoneyNGN(total)}
        </p>

        <p className="text-sm text-orange-100 mt-2">
          {itemCount} item{itemCount !== 1 ? "s" : ""} from{" "}
          <span className="font-medium">@{storeSlug}</span>
        </p>

        {/* Trust badges */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-white/20">
          <div className="flex items-center gap-1.5 text-xs text-orange-100">
            <Shield className="w-3.5 h-3.5" />
            <span>Secure</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-orange-100">
            <Clock className="w-3.5 h-3.5" />
            <span>Fast checkout</span>
          </div>
        </div>
      </div>
    </div>
  );
});