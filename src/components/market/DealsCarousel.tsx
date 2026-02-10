"use client";

import { useRef, memo } from "react";
import { ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { ProductCard } from "./ProductCard";
import { DealsCarouselSkeleton } from "@/components/ui/Skeleton";
import { SectionCard } from "@/components/ui/SectionCard";

interface DealsCarouselProps {
  deals: any[];
  loading: boolean;
  onProductClick: (product: any) => void;
  onAddToCart: (product: any) => void;
}

export const DealsCarousel = memo(function DealsCarousel({
  deals,
  loading,
  onProductClick,
  onAddToCart,
}: DealsCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = direction === "left" ? -200 : 200;
    scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
  };

  if (loading) {
    return (
      <SectionCard
        title="Hot Deals"
        subtitle="Limited time offers"
        right={<Flame className="w-5 h-5 text-red-500" />}
      >
        <DealsCarouselSkeleton />
      </SectionCard>
    );
  }

  if (deals.length === 0) {
    return null;
  }

  return (
    <SectionCard
      title="Hot Deals"
      subtitle={`${deals.length} discount${deals.length !== 1 ? "s" : ""} available`}
      right={<Flame className="w-5 h-5 text-red-500" />}
    >
      <div className="relative -mx-1">
        {/* Scroll buttons */}
        {deals.length > 2 && (
          <>
            <button
              onClick={() => scroll("left")}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-50 transition"
              aria-label="Scroll left"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <button
              onClick={() => scroll("right")}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-gray-50 transition"
              aria-label="Scroll right"
            >
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
          </>
        )}

        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto scrollbar-hide px-1 py-1 snap-x snap-mandatory"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {deals.map((product) => (
            <div key={product.id} className="flex-shrink-0 w-40 snap-start">
              <ProductCard
                product={product}
                onClick={() => onProductClick(product)}
                onAddToCart={() => onAddToCart(product)}
                compact
              />
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
});