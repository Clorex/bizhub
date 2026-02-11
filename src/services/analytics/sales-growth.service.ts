import { SalesGrowthData, DailySalesPoint } from '@/types/analytics';
import { VendorDailyStatsRepository } from '@/repositories/vendor-daily-stats.repository';
import { calculateGrowth } from '@/utils/analytics/calculate-growth';
import { getAnalyticsPeriods, generateDateArray, formatISODate } from '@/utils/analytics/date-ranges';
import { generateSalesGrowthInsight, generatePeakDayInsight } from './insight-generator';
import { ANALYTICS_CONFIG } from '@/config/analytics.config';
import cache, { buildCacheKey } from '@/lib/redis';

/**
 * Sales Growth Service
 * Calculates sales growth between current and previous 30-day periods.
 */
export class SalesGrowthService {
  /**
   * Get sales growth data for a vendor.
   */
  static async getSalesGrowth(vendorId: string): Promise<SalesGrowthData> {
    const cacheKey = buildCacheKey(vendorId, 'sales-growth');

    const { data, cached } = await cache.getOrCompute<SalesGrowthData>(
      cacheKey,
      () => this.computeSalesGrowth(vendorId),
      ANALYTICS_CONFIG.CACHE_TTL_SALES_GROWTH
    );

    return data;
  }

  /**
   * Compute sales growth from database.
   */
  private static async computeSalesGrowth(
    vendorId: string
  ): Promise<SalesGrowthData> {
    const periods = getAnalyticsPeriods();

    // Get daily stats for both periods
    const currentStats = await VendorDailyStatsRepository.getByDateRange(
      vendorId,
      periods.current
    );

    const previousStats = await VendorDailyStatsRepository.getByDateRange(
      vendorId,
      periods.previous
    );

    // Calculate totals
    const currentTotal = currentStats.reduce((sum, s) => sum + s.revenue, 0);
    const previousTotal = previousStats.reduce((sum, s) => sum + s.revenue, 0);

    // Calculate growth
    const growthPercentage = calculateGrowth(currentTotal, previousTotal);

    // Build daily sales array (fill in missing days with 0)
    const dailySales = this.buildDailySalesArray(
      currentStats,
      periods.current.start,
      ANALYTICS_CONFIG.DEFAULT_PERIOD_DAYS
    );

    // Find peak day
    const peakDay = dailySales.reduce<DailySalesPoint | null>(
      (peak, day) => {
        if (!peak || day.revenue > peak.revenue) return day;
        return peak;
      },
      null
    );

    // Generate insight
    const insight = generateSalesGrowthInsight(growthPercentage);

    return {
      current_period_total: Math.round(currentTotal * 100) / 100,
      previous_period_total: Math.round(previousTotal * 100) / 100,
      growth_percentage: growthPercentage,
      daily_sales: dailySales,
      peak_day: peakDay,
      insight,
    };
  }

  /**
   * Build a complete daily sales array, filling gaps with zero values.
   */
  private static buildDailySalesArray(
    stats: { date: Date; revenue: number; sales_count: number }[],
    startDate: Date,
    days: number
  ): DailySalesPoint[] {
    const dates = generateDateArray(startDate, days);
    const statsMap = new Map<string, { revenue: number; sales_count: number }>();

    for (const stat of stats) {
      const key = formatISODate(stat.date);
      statsMap.set(key, {
        revenue: stat.revenue,
        sales_count: stat.sales_count,
      });
    }

    return dates.map((date) => {
      const key = formatISODate(date);
      const stat = statsMap.get(key);

      return {
        date: key,
        revenue: stat ? Math.round(stat.revenue * 100) / 100 : 0,
        orders: stat ? stat.sales_count : 0,
      };
    });
  }
}