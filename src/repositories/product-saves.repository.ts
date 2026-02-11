import prisma from '@/lib/db';
import { DateRange } from '@/types/analytics';

/**
 * Product Saves Repository
 * Data access for product save/wishlist tracking.
 */
export class ProductSavesRepository {
  /**
   * Get total saves for a vendor in a date range.
   */
  static async getTotalSaves(
    vendorId: string,
    dateRange: DateRange
  ): Promise<number> {
    try {
      const count = await prisma.productSave.count({
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
      console.error('ProductSavesRepository.getTotalSaves error:', error);
      return 0;
    }
  }

  /**
   * Get daily save counts for a vendor in a date range.
   */
  static async getDailySaves(
    vendorId: string,
    dateRange: DateRange
  ): Promise<{ date: string; count: number }[]> {
    try {
      const saves = await prisma.productSave.findMany({
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

      for (const save of saves) {
        const dateKey = save.created_at.toISOString().split('T')[0];
        dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + 1);
      }

      return Array.from(dailyMap.entries()).map(([date, count]) => ({
        date,
        count,
      }));
    } catch (error) {
      console.error('ProductSavesRepository.getDailySaves error:', error);
      return [];
    }
  }

  /**
   * Get save count for a specific product in a date range.
   */
  static async getProductSaves(
    productId: string,
    dateRange: DateRange
  ): Promise<number> {
    try {
      const count = await prisma.productSave.count({
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
      console.error('ProductSavesRepository.getProductSaves error:', error);
      return 0;
    }
  }
}