import prisma from '@/lib/db';
import { VendorDailyStats, DateRange } from '@/types/analytics';

/**
 * Vendor Daily Stats Repository
 * Primary data source for analytics (pre-aggregated).
 */
export class VendorDailyStatsRepository {
  /**
   * Get daily stats for a vendor within a date range.
   */
  static async getByDateRange(
    vendorId: string,
    dateRange: DateRange
  ): Promise<VendorDailyStats[]> {
    try {
      const stats = await prisma.vendorDailyStats.findMany({
        where: {
          vendor_id: vendorId,
          date: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        },
        orderBy: { date: 'asc' },
      });

      return stats.map((s) => ({
        id: s.id,
        vendor_id: s.vendor_id,
        date: s.date,
        sales_count: s.sales_count,
        revenue: s.revenue,
        views: s.views,
        clicks: s.clicks,
        purchases: s.purchases,
        saves: s.saves,
        cart_adds: s.cart_adds,
        shares: s.shares,
      }));
    } catch (error) {
      console.error('VendorDailyStatsRepository.getByDateRange error:', error);
      return [];
    }
  }

  /**
   * Get total revenue for a vendor within a date range.
   */
  static async getTotalRevenue(
    vendorId: string,
    dateRange: DateRange
  ): Promise<number> {
    try {
      const result = await prisma.vendorDailyStats.aggregate({
        where: {
          vendor_id: vendorId,
          date: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        },
        _sum: {
          revenue: true,
        },
      });

      return result._sum.revenue ?? 0;
    } catch (error) {
      console.error('VendorDailyStatsRepository.getTotalRevenue error:', error);
      return 0;
    }
  }

  /**
   * Get total sales count for a vendor within a date range.
   */
  static async getTotalSalesCount(
    vendorId: string,
    dateRange: DateRange
  ): Promise<number> {
    try {
      const result = await prisma.vendorDailyStats.aggregate({
        where: {
          vendor_id: vendorId,
          date: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        },
        _sum: {
          sales_count: true,
        },
      });

      return result._sum.sales_count ?? 0;
    } catch (error) {
      console.error('VendorDailyStatsRepository.getTotalSalesCount error:', error);
      return 0;
    }
  }

  /**
   * Get aggregated engagement metrics for a date range.
   */
  static async getEngagementTotals(
    vendorId: string,
    dateRange: DateRange
  ): Promise<{
    views: number;
    clicks: number;
    purchases: number;
    saves: number;
    cart_adds: number;
    shares: number;
  }> {
    try {
      const result = await prisma.vendorDailyStats.aggregate({
        where: {
          vendor_id: vendorId,
          date: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        },
        _sum: {
          views: true,
          clicks: true,
          purchases: true,
          saves: true,
          cart_adds: true,
          shares: true,
        },
      });

      return {
        views: result._sum.views ?? 0,
        clicks: result._sum.clicks ?? 0,
        purchases: result._sum.purchases ?? 0,
        saves: result._sum.saves ?? 0,
        cart_adds: result._sum.cart_adds ?? 0,
        shares: result._sum.shares ?? 0,
      };
    } catch (error) {
      console.error('VendorDailyStatsRepository.getEngagementTotals error:', error);
      return { views: 0, clicks: 0, purchases: 0, saves: 0, cart_adds: 0, shares: 0 };
    }
  }

  /**
   * Upsert a daily stat record (used by aggregation cron).
   */
  static async upsertDailyStat(
    vendorId: string,
    date: Date,
    data: {
      sales_count: number;
      revenue: number;
      views: number;
      clicks: number;
      purchases: number;
      saves: number;
      cart_adds: number;
      shares: number;
    }
  ): Promise<void> {
    try {
      const normalizedDate = new Date(date);
      normalizedDate.setHours(0, 0, 0, 0);

      await prisma.vendorDailyStats.upsert({
        where: {
          vendor_id_date: {
            vendor_id: vendorId,
            date: normalizedDate,
          },
        },
        update: data,
        create: {
          vendor_id: vendorId,
          date: normalizedDate,
          ...data,
        },
      });
    } catch (error) {
      console.error('VendorDailyStatsRepository.upsertDailyStat error:', error);
    }
  }

  /**
   * Get the peak day (highest revenue) in a date range.
   */
  static async getPeakDay(
    vendorId: string,
    dateRange: DateRange
  ): Promise<VendorDailyStats | null> {
    try {
      const peak = await prisma.vendorDailyStats.findFirst({
        where: {
          vendor_id: vendorId,
          date: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        },
        orderBy: { revenue: 'desc' },
      });

      if (!peak) return null;

      return {
        id: peak.id,
        vendor_id: peak.vendor_id,
        date: peak.date,
        sales_count: peak.sales_count,
        revenue: peak.revenue,
        views: peak.views,
        clicks: peak.clicks,
        purchases: peak.purchases,
        saves: peak.saves,
        cart_adds: peak.cart_adds,
        shares: peak.shares,
      };
    } catch (error) {
      console.error('VendorDailyStatsRepository.getPeakDay error:', error);
      return null;
    }
  }
}