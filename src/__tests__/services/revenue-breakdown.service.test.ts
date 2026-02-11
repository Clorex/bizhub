import { generateRevenueBreakdownInsight } from '@/services/analytics/insight-generator';

describe('Revenue Breakdown Insights', () => {
  it('should show product name and percentage', () => {
    const insight = generateRevenueBreakdownInsight('Leather Handbag', 42);
    expect(insight).toBe('Leather Handbag generates 42% of your revenue.');
  });

  it('should warn about diversification when >50%', () => {
    const insight = generateRevenueBreakdownInsight('Gold Earrings', 65);
    expect(insight).toContain('Consider diversifying');
  });

  it('should handle empty product name', () => {
    const insight = generateRevenueBreakdownInsight('', 0);
    expect(insight).toBe('No revenue data available yet.');
  });

  it('should round percentage correctly', () => {
    const insight = generateRevenueBreakdownInsight('Silk Scarf', 33.7);
    expect(insight).toContain('34%');
  });
});