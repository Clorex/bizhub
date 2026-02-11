'use client';

import React from 'react';
import {
  ResponsiveContainer,
  BarChart as RechartsBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { formatNaira, formatNairaCompact } from '@/lib/analytics/format';

interface BarChartDataPoint {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarChartDataPoint[];
  height?: number;
}

const BAR_COLORS = ['#F97316', '#EA580C', '#FB923C', '#FDBA74', '#FED7AA'];

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-lg">
      <p className="text-xs text-gray-400">{payload[0]?.payload?.label}</p>
      <p className="text-sm font-bold text-gray-800">{formatNaira(payload[0]?.value || 0)}</p>
    </div>
  );
}

export default function AnalyticsBarChart({ data, height = 200 }: BarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-400 text-sm" style={{ height }}>
        No revenue data available
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RechartsBarChart data={data} margin={{ top: 10, right: 10, bottom: 40, left: 40 }}>
          <CartesianGrid stroke="#E2E8F0" strokeDasharray="3 3" opacity={0.6} vertical={false} />
          <XAxis
            dataKey="label"
            stroke="#E2E8F0"
            tick={{ fontSize: 10, fill: '#94A3B8' }}
            tickSize={0}
            tickMargin={8}
            interval={0}
            angle={-20}
            textAnchor="end"
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
          <Bar
            dataKey="value"
            radius={[8, 8, 0, 0]}
            maxBarSize={48}
            animationDuration={800}
          >
            {data.map((entry, index) => (
              <Cell
                key={`bar-${index}`}
                fill={entry.color || BAR_COLORS[index % BAR_COLORS.length]}
              />
            ))}
          </Bar>
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}