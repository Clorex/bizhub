import { safeDivide } from './safe-divide';

/**
 * Calculate growth percentage between two periods.
 *
 * If previous = 0 and current > 0 → returns 100
 * If both = 0 → returns 0
 * Otherwise → ((current - previous) / previous) * 100
 */
export function calculateGrowth(current: number, previous: number): number {
  if (previous === 0 && current === 0) {
    return 0;
  }

  if (previous === 0 && current > 0) {
    return 100;
  }

  const growth = ((current - previous) / previous) * 100;
  return Math.round(growth * 100) / 100;
}

/**
 * Determine the trend direction based on growth percentage.
 */
export function getGrowthTrend(growth: number): 'up' | 'down' | 'neutral' {
  if (growth > 0) return 'up';
  if (growth < 0) return 'down';
  return 'neutral';
}

/**
 * Calculate growth between two arrays of daily values.
 * Sums each array and computes the growth.
 */
export function calculatePeriodGrowth(
  currentPeriod: number[],
  previousPeriod: number[]
): number {
  const currentTotal = currentPeriod.reduce((sum, val) => sum + val, 0);
  const previousTotal = previousPeriod.reduce((sum, val) => sum + val, 0);
  return calculateGrowth(currentTotal, previousTotal);
}

/**
 * Calculate the product-level growth percentage.
 */
export function calculateProductGrowth(
  currentUnits: number,
  previousUnits: number
): { percentage: number; trend: 'up' | 'down' | 'neutral' } {
  const percentage = calculateGrowth(currentUnits, previousUnits);
  const trend = getGrowthTrend(percentage);
  return { percentage, trend };
}