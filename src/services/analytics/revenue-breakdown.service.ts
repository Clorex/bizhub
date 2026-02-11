import { RevenueBreakdownData, ProductRevenue } from '@/types/analytics';
import { OrderRepository } from '@/repositories/order.repository';
import { getAnalyticsPeriods } from '@/utils/analytics/date-ranges';
import { truncateProductName } from '@/utils/analytics/truncate-text';
import { safePercentage } from '@/utils/analytics/safe-divide';
import { generateRevenueBreakdownInsight } from './insight-generator';
import { ANALYTICS_CONFIG } from '@/config/analytics.config';
import cache, { buildCacheKey } from '@/lib/redis';

/**
 * Revenue Breakdown Service
 * Calculates top products by revenue with percentages.
 */
export class RevenueBreakdownService {
  /**
   * Get revenue breakdown for a vendor.
   */
  static async getRevenueBreakdown(
    vendorId: string
  ): Promise<RevenueBreakdownData> {
    const cacheKey = buildCacheKey(vendorId, 'revenue-breakdown');

    const { data } = await cache.getOrCompute<RevenueBreakdownData>(
      cacheKey,
      () => this.computeRevenueBreakdown(vendorId),
      ANALYTICS_CONFIG.CACHE_TTL_REVENUE
    );

    return data;
  }

  /**
   * Compute revenue breakdown from database.
   */
  private static async computeRevenueBreakdown(
    vendorId: string
  ): Promise<RevenueBreakdownData> {
    const periods = getAnalyticsPeriods();

    // Get top products by revenue
    const topProducts = await OrderRepository.getTopProductsByRevenue(
      vendorId,
      periods.current,
      ANALYTICS_CONFIG.TOP_PRODUCTS_LIMIT
    );

    // Get total revenue for percentage calculation
    const totalRevenue = await OrderRepository.getTotalRevenue(
      vendorId,
      periods.current
    );

    // Build product revenue array with percentages
    const products: ProductRevenue[] = topProducts.map((product) => ({
      product_id: product.product_id,
      product_name: truncateProductName(product.product_name),
      revenue: product.revenue,
      percentage: Math.round(safePercentage(product.revenue, totalRevenue) * 10) / 10,
    }));

    // Generate insight
    const topProduct = products[0];
    const insight = topProduct
      ? generateRevenueBreakdownInsight(
          topProduct.product_name,
          topProduct.percentage
        )
      : 'No revenue data available yet.';

    return {
      top_products: products,
      total_revenue: Math.round(totalRevenue * 100) / 100,
      insight,
    };
  }
}