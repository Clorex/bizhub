import prisma from '@/lib/db';
import { DateRange } from '@/types/analytics';

/**
 * Order Repository
 * Data access for orders and order items.
 */
export class OrderRepository {
  /**
   * Get total revenue for a vendor in a date range.
   */
  static async getTotalRevenue(
    vendorId: string,
    dateRange: DateRange
  ): Promise<number> {
    try {
      const result = await prisma.order.aggregate({
        where: {
          vendor_id: vendorId,
          status: 'completed',
          created_at: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        },
        _sum: {
          total: true,
        },
      });

      return result._sum.total ?? 0;
    } catch (error) {
      console.error('OrderRepository.getTotalRevenue error:', error);
      return 0;
    }
  }

  /**
   * Get order count for a vendor in a date range.
   */
  static async getOrderCount(
    vendorId: string,
    dateRange: DateRange
  ): Promise<number> {
    try {
      const count = await prisma.order.count({
        where: {
          vendor_id: vendorId,
          status: 'completed',
          created_at: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        },
      });

      return count;
    } catch (error) {
      console.error('OrderRepository.getOrderCount error:', error);
      return 0;
    }
  }

  /**
   * Get daily revenue breakdown for a vendor in a date range.
   * Returns raw orders grouped by date for chart data.
   */
  static async getDailyRevenue(
    vendorId: string,
    dateRange: DateRange
  ): Promise<{ date: string; revenue: number; orders: number }[]> {
    try {
      const orders = await prisma.order.findMany({
        where: {
          vendor_id: vendorId,
          status: 'completed',
          created_at: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        },
        select: {
          total: true,
          created_at: true,
        },
        orderBy: { created_at: 'asc' },
      });

      // Group by date
      const dailyMap = new Map<string, { revenue: number; orders: number }>();

      for (const order of orders) {
        const dateKey = order.created_at.toISOString().split('T')[0];
        const existing = dailyMap.get(dateKey) || { revenue: 0, orders: 0 };
        existing.revenue += order.total;
        existing.orders += 1;
        dailyMap.set(dateKey, existing);
      }

      return Array.from(dailyMap.entries()).map(([date, data]) => ({
        date,
        revenue: Math.round(data.revenue * 100) / 100,
        orders: data.orders,
      }));
    } catch (error) {
      console.error('OrderRepository.getDailyRevenue error:', error);
      return [];
    }
  }

  /**
   * Get top products by revenue for a vendor in a date range.
   */
  static async getTopProductsByRevenue(
    vendorId: string,
    dateRange: DateRange,
    limit: number = 5
  ): Promise<
    {
      product_id: string;
      product_name: string;
      revenue: number;
      units_sold: number;
    }[]
  > {
    try {
      const items = await prisma.orderItem.findMany({
        where: {
          order: {
            vendor_id: vendorId,
            status: 'completed',
            created_at: {
              gte: dateRange.start,
              lte: dateRange.end,
            },
          },
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              image_url: true,
            },
          },
        },
      });

      // Aggregate by product
      const productMap = new Map<
        string,
        { product_name: string; revenue: number; units_sold: number }
      >();

      for (const item of items) {
        const existing = productMap.get(item.product_id) || {
          product_name: item.product.name,
          revenue: 0,
          units_sold: 0,
        };
        existing.revenue += item.price * item.quantity;
        existing.units_sold += item.quantity;
        productMap.set(item.product_id, existing);
      }

      // Sort by revenue descending, take top N
      return Array.from(productMap.entries())
        .map(([product_id, data]) => ({
          product_id,
          product_name: data.product_name,
          revenue: Math.round(data.revenue * 100) / 100,
          units_sold: data.units_sold,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, limit);
    } catch (error) {
      console.error('OrderRepository.getTopProductsByRevenue error:', error);
      return [];
    }
  }

  /**
   * Get top products by units sold with full details.
   */
  static async getTopProductsByUnits(
    vendorId: string,
    dateRange: DateRange,
    limit: number = 5
  ): Promise<
    {
      product_id: string;
      product_name: string;
      product_image: string;
      revenue: number;
      units_sold: number;
    }[]
  > {
    try {
      const items = await prisma.orderItem.findMany({
        where: {
          order: {
            vendor_id: vendorId,
            status: 'completed',
            created_at: {
              gte: dateRange.start,
              lte: dateRange.end,
            },
          },
        },
        include: {
          product: {
            select: {
              id: true,
              name: true,
              image_url: true,
            },
          },
        },
      });

      const productMap = new Map<
        string,
        {
          product_name: string;
          product_image: string;
          revenue: number;
          units_sold: number;
        }
      >();

      for (const item of items) {
        const existing = productMap.get(item.product_id) || {
          product_name: item.product.name,
          product_image: item.product.image_url,
          revenue: 0,
          units_sold: 0,
        };
        existing.revenue += item.price * item.quantity;
        existing.units_sold += item.quantity;
        productMap.set(item.product_id, existing);
      }

      return Array.from(productMap.entries())
        .map(([product_id, data]) => ({
          product_id,
          product_name: data.product_name,
          product_image: data.product_image,
          revenue: Math.round(data.revenue * 100) / 100,
          units_sold: data.units_sold,
        }))
        .sort((a, b) => b.units_sold - a.units_sold)
        .slice(0, limit);
    } catch (error) {
      console.error('OrderRepository.getTopProductsByUnits error:', error);
      return [];
    }
  }
}