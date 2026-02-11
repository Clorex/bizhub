import { BASE_URL } from '../setup';
import React from 'react';

// Mock recharts
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  AreaChart: ({ children }: any) => <div>{children}</div>,
  Area: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  CartesianGrid: () => <div />,
  Tooltip: () => <div />,
}));

describe('SalesGrowthSection', () => {
  it('should render without crashing with null data', () => {
    const { render, screen } = require('@testing-library/react');
    const SalesGrowthSection = require('@/components/analytics/sales-growth-section').default;

    render(<SalesGrowthSection data={null} />);
    expect(screen.getByText('No sales data yet')).toBeTruthy();
  });

  it('should render with valid data', () => {
    const { render, screen } = require('@testing-library/react');
    const SalesGrowthSection = require('@/components/analytics/sales-growth-section').default;

    const data = {
      current_period_total: 5000,
      previous_period_total: 3000,
      growth_percentage: 66.67,
      daily_sales: Array.from({ length: 30 }, (_, i) => ({
        date: `2025-01-${String(i + 1).padStart(2, '0')}`,
        revenue: 100 + Math.random() * 200,
        orders: 3,
      })),
      peak_day: { date: '2025-01-15', revenue: 350, orders: 8 },
      insight: 'Your sales are growing strongly.',
    };

    render(<SalesGrowthSection data={data} />);
    expect(screen.getByText('Sales Growth')).toBeTruthy();
  });
});
export {}
