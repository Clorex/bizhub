// FILE: src/components/checkout/PaymentButtons.tsx
"use client";

import { memo } from "react";
import { CreditCard, Banknote, Loader2, Shield } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

type Currency = "NGN" | "USD";

interface PaymentButtonsProps {
  onCardPay: () => void;
  onDirectTransfer: () => void;
  loading?: boolean;
  disabled?: boolean;
  usdEligible?: boolean;
  currency: Currency;
  onCurrencyChange: (currency: Currency) => void;
}

export const PaymentButtons = memo(function PaymentButtons({
  onCardPay,
  onDirectTransfer,
  loading = false,
  disabled = false,
  usdEligible = false,
  currency,
  onCurrencyChange,
}: PaymentButtonsProps) {
  return (
    <div className="space-y-4">
      {/* Currency selector (only if USD eligible) */}
      {usdEligible && (
        <div className="rounded-2xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold text-gray-700 mb-2">
            Payment currency
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onCurrencyChange("NGN")}
              className={cn(
                "py-3 rounded-xl text-sm font-bold transition-all",
                currency === "NGN"
                  ? "bg-orange-500 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              🇳🇬 NGN
            </button>
            <button
              type="button"
              onClick={() => onCurrencyChange("USD")}
              className={cn(
                "py-3 rounded-xl text-sm font-bold transition-all",
                currency === "USD"
                  ? "bg-orange-500 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              )}
            >
              🇺🇸 USD
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            This vendor accepts international card payments in USD
          </p>
        </div>
      )}

      {/* Payment buttons */}
      <div className="space-y-3">
        {/* Card Payment - Primary */}
        <Button
          onClick={onCardPay}
          disabled={disabled || loading}
          className="w-full h-14 text-base"
          leftIcon={
            loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <CreditCard className="w-5 h-5" />
            )
          }
        >
          {loading ? "Processing..." : `Pay with Card${usdEligible ? ` (${currency})` : ""}`}
        </Button>

        {/* Divider */}
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-white px-3 text-gray-400">or</span>
          </div>
        </div>

        {/* Direct Transfer - Secondary */}
        <button
          onClick={onDirectTransfer}
          disabled={disabled || loading}
          className={cn(
            "w-full rounded-2xl border-2 border-dashed p-4 transition-all",
            disabled || loading
              ? "border-gray-200 bg-gray-50 cursor-not-allowed"
              : "border-gray-300 bg-white hover:border-orange-300 hover:bg-orange-50"
          )}
        >
          <div className="flex items-center justify-center gap-3">
            <div className={cn(
              "w-10 h-10 rounded-xl flex items-center justify-center",
              disabled || loading ? "bg-gray-200" : "bg-orange-100"
            )}>
              <Banknote className={cn(
                "w-5 h-5",
                disabled || loading ? "text-gray-400" : "text-orange-600"
              )} />
            </div>
            <div className="text-left">
              <p className={cn(
                "text-sm font-semibold",
                disabled || loading ? "text-gray-400" : "text-gray-900"
              )}>
                Pay via Direct Transfer
              </p>
              <p className={cn(
                "text-xs",
                disabled || loading ? "text-gray-300" : "text-gray-500"
              )}>
                Transfer directly to vendor's bank account
              </p>
            </div>
          </div>
        </button>
      </div>

      {/* Security note */}
      <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
        <Shield className="w-3.5 h-3.5" />
        <span>Card payments secured by Flutterwave</span>
      </div>
    </div>
  );
});