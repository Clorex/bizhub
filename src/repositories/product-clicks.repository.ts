import prisma from '@/lib/db';
import { DateRange } from '@/types/analytics';

/**
 * Product Clicks Repository
 * Data access for product click tracking.
 */
export class ProductClicksRepository {
  /**
   * Get total clicks for a vendor in a date range.
   */
  static async getTotalClicks(
    vendorId: string,
    dateRange: DateRange
  ): Promise<number> {
    try {
      const count = await prisma.productClick.count({
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
      console.error('ProductClicksRepository.getTotalClicks error:', error);
      return 0;
    }
  }

  /**
   * Get daily click counts for a vendor in a date range.
   */
  static async getDailyClicks(
    vendorId: string,
    dateRange: DateRange
  ): Promise<{ date: string; count: number }[]> {
    try {
      const clicks = await prisma.productClick.findMany({
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

      for (const click of clicks) {
        const dateKey = click.created_at.toISOString().split('T')[0];
        dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + 1);
      }

      return Array.from(dailyMap.entries()).map(([date, count]) => ({
        date,
        count,
      }));
    } catch (error) {
      console.error('ProductClicksRepository.getDailyClicks error:', error);
      return [];
    }
  }

  /**
   * Get click count for a specific product in a date range.
   */
  static async getProductClicks(
    productId: string,
    dateRange: DateRange
  ): Promise<number> {
    try {
      const count = await prisma.productClick.count({
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
      console.error('ProductClicksRepository.getProductClicks error:', error);
      return 0;
    }
  }
}