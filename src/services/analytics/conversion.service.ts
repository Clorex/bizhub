import { ConversionData } from '@/types/analytics';
import { VendorDailyStatsRepository } from '@/repositories/vendor-daily-stats.repository';
import { getAnalyticsPeriods } from '@/utils/analytics/date-ranges';
import { safeDivide } from '@/utils/analytics/safe-divide';
import { generateConversionInsight } from './insight-generator';
import { ANALYTICS_CONFIG } from '@/config/analytics.config';
import cache, { buildCacheKey } from '@/lib/redis';

/**
 * Conversion Service
 * Calculates conversion rate from views → clicks → purchases.
 */
export class ConversionService {
  /**
   * Get conversion data for a vendor.
   */
  static async getConversionData(vendorId: string): Promise<ConversionData> {
    const cacheKey = buildCacheKey(vendorId, 'conversion');

    const { data } = await cache.getOrCompute<ConversionData>(
      cacheKey,
      () => this.computeConversion(vendorId),
      ANALYTICS_CONFIG.CACHE_TTL_CONVERSION
    );

    return data;
  }

  /**
   * Compute conversion metrics from database.
   */
  private static async computeConversion(
    vendorId: string
  ): Promise<ConversionData> {
    const periods = getAnalyticsPeriods();

    // Get engagement totals from pre-aggregated stats
    const totals = await VendorDailyStatsRepository.getEngagementTotals(
      vendorId,
      periods.current
    );

    // Primary metric: purchases / product_clicks
    const conversionRate = safeDivide(totals.purchases, totals.clicks);
    const roundedRate = Math.round(conversionRate * 100) / 100;

    // Generate insight
    const insight = generateConversionInsight(roundedRate);

    return {
      profile_views: totals.views,
      product_clicks: totals.clicks,
      purchases: totals.purchases,
      conversion_rate: roundedRate,
      insight,
    };
  }
}