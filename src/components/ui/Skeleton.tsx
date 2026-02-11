// FILE: src/components/ui/Skeleton.tsx
"use client";

import { cn } from "@/lib/cn";

interface SkeletonProps {
  className?: string;
  variant?: "rectangular" | "circular" | "text";
}

export function Skeleton({ className, variant = "rectangular" }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-gray-200",
        variant === "circular" && "rounded-full",
        variant === "text" && "rounded h-4",
        variant === "rectangular" && "rounded-xl",
        className
      )}
    />
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
      <Skeleton className="aspect-square w-full rounded-xl" />
      <Skeleton className="mt-3 h-4 w-3/4" variant="text" />
      <Skeleton className="mt-2 h-4 w-1/2" variant="text" />
    </div>
  );
}

export function ProductGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function StoreCardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4">
      <Skeleton className="h-5 w-2/3" variant="text" />
      <Skeleton className="mt-2 h-4 w-full" variant="text" />
      <Skeleton className="mt-2 h-3 w-1/2" variant="text" />
    </div>
  );
}

export function DealsCarouselSkeleton() {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex-shrink-0 w-40">
          <Skeleton className="aspect-square w-full rounded-xl" />
          <Skeleton className="mt-2 h-4 w-3/4" variant="text" />
          <Skeleton className="mt-1 h-3 w-1/2" variant="text" />
        </div>
      ))}
    </div>
  );
}

/* ——————————————————————————————————————————————
   ANALYTICS SKELETONS (new)
   —————————————————————————————————————————————— */

export function SummaryCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6">
      <div className="flex items-center justify-between mb-1">
        <Skeleton className="h-5 w-28" variant="text" />
        <Skeleton className="h-3.5 w-20" variant="text" />
      </div>
      <div className="mt-3">
        <Skeleton className="h-10 w-24 rounded-lg" />
      </div>
      <div className="mt-4">
        <Skeleton className="h-[120px] w-full rounded-xl" />
      </div>
      <div className="mt-4">
        <Skeleton className="h-3.5 w-[90%]" variant="text" />
      </div>
      <div className="mt-4">
        <Skeleton className="h-10 w-40 rounded-xl" />
      </div>
    </div>
  );
}

export function SectionSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6">
      <Skeleton className="h-5 w-36" variant="text" />
      <div className="mt-1">
        <Skeleton className="h-3.5 w-48" variant="text" />
      </div>
      <div className="mt-4">
        <Skeleton className="h-[120px] md:h-[200px] w-full rounded-xl" />
      </div>
      <div className="mt-4">
        <Skeleton className="h-3.5 w-[85%]" variant="text" />
      </div>
    </div>
  );
}