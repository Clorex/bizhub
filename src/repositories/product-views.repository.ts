import prisma from '@/lib/db';
import { DateRange } from '@/types/analytics';

/**
 * Product Views Repository
 * Data access for product/profile view tracking.
 */
export class ProductViewsRepository {
  /**
   * Get total views for a vendor in a date range.
   */
  static async getTotalViews(
    vendorId: string,
    dateRange: DateRange
  ): Promise<number> {
    try {
      const count = await prisma.productView.count({
        where: {
          vendor_id: vendorId,
          created_at: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        },
      });

      return count;
    } catch (error) {
      console.error('ProductViewsRepository.getTotalViews error:', error);
      return 0;
    }
  }

  /**
   * Get daily view counts for a vendor in a date range.
   */
  static async getDailyViews(
    vendorId: string,
    dateRange: DateRange
  ): Promise<{ date: string; count: number }[]> {
    try {
      const views = await prisma.productView.findMany({
        where: {
          vendor_id: vendorId,
          created_at: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        },
        select: {
          created_at: true,
        },
        orderBy: { created_at: 'asc' },
      });

      const dailyMap = new Map<string, number>();

      for (const view of views) {
        const dateKey = view.created_at.toISOString().split('T')[0];
        dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + 1);
      }

      return Array.from(dailyMap.entries()).map(([date, count]) => ({
        date,
        count,
      }));
    } catch (error) {
      console.error('ProductViewsRepository.getDailyViews error:', error);
      return [];
    }
  }

  /**
   * Get view count for a specific product in a date range.
   */
  static async getProductViews(
    productId: string,
    dateRange: DateRange
  ): Promise<number> {
    try {
      const count = await prisma.productView.count({
        where: {
          product_id: productId,
          created_at: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        },
      });

      return count;
    } catch (error) {
      console.error('ProductViewsRepository.getProductViews error:', error);
      return 0;
    }
  }
}