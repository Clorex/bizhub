import { EngagementData } from '@/types/analytics';
import { VendorDailyStatsRepository } from '@/repositories/vendor-daily-stats.repository';
import { getAnalyticsPeriods } from '@/utils/analytics/date-ranges';
import { generateEngagementInsight } from './insight-generator';
import { ANALYTICS_CONFIG } from '@/config/analytics.config';
import cache, { buildCacheKey } from '@/lib/redis';

/**
 * Customer Engagement Service
 * Measures pre-purchase interest: saves, cart adds, shares.
 */
export class CustomerEngagementService {
  /**
   * Get engagement data for a vendor.
   */
  static async getEngagementData(vendorId: string): Promise<EngagementData> {
    const cacheKey = buildCacheKey(vendorId, 'engagement');

    const { data } = await cache.getOrCompute<EngagementData>(
      cacheKey,
      () => this.computeEngagement(vendorId),
      ANALYTICS_CONFIG.CACHE_TTL_ENGAGEMENT
    );

    return data;
  }

  /**
   * Compute engagement metrics from database.
   */
  private static async computeEngagement(
    vendorId: string
  ): Promise<EngagementData> {
    const periods = getAnalyticsPeriods();

    // Get engagement totals from pre-aggregated stats
    const totals = await VendorDailyStatsRepository.getEngagementTotals(
      vendorId,
      periods.current
    );

    // Generate insight
    const insight = generateEngagementInsight(
      totals.saves,
      totals.purchases,
      totals.cart_adds
    );

    return {
      saves: totals.saves,
      cart_adds: totals.cart_adds,
      shares: totals.shares,
      insight,
    };
  }
}