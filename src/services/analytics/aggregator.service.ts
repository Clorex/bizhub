import prisma from '@/lib/db';
import { VendorDailyStatsRepository } from '@/repositories/vendor-daily-stats.repository';

/**
 * Aggregator Service
 * Pre-computes daily stats from raw event tables.
 * Run this via cron job to keep vendor_daily_stats updated.
 */
export class AggregatorService {
  /**
   * Aggregate stats for ALL vendors for a specific date.
   */
  static async aggregateAllVendors(date: Date): Promise<{
    vendorsProcessed: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let vendorsProcessed = 0;

    try {
      // Get all vendor IDs
      const vendors = await prisma.vendor.findMany({
        select: { id: true },
      });

      for (const vendor of vendors) {
        try {
          await this.aggregateVendorDay(vendor.id, date);
          vendorsProcessed++;
        } catch (error) {
          const message = `Failed to aggregate vendor ${vendor.id}: ${error}`;
          console.error(message);
          errors.push(message);
        }
      }
    } catch (error) {
      console.error('AggregatorService.aggregateAllVendors error:', error);
      errors.push(`Global error: ${error}`);
    }

    return { vendorsProcessed, errors };
  }

  /**
   * Aggregate stats for a single vendor for a specific date.
   */
  static async aggregateVendorDay(
    vendorId: string,
    date: Date
  ): Promise<void> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const dateRange = { start: startOfDay, end: endOfDay };

    // Count orders
    const orders = await prisma.order.findMany({
      where: {
        vendor_id: vendorId,
        status: 'completed',
        created_at: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      select: { total: true },
    });

    const salesCount = orders.length;
    const revenue = orders.reduce((sum, o) => sum + o.total, 0);

    // Count views
    const views = await prisma.productView.count({
      where: {
        vendor_id: vendorId,
        created_at: { gte: startOfDay, lte: endOfDay },
      },
    });

    // Count clicks
    const clicks = await prisma.productClick.count({
      where: {
        vendor_id: vendorId,
        created_at: { gte: startOfDay, lte: endOfDay },
      },
    });

    // Count saves
    const saves = await prisma.productSave.count({
      where: {
        vendor_id: vendorId,
        created_at: { gte: startOfDay, lte: endOfDay },
      },
    });

    // Count cart adds
    const cartAdds = await prisma.cartAdd.count({
      where: {
        vendor_id: vendorId,
        created_at: { gte: startOfDay, lte: endOfDay },
      },
    });

    // Upsert daily stat
    await VendorDailyStatsRepository.upsertDailyStat(vendorId, startOfDay, {
      sales_count: salesCount,
      revenue: Math.round(revenue * 100) / 100,
      views,
      clicks,
      purchases: salesCount,
      saves,
      cart_adds: cartAdds,
      shares: 0, // Shares tracked separately if implemented
    });
  }

  /**
   * Aggregate yesterday's stats for all vendors.
   * Typical daily cron usage.
   */
  static async aggregateYesterday(): Promise<{
    vendorsProcessed: number;
    errors: string[];
  }> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    console.log(`📊 Aggregating stats for ${yesterday.toISOString().split('T')[0]}`);
    return this.aggregateAllVendors(yesterday);
  }

  /**
   * Backfill stats for a range of days.
   * Useful for initial setup or data recovery.
   */
  static async backfill(
    vendorId: string,
    days: number
  ): Promise<{ daysProcessed: number; errors: string[] }> {
    const errors: string[] = [];
    let daysProcessed = 0;

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      try {
        await this.aggregateVendorDay(vendorId, date);
        daysProcessed++;
      } catch (error) {
        const message = `Failed day ${i}: ${error}`;
        console.error(message);
        errors.push(message);
      }
    }

    return { daysProcessed, errors };
  }
}