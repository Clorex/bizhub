import { DateRange, AnalyticsPeriod } from '@/types/analytics';
import { ANALYTICS_CONFIG } from '@/config/analytics.config';

/**
 * Get today at start of day (00:00:00.000).
 */
export function getStartOfToday(): Date {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return now;
}

/**
 * Get end of today (23:59:59.999).
 */
export function getEndOfToday(): Date {
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  return now;
}

/**
 * Get a date N days ago at start of day.
 */
export function daysAgo(days: number): Date {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(0, 0, 0, 0);
  return date;
}

/**
 * Get the current and previous analysis periods.
 *
 * Current: last 30 days (today minus 29 days → today)
 * Previous: 30 days before that (today minus 59 days → today minus 30 days)
 */
export function getAnalyticsPeriods(
  periodDays: number = ANALYTICS_CONFIG.DEFAULT_PERIOD_DAYS
): AnalyticsPeriod {
  const now = getEndOfToday();

  const currentStart = daysAgo(periodDays - 1);
  const currentEnd = now;

  const previousStart = daysAgo(periodDays * 2 - 1);
  const previousEnd = daysAgo(periodDays);
  previousEnd.setHours(23, 59, 59, 999);

  return {
    current: {
      start: currentStart,
      end: currentEnd,
    },
    previous: {
      start: previousStart,
      end: previousEnd,
    },
  };
}

/**
 * Generate an array of dates for a period (for chart x-axis).
 */
export function generateDateArray(startDate: Date, days: number): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);
    date.setHours(0, 0, 0, 0);
    dates.push(date);
  }
  return dates;
}

/**
 * Format a date for display in charts.
 * e.g., "Jan 15" or "15 Jan"
 */
export function formatChartDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a date as ISO date string (YYYY-MM-DD).
 */
export function formatISODate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Check if a date falls within a range.
 */
export function isDateInRange(date: Date, range: DateRange): boolean {
  return date >= range.start && date <= range.end;
}

/**
 * Get cache key suffix based on the current date.
 * Changes daily to invalidate cache.
 */
export function getDailyCacheKey(): string {
  return formatISODate(new Date());
}