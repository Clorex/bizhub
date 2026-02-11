'use client';

import React, { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart as RechartsAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { DailySalesPoint } from '@/types/analytics';
import { formatChartDate } from '@/lib/analytics/format';

interface AreaChartProps {
  data: DailySalesPoint[];
  height?: number;
}

const NAIRA = '\u20A6';

function formatNairaWithCommas(value: any) {
  const n = Number(value || 0);
  const safe = Number.isFinite(n) ? n : 0;
  return `${NAIRA}${safe.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
}

/**
 * Interval Rules (required):
 * If max < 10,000      -> 1,000
 * If max < 100,000     -> 10,000
 * If max < 1,000,000   -> 100,000
 * If max >= 1,000,000  -> 500,000 or 1,000,000
 */
function revenueInterval(maxRevenue: number) {
  if (maxRevenue < 10_000) return 1_000;
  if (maxRevenue < 100_000) return 10_000;
  if (maxRevenue < 1_000_000) return 100_000;
  return maxRevenue < 5_000_000 ? 500_000 : 1_000_000;
}

// Nice max rounding (matches examples: 120k -> 150k, 1.2m -> 1.5m)
function niceMax(maxValue: number) {
  if (maxValue <= 0) return 0;

  const magnitude = Math.pow(10, Math.floor(Math.log10(maxValue)));
  const normalized = maxValue / magnitude;

  const steps = [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10];
  const chosen = steps.find((s) => normalized <= s) ?? 10;

  return chosen * magnitude;
}

function buildAxis(data: DailySalesPoint[]) {
  const maxRevenue = Math.max(0, ...data.map((d) => Number(d?.revenue || 0)));

  if (maxRevenue <= 0) {
    return { maxRevenue: 0, interval: 0, yMax: 0, ticks: [] as number[] };
  }

  const interval = revenueInterval(maxRevenue);
  const target = niceMax(maxRevenue);

  // Align to interval so ticks are clean (0, interval, 2*interval, ...)
  const yMax = Math.max(interval, Math.ceil(target / interval) * interval);

  const ticks: number[] = [];
  for (let t = 0; t <= yMax; t += interval) ticks.push(t);

  return { maxRevenue, interval, yMax, ticks };
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0]?.payload as DailySalesPoint;

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-lg">
      <p className="text-xs text-gray-400">{formatChartDate(point?.date)}</p>
      <p className="text-sm font-bold text-gray-800">{formatNairaWithCommas(point?.revenue || 0)}</p>
    </div>
  );
}

export default function AnalyticsAreaChart({ data, height = 200 }: AreaChartProps) {
  const axis = useMemo(() => buildAxis(data || []), [data]);

  // Edge case: vendor has no sales (all points are 0)
  if (!data || data.length === 0 || axis.maxRevenue <= 0) {
    return (
      <div className="flex items-center justify-center text-gray-400 text-sm" style={{ height }}>
        No sales data yet
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsAreaChart data={data} margin={{ top: 10, right: 10, bottom: 20, left: 40 }}>
          <defs>
            <linearGradient id="areaGradientNaira" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F97316" stopOpacity={0.25} />
              <stop offset="100%" stopColor="#F97316" stopOpacity={0.01} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" opacity={0.6} vertical={false} />

          <XAxis
            dataKey="date"
            tickFormatter={formatChartDate}
            stroke="#E2E8F0"
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            tickSize={0}
            tickMargin={8}
            interval="preserveStartEnd"
          />

          <YAxis
            domain={[0, axis.yMax]}
            ticks={axis.ticks}
            allowDecimals={false}
            tickFormatter={(val) => formatNairaWithCommas(val)}
            stroke="#E2E8F0"
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            tickSize={0}
            tickMargin={8}
            width={70}
          />

          <Tooltip content={<CustomTooltip />} />

          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#F97316"
            strokeWidth={2.5}
            fill="url(#areaGradientNaira)"
            dot={false}
            activeDot={{
              r: 5,
              stroke: '#F97316',
              strokeWidth: 2,
              fill: '#FFFFFF',
            }}
            animationDuration={800}
          />
        </RechartsAreaChart>
      </ResponsiveContainer>
    </div>
  );
}