// FILE: src/components/market/ProductCard.tsx
"use client";

import { memo, useState, useCallback } from "react";
import {
  BadgeCheck,
  Sparkles,
  Plus,
  ShoppingBag,
  Check,
} from "lucide-react";
import { Card } from "@/components/Card";
import { CloudImage } from "@/components/CloudImage";
import {
  normalizeCoverAspect,
  coverAspectToTailwindClass,
  coverAspectToWH,
  type CoverAspectKey,
} from "@/lib/products/coverAspect";
import {
  computeSalePriceNgn,
  saleBadgeText,
  saleIsActive,
} from "@/lib/market/sale";
import { cn } from "@/lib/cn";
import { SmartMatchBadge } from "@/components/market/SmartMatchBadge";
import type { ProductMatchResult } from "@/lib/smartmatch/types";
import { formatMoneyNGN } from "@/lib/money";

function verificationLabel(n: any) {
  const t = Number(n || 0);
  if (t >= 3) return "Address verified";
  if (t === 2) return "ID verified";
  if (t === 1) return "Verified";
  return "New seller";
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
  const tier = Number(p?.marketTier ?? p?.verificationTier ?? 0);
  const isService = String(p?.listingType || "product") === "service";
  const serviceMode = String(p?.serviceMode || "book");
  const bookOnly = isService && serviceMode === "book";
  const basePrice = Number(p?.price || 0);
  const onSale = !bookOnly && saleIsActive(p);
  const finalPrice = onSale ? computeSalePriceNgn(p) : basePrice;
  const apexBadgeActive = p?.apexBadgeActive === true;
  const coverAspect: CoverAspectKey =
    normalizeCoverAspect(p?.coverAspect) ?? "1:1";
  const aspectClass = coverAspectToTailwindClass(coverAspect);
  const { w, h } = coverAspectToWH(coverAspect, compact ? 320 : 520);

  // B5-2: Visual feedback state for add-to-cart
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

      // B5-2: Show checkmark briefly on the button
      setJustAdded(true);
      setTimeout(() => setJustAdded(false), 1200);
    },
    [onAddToCart]
  );

  const showMatchBadge =
    matchResult &&
    matchResult.label !== "low_match" &&
    matchResult.score.total >= 50;

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
      <Card className="p-2.5 transition-all duration-200 hover:shadow-md hover:border-orange-200 group-active:scale-[0.98]">
        <div
          className={cn(
            aspectClass,
            "w-full rounded-xl bg-gradient-to-br from-gray-100 to-gray-50 overflow-hidden relative"
          )}
        >
          {img ? (
            <CloudImage
              src={img}
              alt={productName}
              w={w}
              h={h}
              sizes={
                compact
                  ? "(max-width: 430px) 40vw, 160px"
                  : "(max-width: 430px) 45vw, 220px"
              }
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center">
              <ShoppingBag className="w-8 h-8 text-gray-300" />
            </div>
          )}

          {/* Top badges */}
          <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-1 pointer-events-none">
            <div className="flex flex-col gap-1">
              {showMatchBadge && !apexBadgeActive ? (
                <SmartMatchBadge label={matchResult!.label} compact />
              ) : null}

              {apexBadgeActive && (
                <div className="px-2 py-1 rounded-full text-[10px] font-bold bg-emerald-500 text-white inline-flex items-center gap-1 shadow-sm">
                  <BadgeCheck className="h-3 w-3" />
                  <span>Trusted</span>
                </div>
              )}

              {!apexBadgeActive && !showMatchBadge && boosted && (
                <div className="px-2 py-1 rounded-full text-[10px] font-bold bg-white/95 text-orange-600 inline-flex items-center gap-1 shadow-sm">
                  <Sparkles className="h-3 w-3" />
                  <span>Promoted</span>
                </div>
              )}
            </div>

            {onSale && (
              <div className="px-2 py-1 rounded-full text-[10px] font-bold bg-red-500 text-white shadow-sm">
                {saleBadgeText(p, formatMoneyNGN)}
              </div>
            )}
          </div>

          {/* Bottom row */}
          <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between">
            <div className="px-2 py-1 rounded-full text-[9px] font-semibold bg-white/95 text-gray-600 shadow-sm pointer-events-none">
              {verificationLabel(tier)}
            </div>

            {/* B5-2: Add-to-cart button with visual feedback */}
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
                  "h-8 w-8 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-90 cursor-pointer",
                  justAdded
                    ? "bg-green-500 text-white scale-110"
                    : "bg-orange-500 text-white hover:bg-orange-600"
                )}
                aria-label={justAdded ? "Added!" : "Add to cart"}
              >
                {justAdded ? (
                  <Check className="h-4 w-4" strokeWidth={3} />
                ) : (
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-2.5 px-0.5">
          <p
            className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight min-h-[2.6rem]"
            title={productName}
          >
            {productName}
          </p>

          {!compact ? (
            <p
              className={cn(
                "text-[10px] text-gray-500 mt-0.5 line-clamp-1 leading-tight min-h-[0.9rem]",
                showMatchBadge && matchResult?.reason
                  ? ""
                  : "invisible"
              )}
              title={matchResult?.reason || ""}
            >
              {matchResult?.reason || "\u2014"}
            </p>
          ) : null}

          <p className="mt-1.5 text-sm">
            {bookOnly ? (
              <span className="text-gray-500 font-medium">
                Book only
              </span>
            ) : onSale ? (
              <>
                <span className="line-through text-gray-400 mr-1.5 text-xs">
                  {formatMoneyNGN(basePrice)}
                </span>
                <span className="text-red-600 font-bold">
                  {formatMoneyNGN(finalPrice)}
                </span>
              </>
            ) : (
              <span className="text-gray-900 font-bold">
                {formatMoneyNGN(basePrice)}
              </span>
            )}
          </p>
        </div>
      </Card>
    </div>
  );
});