// FILE: src/services/restock/product-metrics-aggregator.service.ts
// Aggregates per-product daily metrics from Firestore into Postgres.
// Runs as part of the daily cron job.

import { adminDb } from "@/lib/firebase/admin";
import { ProductDailyMetricsRepository } from "@/repositories/product-daily-metrics.repository";

function dayKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export class ProductMetricsAggregatorService {
  /**
   * Aggregate product-level metrics for a business for a given date.
   * Reads from Firestore productMetricsDaily + orders, writes to Postgres.
   */
  static async aggregateBusinessProducts(
    businessId: string,
    date: Date
  ): Promise<{ productsProcessed: number; errors: string[] }> {
    const errors: string[] = [];
    let productsProcessed = 0;

    try {
      const dk = dayKey(date);
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Get all products for this business
      const prodSnap = await adminDb
        .collection("products")
        .where("businessId", "==", businessId)
        .limit(500)
        .get();

      const products = prodSnap.docs
        .filter((d) => {
          const data = d.data() as any;
          return !data.isDeleted && !data.deletedAt;
        })
        .map((d) => ({ id: d.id, ...(d.data() as any) }));

      if (products.length === 0) return { productsProcessed: 0, errors };

      // Get all orders for this business on this date
      const ordersSnap = await adminDb
        .collection("orders")
        .where("businessId", "==", businessId)
        .where("createdAt", ">=", startOfDay)
        .where("createdAt", "<=", endOfDay)
        .limit(1000)
        .get();

      // Build per-product order counts
      const productOrderMap = new Map<
        string,
        { orders: number; units: number; revenue: number }
      >();

      for (const orderDoc of ordersSnap.docs) {
        const order = orderDoc.data() as any;
        const items = Array.isArray(order.items) ? order.items : [];
        for (const item of items) {
          const pid = String(item.productId || "");
          if (!pid) continue;
          const existing = productOrderMap.get(pid) || {
            orders: 0,
            units: 0,
            revenue: 0,
          };
          existing.orders++;
          existing.units += Number(item.quantity || 1);
          existing.revenue += Number(item.total || item.price || 0) * Number(item.quantity || 1);
          productOrderMap.set(pid, existing);
        }
      }

      // Get Firestore product-level metrics for this day
      for (const product of products) {
        try {
          const docId = `${product.id}_${dk}`;
          const metricSnap = await adminDb
            .collection("productMetricsDaily")
            .doc(docId)
            .get();
          const metricData = metricSnap.exists
            ? (metricSnap.data() as any)
            : {};

          const orderData = productOrderMap.get(product.id) || {
            orders: 0,
            units: 0,
            revenue: 0,
          };

          // Get cart adds from Firestore
          const cartSnap = await adminDb
            .collection("cartEvents")
            .where("productId", "==", product.id)
            .where("businessId", "==", businessId)
            .where("createdAt", ">=", startOfDay)
            .where("createdAt", "<=", endOfDay)
            .limit(500)
            .get();

          // Get saves from Firestore
          const saveSnap = await adminDb
            .collection("productSaves")
            .where("productId", "==", product.id)
            .where("businessId", "==", businessId)
            .where("createdAt", ">=", startOfDay)
            .where("createdAt", "<=", endOfDay)
            .limit(500)
            .get();

          await ProductDailyMetricsRepository.upsert(
            product.id,
            businessId,
            startOfDay,
            {
              views: Number(metricData.visits || metricData.views || 0),
              detail_opens: Number(metricData.productViews || metricData.visits || 0),
              add_to_carts: cartSnap.size,
              saves: saveSnap.size,
              orders: orderData.orders,
              units_sold: orderData.units,
              revenue: Math.round(orderData.revenue * 100) / 100,
            }
          );

          productsProcessed++;
        } catch (err: any) {
          errors.push(`Product ${product.id}: ${err?.message || err}`);
        }
      }
    } catch (err: any) {
      errors.push(`Business ${businessId}: ${err?.message || err}`);
    }

    return { productsProcessed, errors };
  }

  /**
   * Aggregate for ALL Apex businesses.
   */
  static async aggregateAllApex(date: Date): Promise<{
    businessesProcessed: number;
    productsProcessed: number;
    errors: string[];
  }> {
    let businessesProcessed = 0;
    let productsProcessed = 0;
    const errors: string[] = [];

    try {
      const now = Date.now();
      const bizSnap = await adminDb
        .collection("businesses")
        .where("subscription.planKey", "==", "APEX")
        .limit(500)
        .get();

      const apexBusinesses = bizSnap.docs
        .map((d) => ({ id: d.id, ...(d.data() as any) }))
        .filter((b) => {
          const exp = Number(b?.subscription?.expiresAtMs || 0);
          return exp > now;
        });

      for (const biz of apexBusinesses) {
        try {
          const result = await this.aggregateBusinessProducts(biz.id, date);
          businessesProcessed++;
          productsProcessed += result.productsProcessed;
          if (result.errors.length > 0) {
            errors.push(...result.errors);
          }
        } catch (err: any) {
          errors.push(`Business ${biz.id}: ${err?.message || err}`);
        }
      }
    } catch (err: any) {
      errors.push(`Global: ${err?.message || err}`);
    }

    return { businessesProcessed, productsProcessed, errors };
  }
}
