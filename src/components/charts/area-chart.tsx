'use client';

import React from 'react';
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
import { formatNaira, formatNairaCompact, formatChartDate } from '@/lib/analytics/format';

interface AreaChartProps {
  data: DailySalesPoint[];
  height?: number;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0]?.payload as DailySalesPoint;

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-lg">
      <p className="text-xs text-gray-400">{formatChartDate(point?.date)}</p>
      <p className="text-sm font-bold text-gray-800">{formatNaira(point?.revenue || 0)}</p>
    </div>
  );
}

export default function AnalyticsAreaChart({ data, height = 200 }: AreaChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-400 text-sm" style={{ height }}>
        No sales data available
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
            tickFormatter={(val) => formatNairaCompact(val)}
            stroke="#E2E8F0"
            tick={{ fontSize: 11, fill: '#94A3B8' }}
            tickSize={0}
            tickMargin={8}
            width={55}
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