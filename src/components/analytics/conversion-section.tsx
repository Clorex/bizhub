// FILE: src/components/analytics/conversion-section.tsx
"use client";

import React from "react";
import { ConversionData } from "@/types/analytics";
import SectionHeader from "@/components/ui/section-header";
import InsightText from "@/components/ui/insight-text";
import EmptyState from "@/components/ui/empty-state";
import DonutChart from "@/components/charts/donut-chart";
import { formatPercentageClean, formatNumber } from "@/lib/analytics/format";

interface ConversionSectionProps {
  data: ConversionData | null;
}

export default function ConversionSection({ data }: ConversionSectionProps) {
  if (!data || (data.profile_views === 0 && data.product_clicks === 0 && data.purchases === 0)) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6">
        <SectionHeader title="Conversion Performance" subtitle="Visits → Leads → Orders" />
        <EmptyState
          title="No conversion data yet"
          description="Conversion tracking starts when customers visit your store."
          icon="chart"
        />
      </div>
    );
  }

  const total = data.profile_views + data.product_clicks + data.purchases;

  const donutData =
    total > 0
      ? [
          {
            label: "Visits",
            value: data.profile_views,
            color: "#FED7AA",
            percentage: (data.profile_views / total) * 100,
          },
          {
            label: "Leads",
            value: data.product_clicks,
            color: "#F97316",
            percentage: (data.product_clicks / total) * 100,
          },
          {
            label: "Orders",
            value: data.purchases,
            color: "#EA580C",
            percentage: (data.purchases / total) * 100,
          },
        ]
      : [{ label: "No Data", value: 1, color: "#94A3B8", percentage: 100 }];

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6">
      <SectionHeader title="Conversion Performance" subtitle="Visits → Leads → Orders" />

      {/* IMPORTANT: Give the chart a real width so ResponsiveContainer can render */}
      <div className="w-full max-w-[420px] mx-auto">
        <DonutChart
          data={donutData}
          centerValue={formatPercentageClean(data.conversion_rate, 1)}
          centerLabel="Conversion"
          height={220}
        />
      </div>

      {/* Stats row */}
      <div className="mt-6 grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-2xl font-bold text-gray-800">{formatNumber(data.profile_views)}</p>
          <p className="text-xs text-gray-400 mt-1">Visits</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-800">{formatNumber(data.product_clicks)}</p>
          <p className="text-xs text-gray-400 mt-1">Leads</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-800">{formatNumber(data.purchases)}</p>
          <p className="text-xs text-gray-400 mt-1">Orders</p>
        </div>
      </div>

      <InsightText text={data.insight} />
    </div>
  );
}