// FILE: src/components/market/ProductCard.tsx
"use client";

import { memo, useState, useCallback } from "react";
import { BadgeCheck, Sparkles, Plus, ShoppingBag, Check } from "lucide-react";
import { CloudImage } from "@/components/CloudImage";
import { computeSalePriceNgn, saleBadgeText, saleIsActive } from "@/lib/market/sale";
import { cn } from "@/lib/cn";
import { SmartMatchBadge } from "@/components/market/SmartMatchBadge";
import type { ProductMatchResult } from "@/lib/smartmatch/types";
import { formatMoneyNGN } from "@/lib/money";

/**
 * We must not show "New seller" anywhere.
 * Use the existing store/vendor verification signal already present on the product payload.
 * If missing/undefined -> default to Not verified.
 */
function isVerifiedVendorFromProduct(p: any): boolean {
  // Prefer explicit boolean/status fields if present in the product payload
  const candidates = [
    p?.store?.isVerified,
    p?.store?.verified,
    p?.business?.isVerified,
    p?.business?.verified,
    p?.businessVerified,
    p?.vendor?.verified,
    p?.vendorVerified,
    p?.verificationStatus, // e.g. "VERIFIED"
    p?.storeVerificationStatus,
    p?.verifiedAt, // date/timestamp-like => verified
  ];

  for (const v of candidates) {
    if (typeof v === "boolean") return v;

    if (typeof v === "string") {
      const s = v.trim().toUpperCase();
      if (s === "VERIFIED" || s === "APPROVED") return true;
      if (s === "UNVERIFIED" || s === "PENDING" || s === "REJECTED") return false;
    }

    // Firestore Timestamp-like or Date-like presence
    if (v instanceof Date) return true;
    if (v && typeof v === "object" && ("seconds" in (v as any) || "toDate" in (v as any))) return true;

    // Some payloads use numeric tiers (legacy)
    if (typeof v === "number" && Number.isFinite(v)) return v > 0;
  }
  return false;
}

interface ProductCardProps {
  product: any;
  onClick: () => void;
  onAddToCart?: (e: React.MouseEvent) => void;
  compact?: boolean;
  matchResult?: ProductMatchResult | null;
}

export const ProductCard = memo(function ProductCard({
  product: p,
  onClick,
  onAddToCart,
  compact = false,
  matchResult,
}: ProductCardProps) {
  const img = Array.isArray(p?.images) ? p.images[0] : "";
  const boosted = Number(p?.boostUntilMs || 0) > Date.now();
  const isService = String(p?.listingType || "product") === "service";
  const serviceMode = String(p?.serviceMode || "book");
  const bookOnly = isService && serviceMode === "book";
  const basePrice = Number(p?.price || 0);
  const onSale = !bookOnly && saleIsActive(p);
  const finalPrice = onSale ? computeSalePriceNgn(p) : basePrice;
  const apexBadgeActive = p?.apexBadgeActive === true;

  const vendorVerified = isVerifiedVendorFromProduct(p);

  const [justAdded, setJustAdded] = useState(false);

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-add-to-cart]")) return;
    onClick();
  };

  const handleAddToCart = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      onAddToCart?.(e);
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1200);
    },
    [onAddToCart]
  );

  const showMatchBadge = matchResult && matchResult.label !== "low_match" && matchResult.score.total >= 50;

  const productName = String(p?.name || "Unnamed product");

  return (
    <div
      onClick={handleCardClick}
      className="block w-full text-left group cursor-pointer"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      aria-label={productName}
      title={productName}
    >
      {/* Card with fixed structure for uniform height */}
      <div className="rounded-2xl border border-gray-100 bg-white p-1.5 transition-all duration-200 hover:shadow-md hover:border-orange-200 group-active:scale-[0.98] flex flex-col h-full">
        {/* ALWAYS square image area */}
        <div className="relative w-full aspect-square rounded-xl bg-gray-100 overflow-hidden shrink-0">
          {img ? (
            <CloudImage
              src={img}
              alt={productName}
              w={400}
              h={400}
              sizes="(max-width: 430px) 45vw, 220px"
              className="absolute inset-0 h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <ShoppingBag className="w-8 h-8 text-gray-300" />
            </div>
          )}

          {/* Top badges */}
          <div className="absolute top-1.5 left-1.5 right-1.5 flex items-start justify-between gap-1 pointer-events-none">
            <div className="flex flex-col gap-1">
              {showMatchBadge && !apexBadgeActive ? <SmartMatchBadge label={matchResult!.label} compact /> : null}

              {apexBadgeActive && (
                <div className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500 text-white inline-flex items-center gap-0.5 shadow-sm">
                  <BadgeCheck className="h-2.5 w-2.5" />
                  <span>Trusted</span>
                </div>
              )}

              {!apexBadgeActive && !showMatchBadge && boosted && (
                <div className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-white/95 text-orange-600 inline-flex items-center gap-0.5 shadow-sm">
                  <Sparkles className="h-2.5 w-2.5" />
                  <span>Ad</span>
                </div>
              )}
            </div>

            {onSale && (
              <div className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-red-500 text-white shadow-sm">
                {saleBadgeText(p, formatMoneyNGN)}
              </div>
            )}
          </div>

          {/* Bottom row on image */}
          <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-end justify-between">
            <div
              className={cn(
                "px-1.5 py-0.5 rounded-full text-[8px] font-semibold shadow-sm pointer-events-none border",
                vendorVerified
                  ? "bg-emerald-50 text-emerald-700 border-emerald-100"
                  : "bg-white/90 text-gray-600 border-gray-200"
              )}
            >
              {vendorVerified ? "Verified" : "Not verified"}
            </div>

            {!bookOnly && onAddToCart && (
              <div
                data-add-to-cart
                onClick={handleAddToCart}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    onAddToCart?.(e as any);
                  }
                }}
                className={cn(
                  "h-7 w-7 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90 cursor-pointer",
                  justAdded ? "bg-green-500 text-white scale-110" : "bg-orange-500 text-white hover:bg-orange-600"
                )}
                aria-label={justAdded ? "Added!" : "Add to cart"}
              >
                {justAdded ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />}
              </div>
            )}
          </div>
        </div>

        {/* Text area - fixed height via line clamping */}
        <div className="mt-1.5 px-1 flex flex-col flex-1 justify-between">
          <p className="text-[13px] font-semibold text-gray-900 leading-tight line-clamp-2 h-[2.4em]" title={productName}>
            {productName}
          </p>

          <p className="mt-1 text-[13px] pb-0.5">
            {bookOnly ? (
              <span className="text-gray-500 font-medium">Book only</span>
            ) : onSale ? (
              <>
                <span className="line-through text-gray-400 mr-1 text-[11px]">{formatMoneyNGN(basePrice)}</span>
                <span className="text-red-600 font-bold">{formatMoneyNGN(finalPrice)}</span>
              </>
            ) : (
              <span className="text-gray-900 font-bold">{formatMoneyNGN(basePrice)}</span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
});

