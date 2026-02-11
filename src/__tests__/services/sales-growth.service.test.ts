import { BASE_URL } from '../setup';
import { generateSalesGrowthInsight } from '@/services/analytics/insight-generator';

describe('Sales Growth Insights', () => {
  it('should return strong growth message for >20%', () => {
    const insight = generateSalesGrowthInsight(25);
    expect(insight).toBe('Your sales are growing strongly.');
  });

  it('should return steady growth message for 0-20%', () => {
    const insight = generateSalesGrowthInsight(10);
    expect(insight).toBe('You are growing steadily.');
  });

  it('should return steady growth message for exactly 0%', () => {
    const insight = generateSalesGrowthInsight(0);
    expect(insight).toBe('You are growing steadily.');
  });

  it('should return decline message for negative growth', () => {
    const insight = generateSalesGrowthInsight(-15);
    expect(insight).toBe('Your sales declined. Consider improving product images or pricing.');
  });

  it('should handle exactly 20%', () => {
    const insight = generateSalesGrowthInsight(20);
    expect(insight).toBe('You are growing steadily.');
  });

  it('should handle exactly 20.01%', () => {
    const insight = generateSalesGrowthInsight(20.01);
    expect(insight).toBe('Your sales are growing strongly.');
  });
});