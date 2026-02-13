"use client";

import React from "react";
import { SalesGrowthData } from "@/types/analytics";
import SectionHeader from "@/components/ui/section-header";
import InsightText from "@/components/ui/insight-text";
import EmptyState from "@/components/ui/empty-state";
import AnalyticsAreaChart from "@/components/charts/area-chart";
import { formatNaira, formatPeakDay } from "@/lib/analytics/format";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

interface SalesGrowthSectionProps {
  data: SalesGrowthData | null;
}

function guessRangeLabel(data: any): string | null {
  const v = data?.rangeLabel || data?.range || data?.periodLabel || null;
  return v ? String(v) : null;
}

function guessUpdatedAtMs(data: any): number | null {
  const v = data?.lastUpdatedAtMs || data?.generatedAtMs || data?.updatedAtMs || null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export default function SalesGrowthSection({ data }: SalesGrowthSectionProps) {
  const daily = data?.daily_sales || [];
  const hasAnySales = daily.some((p) => Number((p as any)?.revenue || 0) > 0);

  const rangeLabel = guessRangeLabel(data);
  const updatedAtMs = guessUpdatedAtMs(data);
  const updatedLabel = updatedAtMs
    ? `Updated: ${new Date(updatedAtMs).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" })}`
    : null;

  if (!data || daily.length === 0 || !hasAnySales) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6">
        <SectionHeader
          title="Sales Growth"
          subtitle="Compared to previous period"
          metaLeft={rangeLabel ? `Range: ${rangeLabel}` : undefined}
          metaRight={updatedLabel || undefined}
        />
        <EmptyState
          title="No sales data yet"
          description="Start selling to see your growth trends here."
          icon="chart"
        />
      </div>
    );
  }

  const isPositive = data.growth_percentage > 0;
  const isNegative = data.growth_percentage < 0;
  const sign = isPositive ? "+" : "";
  const colorClass = isPositive
    ? "text-green-500"
    : isNegative
      ? "text-red-500"
      : "text-gray-400";

  const peakInsight = data.peak_day
    ? formatPeakDay(data.peak_day.date, data.peak_day.revenue)
    : "";

  return (
    <div className="bg-white rounded-2xl shadow-sm p-4 md:p-6">
      <SectionHeader
        title="Sales Growth"
        subtitle="Compared to previous period"
        metaLeft={rangeLabel ? `Range: ${rangeLabel}` : undefined}
        metaRight={updatedLabel || undefined}
        action={
          <InfoTooltip text="Growth % = (Current period total − Previous period total) ÷ Previous period total." />
        }
      />

      <div className="flex items-end gap-4 mb-4">
        <span className={`text-[2.5rem] font-extrabold leading-none tracking-tight ${colorClass}`}>
          {sign}
          {Math.round(data.growth_percentage)}%
        </span>

        <div className="text-sm text-gray-400 pb-1">
          <p>
            Current:{" "}
            <span className="font-semibold text-gray-600">
              {formatNaira(data.current_period_total)}
            </span>
          </p>
          <p>
            Previous:{" "}
            <span className="font-semibold text-gray-600">
              {formatNaira(data.previous_period_total)}
            </span>
          </p>
        </div>
      </div>

      <AnalyticsAreaChart data={daily} height={200} />

      {peakInsight && (
        <div className="mt-3 flex items-center gap-2 text-xs text-gray-400">
          <svg className="w-3.5 h-3.5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 2a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 2zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15zM10 7a3 3 0 100 6 3 3 0 000-6zM15.657 5.404a.75.75 0 10-1.06-1.06l-1.061 1.06a.75.75 0 001.06 1.061l1.06-1.06zM6.464 14.596a.75.75 0 10-1.06-1.06l-1.06 1.06a.75.75 0 001.06 1.06l1.06-1.06zM18 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 0118 10zM5 10a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5A.75.75 0 015 10zM14.596 15.657a.75.75 0 001.06-1.06l-1.06-1.061a.75.75 0 10-1.06 1.06l1.06 1.06zM5.404 6.464a.75.75 0 001.06-1.06l-1.06-1.06a.75.75 0 10-1.061 1.06l1.06 1.06z" />
          </svg>
          <span>{peakInsight}</span>
        </div>
      )}

      <InsightText text={data.insight} />
    </div>
  );
}