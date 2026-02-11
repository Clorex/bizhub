'use client';

import React from 'react';
import { EngagementData } from '@/types/analytics';
import SectionHeader from '@/components/ui/section-header';
import InsightText from '@/components/ui/insight-text';
import EmptyState from '@/components/ui/empty-state';
import { formatNumber } from '@/lib/analytics/format';

interface CustomerEngagementSectionProps {
  data: EngagementData | null;
}

export default function CustomerEngagementSection({ data }: CustomerEngagementSectionProps) {
  if (!data || (data.saves === 0 && data.cart_adds === 0 && data.shares === 0)) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6">
        <SectionHeader title="Customer Engagement" subtitle="Interest before purchase" />
        <EmptyState
          title="No engagement data yet"
          description="Engagement metrics will appear as customers interact with your store."
          icon="engagement"
        />
      </div>
    );
  }

  const maxValue = Math.max(data.saves, data.cart_adds, data.shares || 1, 1);

  const bars = [
    {
      label: 'Store Views',
      value: data.saves,
      color: '#F97316',
    },
    {
      label: 'Leads',
      value: data.cart_adds,
      color: '#EA580C',
    },
    {
      label: 'Shares',
      value: data.shares,
      color: '#FB923C',
    },
  ];

  // Filter out zero bars if shares is 0
  const activeBars = bars.filter((b) => b.value > 0);
  const displayBars = activeBars.length > 0 ? activeBars : bars;

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6">
      <SectionHeader title="Customer Engagement" subtitle="Interest before purchase" />

      {/* Custom mini bar chart */}
      <div className="flex items-end gap-3 h-40 px-2">
        {displayBars.map((bar, index) => {
          const heightPercent = maxValue > 0 ? (bar.value / maxValue) * 100 : 0;

          return (
            <div key={bar.label} className="flex flex-col items-center flex-1 gap-2">
              {/* Value on top */}
              <span className="text-sm font-bold text-gray-800">
                {formatNumber(bar.value)}
              </span>

              {/* Bar */}
              <div
                className="w-full max-w-[60px] rounded-t-lg transition-all duration-700 ease-out"
                style={{
                  height: `${Math.max(heightPercent, 4)}%`,
                  backgroundColor: bar.color,
                }}
              />

              {/* Label */}
              <span className="text-[11px] text-gray-400 text-center leading-tight">
                {bar.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div className="mt-4 text-center">
        <span className="text-sm text-gray-400">
          Total interactions:{' '}
          <span className="font-semibold text-gray-600">
            {formatNumber(data.saves + data.cart_adds + (data.shares || 0))}
          </span>
        </span>
      </div>

      {/* Insight */}
      <InsightText text={data.insight} />
    </div>
  );
}