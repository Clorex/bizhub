'use client';

import React from 'react';
import { DailySalesPoint } from '@/types/analytics';
import MiniLineChart from '@/components/charts/mini-line-chart';

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
 * Locked Analytics Summary Card
 * Shown to free-tier vendors on dashboard.
 * Blurred chart with lock overlay and upgrade CTA.
 */
export default function AnalyticsSummaryCardLocked({ onUpgrade }: AnalyticsSummaryCardLockedProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm overflow-hidden relative">
      {/* Blurred content */}
      <div className="p-4 md:p-6 filter blur-[8px] pointer-events-none select-none" aria-hidden="true">
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
        <div className="mt-4 text-sm text-gray-500 bg-gray-50 rounded-xl px-4 py-3">
          💡 Your sales are growing strongly.
        </div>
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/85 backdrop-blur-sm z-10 p-6 text-center">
        {/* Lock icon */}
        <svg
          className="w-12 h-12 text-orange-500 mb-4"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
          />
        </svg>

        <h3 className="text-xl font-bold text-gray-800 mb-2">
          Unlock Advanced Analytics
        </h3>
        <p className="text-sm text-gray-500 mb-5 max-w-[280px]">
          See growth trends, revenue breakdown, and actionable insights.
        </p>

        <button
          onClick={onUpgrade}
          className="inline-flex items-center justify-center px-6 py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 transition-all duration-200"
        >
          Upgrade Now
        </button>
      </div>
    </div>
  );
}