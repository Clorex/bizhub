'use client';

import React from 'react';

export default function AnalyticsSummaryCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6 w-full md:max-w-[800px] animate-pulse">
      {/* Title */}
      <div className="flex items-center justify-between mb-1">
        <div className="h-5 w-28 bg-gray-200 rounded-md" />
        <div className="h-3.5 w-20 bg-gray-200 rounded-md" />
      </div>

      {/* Growth number */}
      <div className="mt-3">
        <div className="h-10 w-24 bg-gray-200 rounded-lg" />
      </div>

      {/* Chart */}
      <div className="mt-4">
        <div className="h-[120px] w-full bg-gray-200 rounded-xl" />
      </div>

      {/* Insight */}
      <div className="mt-4">
        <div className="h-3.5 w-[90%] bg-gray-200 rounded-md" />
      </div>

      {/* Button */}
      <div className="mt-4">
        <div className="h-10 w-40 bg-gray-200 rounded-xl" />
      </div>
    </div>
  );
}