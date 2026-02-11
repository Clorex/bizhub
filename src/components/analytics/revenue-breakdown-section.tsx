'use client';

import React from 'react';
import { RevenueBreakdownData } from '@/types/analytics';
import SectionHeader from '@/components/ui/section-header';
import InsightText from '@/components/ui/insight-text';
import EmptyState from '@/components/ui/empty-state';
import AnalyticsBarChart from '@/components/charts/bar-chart';
import { formatNaira } from '@/lib/analytics/format';

interface RevenueBreakdownSectionProps {
  data: RevenueBreakdownData | null;
}

export default function RevenueBreakdownSection({ data }: RevenueBreakdownSectionProps) {
  if (!data || data.top_products.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6">
        <SectionHeader title="Revenue Breakdown" subtitle="Top products by revenue" />
        <EmptyState
          title="No revenue data yet"
          description="Revenue breakdown will appear once you make sales."
          icon="product"
        />
      </div>
    );
  }

  const BAR_COLORS = ['#F97316', '#EA580C', '#FB923C', '#FDBA74', '#FED7AA'];

  const chartData = data.top_products.map((p, i) => ({
    label: p.product_name,
    value: p.revenue,
    color: BAR_COLORS[i % BAR_COLORS.length],
  }));

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6">
      <SectionHeader
        title="Revenue Breakdown"
        subtitle="Top products by revenue"
        action={
          <span className="text-sm font-semibold text-gray-600">
            Total: {formatNaira(data.total_revenue)}
          </span>
        }
      />

      {/* Bar chart */}
      <AnalyticsBarChart data={chartData} height={220} />

      {/* Product list with percentages */}
      <div className="mt-4 space-y-2">
        {data.top_products.map((product, index) => (
          <div key={product.product_id} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-orange-500 w-5">{index + 1}.</span>
              <span className="text-gray-700 font-medium">{product.product_name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-gray-500">{formatNaira(product.revenue)}</span>
              <span className="text-xs text-gray-400 w-12 text-right">
                {product.percentage.toFixed(1)}%
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Insight */}
      <InsightText text={data.insight} />
    </div>
  );
}