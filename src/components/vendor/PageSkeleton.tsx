// FILE: src/components/vendor/PageSkeleton.tsx
"use client";

import { memo } from "react";
import { cn } from "@/lib/cn";

function Bone({ className }: { className?: string }) {
  return (
    <div className={cn("bg-gray-200 rounded-xl animate-pulse", className)} />
  );
}

export const PageSkeleton = memo(function PageSkeleton() {
  return (
    <div className="px-4 pt-4 space-y-4">
      {/* Segmented control skeleton */}
      <Bone className="h-12 rounded-2xl" />
      
      {/* Hero card skeleton */}
      <Bone className="h-56 rounded-3xl" />

      {/* Stats grid skeleton */}
      <div className="grid grid-cols-2 gap-3">
        <Bone className="h-28 rounded-2xl" />
        <Bone className="h-28 rounded-2xl" />
      </div>

      {/* Section skeleton */}
      <Bone className="h-8 w-40 rounded-lg" />
      <div className="space-y-2">
        <Bone className="h-20 rounded-2xl" />
        <Bone className="h-20 rounded-2xl" />
        <Bone className="h-20 rounded-2xl" />
      </div>
    </div>
  );
});

export const DetailSkeleton = memo(function DetailSkeleton() {
  return (
    <div className="px-4 pt-4 space-y-4">
      <Bone className="h-48 rounded-3xl" />
      <Bone className="h-20 rounded-2xl" />
      <Bone className="h-36 rounded-2xl" />
      <Bone className="h-52 rounded-2xl" />
    </div>
  );
});

export const FormSkeleton = memo(function FormSkeleton() {
  return (
    <div className="px-4 pt-4 space-y-4">
      <Bone className="h-14 rounded-2xl" />
      <Bone className="h-14 rounded-2xl" />
      <Bone className="h-28 rounded-2xl" />
      <Bone className="h-14 rounded-2xl" />
      <Bone className="h-44 rounded-2xl" />
      <Bone className="h-14 rounded-2xl" />
    </div>
  );
});

export const ListSkeleton = memo(function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="px-4 pt-4 space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Bone key={i} className="h-20 rounded-2xl" />
      ))}
    </div>
  );
});

export const GridSkeleton = memo(function GridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="px-4 pt-4">
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: count }).map((_, i) => (
          <Bone key={i} className="h-48 rounded-2xl" />
        ))}
      </div>
    </div>
  );
});