// FILE: src/repositories/product-daily-metrics.repository.ts
// Firestore-based product daily metrics storage
// Collection: productDailyMetricsAgg
// Doc ID: {productId}_{YYYY-MM-DD}

import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

const COLLECTION = "productDailyMetricsAgg";

function docId(productId: string, date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${productId}_${y}-${m}-${d}`;
}

function dateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export interface ProductDailyMetricRow {
  product_id: string;
  business_id: string;
  date: Date;
  views: number;
  detail_opens: number;
  add_to_carts: number;
  saves: number;
  orders: number;
  units_sold: number;
  revenue: number;
}

export class ProductDailyMetricsRepository {
  /**
   * Upsert a daily metric row for a product.
   */
  static async upsert(
    productId: string,
    businessId: string,
    date: Date,
    data: {
      views?: number;
      detail_opens?: number;
      add_to_carts?: number;
      saves?: number;
      orders?: number;
      units_sold?: number;
      revenue?: number;
    }
  ): Promise<void> {
    try {
      const normalizedDate = new Date(date);
      normalizedDate.setHours(0, 0, 0, 0);
      const id = docId(productId, normalizedDate);
      const dk = dateKey(normalizedDate);

      await adminDb.collection(COLLECTION).doc(id).set(
        {
          product_id: productId,
          business_id: businessId,
          dayKey: dk,
          dateMs: normalizedDate.getTime(),
          views: data.views ?? 0,
          detail_opens: data.detail_opens ?? 0,
          add_to_carts: data.add_to_carts ?? 0,
          saves: data.saves ?? 0,
          orders: data.orders ?? 0,
          units_sold: data.units_sold ?? 0,
          revenue: data.revenue ?? 0,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error("ProductDailyMetricsRepository.upsert error:", error);
    }
  }

  /**
   * Get metrics for a product over a date range.
   */
  static async getByProductDateRange(
    productId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ProductDailyMetricRow[]> {
    try {
      const startMs = new Date(startDate).setHours(0, 0, 0, 0);
      const endMs = new Date(endDate).setHours(23, 59, 59, 999);

      const snap = await adminDb
        .collection(COLLECTION)
        .where("product_id", "==", productId)
        .where("dateMs", ">=", startMs)
        .where("dateMs", "<=", endMs)
        .orderBy("dateMs", "asc")
        .limit(60)
        .get();

      return snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          product_id: data.product_id,
          business_id: data.business_id,
          date: new Date(data.dateMs),
          views: Number(data.views || 0),
          detail_opens: Number(data.detail_opens || 0),
          add_to_carts: Number(data.add_to_carts || 0),
          saves: Number(data.saves || 0),
          orders: Number(data.orders || 0),
          units_sold: Number(data.units_sold || 0),
          revenue: Number(data.revenue || 0),
        };
      });
    } catch (error) {
      console.error("ProductDailyMetricsRepository.getByProductDateRange error:", error);
      return [];
    }
  }

  /**
   * Get metrics for ALL products of a business over a date range.
   */
  static async getByBusinessDateRange(
    businessId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ProductDailyMetricRow[]> {
    try {
      const startMs = new Date(startDate).setHours(0, 0, 0, 0);
      const endMs = new Date(endDate).setHours(23, 59, 59, 999);

      const snap = await adminDb
        .collection(COLLECTION)
        .where("business_id", "==", businessId)
        .where("dateMs", ">=", startMs)
        .where("dateMs", "<=", endMs)
        .orderBy("dateMs", "asc")
        .limit(5000)
        .get();

      return snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          product_id: data.product_id,
          business_id: data.business_id,
          date: new Date(data.dateMs),
          views: Number(data.views || 0),
          detail_opens: Number(data.detail_opens || 0),
          add_to_carts: Number(data.add_to_carts || 0),
          saves: Number(data.saves || 0),
          orders: Number(data.orders || 0),
          units_sold: Number(data.units_sold || 0),
          revenue: Number(data.revenue || 0),
        };
      });
    } catch (error) {
      console.error("ProductDailyMetricsRepository.getByBusinessDateRange error:", error);
      return [];
    }
  }

  /**
   * Get summed metrics for a product over a date range.
   */
  static async getSumByProduct(
    productId: string,
    startDate: Date,
    endDate: Date
  ): Promise<{
    views: number;
    detail_opens: number;
    add_to_carts: number;
    saves: number;
    orders: number;
    units_sold: number;
    revenue: number;
  }> {
    try {
      const rows = await this.getByProductDateRange(productId, startDate, endDate);
      return {
        views: rows.reduce((s, r) => s + r.views, 0),
        detail_opens: rows.reduce((s, r) => s + r.detail_opens, 0),
        add_to_carts: rows.reduce((s, r) => s + r.add_to_carts, 0),
        saves: rows.reduce((s, r) => s + r.saves, 0),
        orders: rows.reduce((s, r) => s + r.orders, 0),
        units_sold: rows.reduce((s, r) => s + r.units_sold, 0),
        revenue: rows.reduce((s, r) => s + r.revenue, 0),
      };
    } catch (error) {
      console.error("ProductDailyMetricsRepository.getSumByProduct error:", error);
      return { views: 0, detail_opens: 0, add_to_carts: 0, saves: 0, orders: 0, units_sold: 0, revenue: 0 };
    }
  }

  /**
   * Delete old metrics (cleanup, e.g. > 90 days).
   */
  static async deleteOlderThan(date: Date): Promise<number> {
    try {
      const cutoffMs = date.getTime();
      const snap = await adminDb
        .collection(COLLECTION)
        .where("dateMs", "<", cutoffMs)
        .limit(500)
        .get();

      if (snap.empty) return 0;

      const batch = adminDb.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      return snap.size;
    } catch (error) {
      console.error("ProductDailyMetricsRepository.deleteOlderThan error:", error);
      return 0;
    }
  }
}
