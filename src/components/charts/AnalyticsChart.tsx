// FILE: src/components/charts/AnalyticsChart.tsx
"use client";

import { useMemo } from "react";

export interface ChartDataPoint {
  label: string;
  value: number;
  secondaryValue?: number;
}

interface AnalyticsChartProps {
  data: ChartDataPoint[];
  type?: "bar" | "line";
  color?: string;
  secondaryColor?: string;
  height?: number;
  formatValue?: (n: number) => string;
  formatTooltip?: (point: ChartDataPoint) => string;
  showSecondary?: boolean;
  emptyMessage?: string;
}

function getSmartYScale(maxValue: number): number[] {
  if (maxValue <= 0) return [100, 75, 50, 25, 0];
  
  const magnitude = Math.pow(10, Math.floor(Math.log10(maxValue)));
  const normalized = maxValue / magnitude;
  
  let niceMax: number;
  if (normalized <= 1) niceMax = 1 * magnitude;
  else if (normalized <= 1.5) niceMax = 1.5 * magnitude;
  else if (normalized <= 2) niceMax = 2 * magnitude;
  else if (normalized <= 2.5) niceMax = 2.5 * magnitude;
  else if (normalized <= 3) niceMax = 3 * magnitude;
  else if (normalized <= 4) niceMax = 4 * magnitude;
  else if (normalized <= 5) niceMax = 5 * magnitude;
  else if (normalized <= 7.5) niceMax = 7.5 * magnitude;
  else niceMax = 10 * magnitude;
  
  if (niceMax < maxValue * 1.1) {
    niceMax = niceMax * 1.5;
  }
  
  const step = niceMax / 4;
  return [niceMax, step * 3, step * 2, step, 0];
}

function formatCompact(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toFixed(0);
}

export function AnalyticsChart({
  data,
  color = "bg-orange-500",
  secondaryColor = "bg-orange-300",
  height = 200,
  formatValue = formatCompact,
  formatTooltip,
  showSecondary = false,
  emptyMessage = "No data available",
}: AnalyticsChartProps) {
  const { yScale, chartMax } = useMemo(() => {
    const primaryMax = Math.max(0, ...data.map((d) => d.value));
    const secondaryMax = showSecondary 
      ? Math.max(0, ...data.map((d) => d.secondaryValue || 0))
      : 0;
    const max = Math.max(primaryMax, secondaryMax);
    const scale = getSmartYScale(max);
    return { yScale: scale, chartMax: scale[0] };
  }, [data, showSecondary]);

  if (data.length === 0) {
    return (
      <div 
        className="flex items-center justify-center text-gray-400 font-medium text-sm bg-gray-50 rounded-xl"
        style={{ height }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="relative w-full" style={{ height }}>
        {/* Y-axis labels and grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pb-8">
          {yScale.map((val, i) => (
            <div key={i} className="flex items-center w-full">
              <span className="text-[10px] font-semibold text-gray-400 w-12 text-right pr-3 shrink-0 tabular-nums">
                {formatValue(val)}
              </span>
              <div className="flex-1 border-b border-gray-100" />
            </div>
          ))}
        </div>

        {/* Bars */}
        <div className="absolute inset-0 left-12 flex items-end justify-around pb-8 gap-1">
          {data.map((d, idx) => {
            const primaryHeight = chartMax > 0 ? (d.value / chartMax) * 100 : 0;
            const secondaryHeight = showSecondary && chartMax > 0 
              ? ((d.secondaryValue || 0) / chartMax) * 100 
              : 0;

            const tooltipText = formatTooltip 
              ? formatTooltip(d)
              : `${d.label}: ${formatValue(d.value)}`;

            return (
              <div 
                key={idx} 
                className="flex flex-col items-center justify-end h-full flex-1 max-w-16 relative group"
              >
                {/* Tooltip */}
                <div className="opacity-0 group-hover:opacity-100 absolute -top-12 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-semibold py-2 px-3 rounded-lg whitespace-nowrap transition-opacity z-30 pointer-events-none shadow-lg">
                  {tooltipText}
                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
                </div>

                {/* Bars container */}
                <div className="flex items-end justify-center gap-1 w-full h-full">
                  {showSecondary && (
                    <div
                      className={`w-2/5 ${secondaryColor} rounded-t transition-all duration-500 cursor-pointer hover:opacity-80`}
                      style={{ 
                        height: `${Math.max(secondaryHeight, d.secondaryValue && d.secondaryValue > 0 ? 2 : 0)}%`,
                        minHeight: d.secondaryValue && d.secondaryValue > 0 ? 4 : 0,
                      }}
                    />
                  )}
                  <div
                    className={`${showSecondary ? 'w-2/5' : 'w-3/5'} ${color} rounded-t transition-all duration-500 cursor-pointer hover:opacity-80`}
                    style={{ 
                      height: `${Math.max(primaryHeight, d.value > 0 ? 2 : 0)}%`,
                      minHeight: d.value > 0 ? 4 : 0,
                    }}
                  />
                </div>

                {/* X-axis label */}
                <div className="absolute -bottom-7 w-full text-center">
                  <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                    {d.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}