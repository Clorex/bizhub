import React from 'react';
import { render, screen } from '@testing-library/react';
import AnalyticsSummaryCard from '@/components/analytics/analytics-summary-card';
import { AnalyticsSummary } from '@/types/analytics';

// Mock recharts to avoid canvas issues in tests
jest.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  AreaChart: ({ children }: any) => <div data-testid="area-chart">{children}</div>,
  Area: () => <div />,
  Tooltip: () => <div />,
}));

const mockData: AnalyticsSummary = {
  sales_growth_percentage: 25,
  daily_sales: Array.from({ length: 30 }, (_, i) => ({
    date: `2025-01-${String(i + 1).padStart(2, '0')}`,
    revenue: Math.random() * 500,
    orders: Math.floor(Math.random() * 10),
  })),
  insight: 'Your sales are growing strongly.',
};

describe('AnalyticsSummaryCard', () => {
  it('should render sales growth title', () => {
    render(<AnalyticsSummaryCard data={mockData} />);
    expect(screen.getByText('Sales Growth')).toBeTruthy();
  });

  it('should render growth percentage', () => {
    render(<AnalyticsSummaryCard data={mockData} />);
    expect(screen.getByText('+25%')).toBeTruthy();
  });

  it('should render insight text', () => {
    render(<AnalyticsSummaryCard data={mockData} />);
    expect(screen.getByText('Your sales are growing strongly.')).toBeTruthy();
  });

  it('should render view full analysis button', () => {
    render(<AnalyticsSummaryCard data={mockData} />);
    expect(screen.getByText('View Full Analysis')).toBeTruthy();
  });

  it('should handle negative growth', () => {
    const negativeData: AnalyticsSummary = {
      ...mockData,
      sales_growth_percentage: -15,
      insight: 'Your sales declined.',
    };
    render(<AnalyticsSummaryCard data={negativeData} />);
    expect(screen.getByText('-15%')).toBeTruthy();
  });

  it('should handle zero growth', () => {
    const zeroData: AnalyticsSummary = {
      ...mockData,
      sales_growth_percentage: 0,
      insight: 'Steady performance.',
    };
    render(<AnalyticsSummaryCard data={zeroData} />);
    expect(screen.getByText('+0%')).toBeTruthy();
  });
});