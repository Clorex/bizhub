// FILE: src/app/vendor/analytics/loading.tsx
import React from "react";
import { SectionSkeleton, Skeleton } from "@/components/ui/Skeleton";

export default function AnalyticsLoading() {
  return (
    <div className="analytics-container">
      {/* Header skeleton */}
      <div className="mb-6 md:mb-8">
        <Skeleton className="h-8 w-36 rounded-xl" />
        <div className="mt-2">
          <Skeleton className="h-4 w-64 rounded-xl" />
        </div>
      </div>

      {/* Sections skeleton */}
      <div className="analytics-grid">
        {/* Sales Growth */}
        <SectionSkeleton />

        {/* Two column row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <SectionSkeleton />
          <SectionSkeleton />
        </div>

        {/* Top Products */}
        <SectionSkeleton />

        {/* Engagement */}
        <SectionSkeleton />
      </div>
    </div>
  );
}