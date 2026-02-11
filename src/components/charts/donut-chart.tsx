// FILE: src/components/charts/donut-chart.tsx
"use client";

import React from "react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";
import { formatPercentageClean } from "@/lib/analytics/format";

interface DonutSegment {
  label: string;
  value: number;
  color: string;
  percentage: number;
}

interface DonutChartProps {
  data: DonutSegment[];
  centerValue: string;
  centerLabel: string;
  height?: number;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;

  const segment = payload[0]?.payload as DonutSegment;

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-lg">
      <p className="text-xs text-gray-400">{segment?.label}</p>
      <p className="text-sm font-bold text-gray-800">
        {segment?.value?.toLocaleString()} ({formatPercentageClean(segment?.percentage || 0)})
      </p>
    </div>
  );
}

/**
 * Important:
 * - ResponsiveContainer needs a parent with a real width.
 * - This component forces width: 100% and expects the parent wrapper to be full width.
 */
export default function DonutChart({
  data,
  centerValue,
  centerLabel,
  height = 220,
}: DonutChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-400 text-sm" style={{ height }}>
        No conversion data available
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Chart */}
      <div className="relative w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="85%"
              paddingAngle={3}
              dataKey="value"
              stroke="none"
              animationDuration={800}
            >
              {data.map((entry, index) => (
                <Cell key={`donut-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-extrabold text-gray-800 leading-none">
            {centerValue}
          </span>
          <span className="text-[11px] text-gray-400 mt-1 uppercase tracking-wider">
            {centerLabel}
          </span>
        </div>
      </div>

      {/* Legend (below chart, not absolute) */}
      <div className="mt-3 flex flex-wrap justify-center gap-4">
        {data.map((segment, index) => (
          <div key={`legend-${index}`} className="flex items-center gap-2 text-xs text-gray-700">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: segment.color }}
            />
            <span>{segment.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}