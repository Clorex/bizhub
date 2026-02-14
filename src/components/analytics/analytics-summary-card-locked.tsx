'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { DailySalesPoint } from '@/types/analytics';
import MiniLineChart from '@/components/charts/mini-line-chart';
import { BarChart3, ChevronRight } from 'lucide-react';

interface AnalyticsSummaryCardLockedProps {
  onUpgrade?: () => void;
}

// Fake data for the blurred preview
const fakeData: DailySalesPoint[] = Array.from({ length: 14 }, (_, i) => ({
  date: new Date(Date.now() - (13 - i) * 86400000).toISOString().split('T')[0],
  revenue: Math.random() * 50000 + 10000,
  orders: Math.floor(Math.random() * 10) + 1,
}));

/**
 * Analytics Summary Card - Teaser version
 * Shows a preview with CTA to view full analytics.
 * NO upgrade prompts - just invites user to see more.
 */
export default function AnalyticsSummaryCardLocked({ onUpgrade }: AnalyticsSummaryCardLockedProps) {
  const router = useRouter();

  const handleViewMore = () => {
    router.push('/vendor/analytics');
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden relative">
      {/* Blurred content preview */}
      <div className="p-4 md:p-6 filter blur-[6px] pointer-events-none select-none opacity-60" aria-hidden="true">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-lg font-bold text-gray-800">Sales Growth</h3>
          <span className="text-xs text-gray-400">This Week</span>
        </div>
        <div className="mt-2">
          <span className="text-[2.5rem] font-extrabold text-green-500 leading-none">+47%</span>
        </div>
        <div className="mt-4">
          <MiniLineChart data={fakeData} height={120} />
        </div>
      </div>

      {/* CTA overlay - no upgrade message, just "see more" */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm z-10 p-6 text-center">
        {/* Analytics icon */}
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mb-4">
          <BarChart3 className="w-7 h-7 text-white" />
        </div>

        <h3 className="text-lg font-bold text-gray-900 mb-2">
          Sales Analysis
        </h3>
        <p className="text-sm text-gray-500 mb-5 max-w-[280px]">
          View detailed growth trends, revenue breakdown, and actionable insights for your store.
        </p>

        <button
          onClick={handleViewMore}
          className="inline-flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-br from-orange-500 to-orange-600 text-white text-sm font-semibold rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all duration-200 shadow-sm"
        >
          See more analysis
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
