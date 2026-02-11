'use client';

import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
} from 'recharts';
import { DailySalesPoint } from '@/types/analytics';
import { formatNaira, formatChartDate } from '@/lib/analytics/format';

interface MiniLineChartProps {
  data: DailySalesPoint[];
  height?: number;
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl px-3 py-2 shadow-lg">
      <p className="text-xs text-gray-400">{formatChartDate(payload[0]?.payload?.date)}</p>
      <p className="text-sm font-bold text-gray-800">{formatNaira(payload[0]?.value || 0)}</p>
    </div>
  );
}

export default function MiniLineChart({ data, height = 120 }: MiniLineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex items-center justify-center text-gray-400 text-sm" style={{ height }}>
        No data available
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height, maxHeight: height, overflow: 'hidden' }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
          <defs>
            <linearGradient id="miniGradientNaira" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F97316" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#F97316" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <Tooltip content={<CustomTooltip />} />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke="#F97316"
            strokeWidth={2.5}
            fill="url(#miniGradientNaira)"
            dot={false}
            activeDot={{
              r: 5,
              stroke: '#F97316',
              strokeWidth: 2,
              fill: '#FFFFFF',
            }}
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}