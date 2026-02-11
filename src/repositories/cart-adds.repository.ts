import prisma from '@/lib/db';
import { DateRange } from '@/types/analytics';

/**
 * Cart Adds Repository
 * Data access for cart add tracking.
 */
export class CartAddsRepository {
  /**
   * Get total cart adds for a vendor in a date range.
   */
  static async getTotalCartAdds(
    vendorId: string,
    dateRange: DateRange
  ): Promise<number> {
    try {
      const count = await prisma.cartAdd.count({
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
      console.error('CartAddsRepository.getTotalCartAdds error:', error);
      return 0;
    }
  }

  /**
   * Get daily cart add counts for a vendor in a date range.
   */
  static async getDailyCartAdds(
    vendorId: string,
    dateRange: DateRange
  ): Promise<{ date: string; count: number }[]> {
    try {
      const cartAdds = await prisma.cartAdd.findMany({
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

      for (const cartAdd of cartAdds) {
        const dateKey = cartAdd.created_at.toISOString().split('T')[0];
        dailyMap.set(dateKey, (dailyMap.get(dateKey) || 0) + 1);
      }

      return Array.from(dailyMap.entries()).map(([date, count]) => ({
        date,
        count,
      }));
    } catch (error) {
      console.error('CartAddsRepository.getDailyCartAdds error:', error);
      return [];
    }
  }

  /**
   * Get cart add count for a specific product in a date range.
   */
  static async getProductCartAdds(
    productId: string,
    dateRange: DateRange
  ): Promise<number> {
    try {
      const count = await prisma.cartAdd.count({
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
      console.error('CartAddsRepository.getProductCartAdds error:', error);
      return 0;
    }
  }
}