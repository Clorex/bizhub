import { safeDivide, safePercentage } from '@/utils/analytics/safe-divide';

describe('safeDivide', () => {
  it('should divide normally when denominator is not 0', () => {
    expect(safeDivide(10, 2)).toBe(5);
  });

  it('should return 100 when denominator is 0 and numerator is positive', () => {
    expect(safeDivide(50, 0)).toBe(100);
  });

  it('should return 0 when both are 0', () => {
    expect(safeDivide(0, 0)).toBe(0);
  });

  it('should handle decimal values', () => {
    expect(safeDivide(1, 3)).toBeCloseTo(0.333, 2);
  });
});

describe('safePercentage', () => {
  it('should calculate percentage correctly', () => {
    expect(safePercentage(25, 100)).toBe(25);
  });

  it('should return 100 when whole is 0 and part is positive', () => {
    expect(safePercentage(10, 0)).toBe(100);
  });

  it('should return 0 when both are 0', () => {
    expect(safePercentage(0, 0)).toBe(0);
  });

  it('should handle part larger than whole', () => {
    expect(safePercentage(150, 100)).toBe(150);
  });
});