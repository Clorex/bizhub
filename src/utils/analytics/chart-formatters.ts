import { DailySalesPoint } from '@/types/analytics';
import { formatCurrencyCompact } from './format-currency';
import { formatChartDate } from './date-ranges';
import { ANALYTICS_CONFIG } from '@/config/analytics.config';

/**
 * Format daily sales data for line/area chart consumption.
 */
export interface ChartDataPoint {
  label: string;
  value: number;
  date: string;
}

export function formatSalesForChart(
  dailySales: DailySalesPoint[]
): ChartDataPoint[] {
  return dailySales.map((point) => ({
    label: formatChartDate(point.date),
    value: point.revenue,
    date: point.date,
  }));
}

/**
 * Format bar chart data for revenue breakdown.
 */
export interface BarChartDataPoint {
  label: string;
  value: number;
  color: string;
}

export function formatRevenueForBarChart(
  products: { product_name: string; revenue: number }[]
): BarChartDataPoint[] {
  const colors = [
    ANALYTICS_CONFIG.COLORS.primary,
    ANALYTICS_CONFIG.COLORS.primaryDark,
    '#FB923C',
    '#FDBA74',
    ANALYTICS_CONFIG.COLORS.primaryLight,
  ];

  return products.map((product, index) => ({
    label: product.product_name,
    value: product.revenue,
    color: colors[index % colors.length],
  }));
}

/**
 * Format donut chart segments.
 */
export interface DonutSegment {
  label: string;
  value: number;
  color: string;
  percentage: number;
}

export function formatConversionForDonut(data: {
  profile_views: number;
  product_clicks: number;
  purchases: number;
}): DonutSegment[] {
  const total = data.profile_views + data.product_clicks + data.purchases;

  if (total === 0) {
    return [
      { label: 'No Data', value: 1, color: ANALYTICS_CONFIG.COLORS.grey, percentage: 100 },
    ];
  }

  return [
    {
      label: 'Views',
      value: data.profile_views,
      color: ANALYTICS_CONFIG.COLORS.primaryLight,
      percentage: (data.profile_views / total) * 100,
    },
    {
      label: 'Clicks',
      value: data.product_clicks,
      color: ANALYTICS_CONFIG.COLORS.primary,
      percentage: (data.product_clicks / total) * 100,
    },
    {
      label: 'Purchases',
      value: data.purchases,
      color: ANALYTICS_CONFIG.COLORS.primaryDark,
      percentage: (data.purchases / total) * 100,
    },
  ];
}

/**
 * Format engagement data for mini bar chart.
 */
export interface EngagementBarData {
  label: string;
  value: number;
  color: string;
}

export function formatEngagementForChart(data: {
  saves: number;
  cart_adds: number;
  shares: number;
}): EngagementBarData[] {
  return [
    {
      label: 'Saves',
      value: data.saves,
      color: ANALYTICS_CONFIG.COLORS.primary,
    },
    {
      label: 'Cart Adds',
      value: data.cart_adds,
      color: ANALYTICS_CONFIG.COLORS.primaryDark,
    },
    {
      label: 'Shares',
      value: data.shares,
      color: '#FB923C',
    },
  ];
}

/**
 * Get Y-axis tick values for a dataset.
 * Returns 5 evenly spaced values from 0 to max.
 */
export function getYAxisTicks(data: number[], tickCount: number = 5): number[] {
  if (data.length === 0) return [0];

  const max = Math.max(...data);
  if (max === 0) return [0];

  const step = Math.ceil(max / (tickCount - 1));
  const ticks: number[] = [];

  for (let i = 0; i < tickCount; i++) {
    ticks.push(step * i);
  }

  return ticks;
}

/**
 * Format Y-axis label for currency values.
 */
export function formatYAxisLabel(value: number): string {
  return formatCurrencyCompact(value);
}