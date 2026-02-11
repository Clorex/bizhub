'use client';

import React from 'react';
import { AnalyticsSummary } from '@/types/analytics';
import MiniLineChart from '@/components/charts/mini-line-chart';
import InsightText from '@/components/ui/insight-text';
import { formatNaira } from '@/lib/analytics/format';

interface AnalyticsSummaryCardProps {
  data: AnalyticsSummary;
  periodLabel?: string;
  onViewFull?: () => void;
}

/**
 * Analytics Summary Card — for vendor dashboard.
 * Uses your existing data shape via adapter.
 * Naira currency. Orange brand.
 */
export default function AnalyticsSummaryCard({
  data,
  periodLabel = 'This Period',
  onViewFull,
}: AnalyticsSummaryCardProps) {
  const isPositive = data.sales_growth_percentage > 0;
  const isNegative = data.sales_growth_percentage < 0;
  const sign = isPositive ? '+' : '';
  const colorClass = isPositive
    ? 'text-green-500'
    : isNegative
    ? 'text-red-500'
    : 'text-gray-400';

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6 w-full md:max-w-[800px]">
      {/* Title row */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-lg font-bold text-gray-800">Sales Growth</h3>
        <span className="text-xs text-gray-400">{periodLabel}</span>
      </div>

      {/* Large growth percentage */}
      <div className="mt-2">
        <span className={`text-[2.5rem] font-extrabold leading-none tracking-tight ${colorClass}`}>
          {sign}{Math.round(data.sales_growth_percentage)}%
        </span>
      </div>

      {/* Mini chart */}
      <div className="mt-4">
        <MiniLineChart data={data.daily_sales} height={120} />
      </div>

      {/* Insight */}
      <InsightText text={data.insight} />

      {/* CTA Button */}
      {onViewFull && (
        <div className="mt-4">
          <button
            onClick={onViewFull}
            className="inline-flex items-center justify-center px-5 py-2.5 bg-orange-500 text-white text-sm font-semibold rounded-xl hover:bg-orange-600 active:bg-orange-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-300 focus:ring-offset-2"
          >
            View Full Analysis
          </button>
        </div>
      )}
    </div>
  );
}