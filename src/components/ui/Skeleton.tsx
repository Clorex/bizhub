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