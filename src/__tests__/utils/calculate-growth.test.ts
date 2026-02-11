import { BASE_URL } from '../setup';
import { calculateGrowth, getGrowthTrend, calculateProductGrowth } from '@/utils/analytics/calculate-growth';

describe('calculateGrowth', () => {
  it('should return 0 when both values are 0', () => {
    expect(calculateGrowth(0, 0)).toBe(0);
  });

  it('should return 100 when previous is 0 and current is positive', () => {
    expect(calculateGrowth(500, 0)).toBe(100);
  });

  it('should calculate positive growth correctly', () => {
    const result = calculateGrowth(1500, 1000);
    expect(result).toBe(50);
  });

  it('should calculate negative growth correctly', () => {
    const result = calculateGrowth(500, 1000);
    expect(result).toBe(-50);
  });

  it('should return 0 when values are equal', () => {
    expect(calculateGrowth(1000, 1000)).toBe(0);
  });

  it('should handle small decimal differences', () => {
    const result = calculateGrowth(100.5, 100);
    expect(result).toBeCloseTo(0.5, 1);
  });
});

describe('getGrowthTrend', () => {
  it('should return up for positive growth', () => {
    expect(getGrowthTrend(10)).toBe('up');
  });

  it('should return down for negative growth', () => {
    expect(getGrowthTrend(-5)).toBe('down');
  });

  it('should return neutral for zero growth', () => {
    expect(getGrowthTrend(0)).toBe('neutral');
  });
});

describe('calculateProductGrowth', () => {
  it('should return percentage and trend', () => {
    const result = calculateProductGrowth(20, 10);
    expect(result.percentage).toBe(100);
    expect(result.trend).toBe('up');
  });

  it('should handle decline', () => {
    const result = calculateProductGrowth(5, 10);
    expect(result.percentage).toBe(-50);
    expect(result.trend).toBe('down');
  });

  it('should handle no previous sales', () => {
    const result = calculateProductGrowth(10, 0);
    expect(result.percentage).toBe(100);
    expect(result.trend).toBe('up');
  });

  it('should handle zero both', () => {
    const result = calculateProductGrowth(0, 0);
    expect(result.percentage).toBe(0);
    expect(result.trend).toBe('neutral');
  });
});
export {}
