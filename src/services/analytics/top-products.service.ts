import { TopProductsData, TopProduct } from '@/types/analytics';
import { OrderRepository } from '@/repositories/order.repository';
import { getAnalyticsPeriods } from '@/utils/analytics/date-ranges';
import { calculateProductGrowth } from '@/utils/analytics/calculate-growth';
import { ANALYTICS_CONFIG } from '@/config/analytics.config';
import cache, { buildCacheKey } from '@/lib/redis';

/**
 * Top Products Service
 * Ranked list of top performing products by units sold.
 */
export class TopProductsService {
  /**
   * Get top products for a vendor.
   */
  static async getTopProducts(vendorId: string): Promise<TopProductsData> {
    const cacheKey = buildCacheKey(vendorId, 'top-products');

    const { data } = await cache.getOrCompute<TopProductsData>(
      cacheKey,
      () => this.computeTopProducts(vendorId),
      ANALYTICS_CONFIG.CACHE_TTL_TOP_PRODUCTS
    );

    return data;
  }

  /**
   * Compute top products from database.
   */
  private static async computeTopProducts(
    vendorId: string
  ): Promise<TopProductsData> {
    const periods = getAnalyticsPeriods();

    // Get current period top products by units
    const currentProducts = await OrderRepository.getTopProductsByUnits(
      vendorId,
      periods.current,
      ANALYTICS_CONFIG.TOP_PRODUCTS_LIMIT
    );

    // Get previous period products for growth comparison
    const previousProducts = await OrderRepository.getTopProductsByUnits(
      vendorId,
      periods.previous,
      50 // Get more to ensure we find matches
    );

    // Build previous period lookup map
    const previousMap = new Map<string, number>();
    for (const product of previousProducts) {
      previousMap.set(product.product_id, product.units_sold);
    }

    // Build top products with growth data
    const products: TopProduct[] = currentProducts.map((product) => {
      const previousUnits = previousMap.get(product.product_id) || 0;
      const { percentage, trend } = calculateProductGrowth(
        product.units_sold,
        previousUnits
      );

      return {
        product_id: product.product_id,
        product_name: product.product_name,
        product_image: product.product_image,
        units_sold: product.units_sold,
        revenue: product.revenue,
        growth_percentage: percentage,
        trend,
      };
    });

    return { products };
  }
}