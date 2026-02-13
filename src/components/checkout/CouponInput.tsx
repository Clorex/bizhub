// FILE: src/components/checkout/CouponInput.tsx
"use client";

import { memo, useState } from "react";
import { Tag, X, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatMoneyNGN } from "@/lib/money";

interface CouponInputProps {
  code: string;
  onCodeChange: (code: string) => void;
  onApply: () => void;
  onRemove: () => void;
  loading?: boolean;
  applied?: boolean;
  discountAmount?: number;
  message?: string | null;
}

export const CouponInput = memo(function CouponInput({
  code,
  onCodeChange,
  onApply,
  onRemove,
  loading = false,
  applied = false,
  discountAmount = 0,
  message = null,
}: CouponInputProps) {
  const [focused, setFocused] = useState(false);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onApply();
    }
  };

  if (applied && discountAmount > 0) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-500 text-white flex items-center justify-center">
              <Check className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-green-800">{code} applied!</p>
              <p className="text-xs text-green-600">
                You save {formatMoneyNGN(discountAmount / 100)}
              </p>
            </div>
          </div>
          <button
            onClick={onRemove}
            className="p-2 rounded-lg hover:bg-green-100 transition"
            aria-label="Remove coupon"
          >
            <X className="w-5 h-5 text-green-600" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div
        className={cn(
          "flex items-center rounded-2xl border bg-white transition-all overflow-hidden",
          focused ? "border-orange-300 ring-2 ring-orange-100" : "border-gray-200"
        )}
      >
        <div className="pl-4 pr-2 py-3">
          <Tag className="w-5 h-5 text-gray-400" />
        </div>
        <input
          type="text"
          value={code}
          onChange={(e) => onCodeChange(e.target.value.toUpperCase())}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder="Enter code"
          className="flex-1 min-w-0 text-sm text-gray-900 placeholder:text-gray-400 outline-none bg-transparent uppercase py-3"
        />
        <button
          onClick={onApply}
          disabled={loading || !code.trim()}
          className={cn(
            "px-4 py-3 text-sm font-semibold transition-colors shrink-0",
            loading || !code.trim()
              ? "text-gray-300 cursor-not-allowed"
              : "text-orange-600 hover:text-orange-700 hover:bg-orange-50"
          )}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Apply"}
        </button>
      </div>

      {message && (
        <p
          className={cn(
            "text-xs mt-2 px-1",
            message.toLowerCase().includes("applied") ||
              message.toLowerCase().includes("success")
              ? "text-green-600"
              : message.toLowerCase().includes("removed")
              ? "text-gray-500"
              : "text-red-500"
          )}
        >
          {message}
        </p>
      )}
    </div>
  );
});