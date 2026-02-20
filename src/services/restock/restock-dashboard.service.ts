// FILE: src/services/restock/restock-dashboard.service.ts
// Reads pre-computed flags and formats them for the dashboard UI.
// No heavy computation here — all done by cron.

import { adminDb } from "@/lib/firebase/admin";
import { ProductInsightFlagsRepository } from "@/repositories/product-insight-flags.repository";
import { ProductDailyMetricsRepository } from "@/repositories/product-daily-metrics.repository";
import { RestockAlertConfigRepository } from "@/repositories/restock-alert-config.repository";
import type {
  RestockDashboardData,
  ProductInsightSummary,
  ProductInsightDetail,
  ProductInsightFlag,
  RestockSeverity,
  RESTOCK_SEVERITY_ORDER,
} from "@/types/restock";

const SEVERITY_ORDER: Record<RestockSeverity, number> = {
  urgent: 4,
  high: 3,
  warning: 2,
  info: 1,
};

export class RestockDashboardService {
  /**
   * Get dashboard overview data for an Apex vendor.
   */
  static async getDashboard(businessId: string): Promise<RestockDashboardData> {
    const flags = await ProductInsightFlagsRepository.getActiveByBusiness(businessId);

    if (flags.length === 0) {
      return {
        risk_products: [],
        rising_demand_products: [],
        needs_attention_products: [],
        total_active_flags: 0,
        last_computed_at: null,
      };
    }

    // Group flags by product
    const productFlags = new Map<string, typeof flags>();
    for (const flag of flags) {
      const existing = productFlags.get(flag.product_id) || [];
      existing.push(flag);
      productFlags.set(flag.product_id, existing);
    }

    // Get product names from Firestore
    const productIds = Array.from(productFlags.keys());
    const productNames = new Map<string, { name: string; image: string }>();

    // Batch fetch product info
    for (const pid of productIds) {
      try {
        const snap = await adminDb.collection("products").doc(pid).get();
        if (snap.exists) {
          const data = snap.data() as any;
          productNames.set(pid, {
            name: String(data.name || "Unnamed"),
            image: Array.isArray(data.images) && data.images.length > 0 ? data.images[0] : "",
          });
        }
      } catch {
        // Non-fatal
      }
    }

    // Build summaries
    const allSummaries: ProductInsightSummary[] = [];

    for (const [productId, pflags] of productFlags) {
      const info = productNames.get(productId) || { name: "Unknown Product", image: "" };
      const topSeverity = pflags.reduce<RestockSeverity>(
        (best, f) => {
          const s = f.severity as RestockSeverity;
          return (SEVERITY_ORDER[s] || 0) > (SEVERITY_ORDER[best] || 0) ? s : best;
        },
        "info"
      );

      const topFlag = pflags.sort(
        (a, b) =>
          (SEVERITY_ORDER[b.severity as RestockSeverity] || 0) -
          (SEVERITY_ORDER[a.severity as RestockSeverity] || 0)
      )[0];

      allSummaries.push({
        product_id: productId,
        product_name: info.name,
        product_image: info.image,
        flags: pflags.map((f) => ({
          id: f.id,
          product_id: f.product_id,
          business_id: f.business_id,
          flag_type: f.flag_type as any,
          severity: f.severity as RestockSeverity,
          message: f.message,
          metadata: f.metadata as any,
          created_at: f.created_at.toISOString(),
          resolved_at: f.resolved_at?.toISOString() || null,
          expires_at: f.expires_at?.toISOString() || null,
        })),
        top_severity: topSeverity,
        top_message: topFlag?.message || "",
      });
    }

    // Categorize
    const risk = allSummaries.filter((s) =>
      s.flags.some((f) =>
        f.flag_type === "stockout_warning" || f.flag_type === "stockout_urgent"
      )
    );

    const rising = allSummaries.filter((s) =>
      s.flags.some((f) =>
        f.flag_type === "demand_rising" ||
        f.flag_type === "demand_spike" ||
        f.flag_type === "no_stock_high_demand"
      )
    );

    const attention = allSummaries.filter((s) =>
      s.flags.some((f) =>
        f.flag_type === "conversion_warning" ||
        f.flag_type === "opportunity_trending"
      )
    );

    // Sort by severity
    const sortBySeverity = (a: ProductInsightSummary, b: ProductInsightSummary) =>
      (SEVERITY_ORDER[b.top_severity] || 0) - (SEVERITY_ORDER[a.top_severity] || 0);

    risk.sort(sortBySeverity);
    rising.sort(sortBySeverity);
    attention.sort(sortBySeverity);

    // Determine last computed time
    const latestFlag = flags.reduce((latest, f) =>
      f.created_at > latest.created_at ? f : latest
    );

    return {
      risk_products: risk,
      rising_demand_products: rising,
      needs_attention_products: attention,
      total_active_flags: flags.length,
      last_computed_at: latestFlag?.created_at?.toISOString() || null,
    };
  }

  /**
   * Get detailed insights for a single product.
   */
  static async getProductInsight(
    productId: string,
    businessId: string
  ): Promise<ProductInsightDetail | null> {
    // Get product from Firestore
    const prodSnap = await adminDb.collection("products").doc(productId).get();
    if (!prodSnap.exists) return null;

    const prodData = prodSnap.data() as any;
    if (prodData.businessId !== businessId) return null;

    // Get flags
    const rawFlags = await ProductInsightFlagsRepository.getActiveByProduct(productId);
    const flags: ProductInsightFlag[] = rawFlags.map((f) => ({
      id: f.id,
      product_id: f.product_id,
      business_id: f.business_id,
      flag_type: f.flag_type as any,
      severity: f.severity as RestockSeverity,
      message: f.message,
      metadata: f.metadata as any,
      created_at: f.created_at.toISOString(),
      resolved_at: f.resolved_at?.toISOString() || null,
      expires_at: f.expires_at?.toISOString() || null,
    }));

    // Get last 14 days of metrics
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const d14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const metricsRows = await ProductDailyMetricsRepository.getByProductDateRange(
      productId,
      d14,
      now
    );

    const last7Sum = await ProductDailyMetricsRepository.getSumByProduct(productId, d7, now);
    const prev7Sum = await ProductDailyMetricsRepository.getSumByProduct(productId, d14, d7);

    const velocity = last7Sum.units_sold / 7;
    const prevVelocity = prev7Sum.units_sold / 7;

    const orderGrowth =
      prev7Sum.orders > 0
        ? ((last7Sum.orders - prev7Sum.orders) / prev7Sum.orders) * 100
        : last7Sum.orders > 0
        ? 100
        : 0;

    const demandTrend: "rising" | "falling" | "stable" =
      orderGrowth >= 30 ? "rising" : orderGrowth <= -30 ? "falling" : "stable";

    const trackStock = prodData.trackStock === true || typeof prodData.stock === "number";
    const currentStock = trackStock ? Number(prodData.stock ?? 0) : null;

    const restockDays =
      trackStock && currentStock !== null && velocity > 0
        ? Math.round((currentStock / Math.max(velocity, 0.1)) * 10) / 10
        : null;

    const conversionRate =
      last7Sum.views > 0 ? last7Sum.orders / last7Sum.views : 0;

    let conversionHint: string | null = null;
    if (last7Sum.views >= 20 && conversionRate < 0.02) {
      conversionHint = "Many views but few orders — try improving photos, pricing, or descriptions.";
    } else if (conversionRate >= 0.1) {
      conversionHint = "Great conversion rate — this product page is working well.";
    }

    return {
      product_id: productId,
      product_name: String(prodData.name || "Unnamed"),
      sales_velocity: Math.round(velocity * 100) / 100,
      demand_trend: demandTrend,
      demand_trend_pct: Math.round(orderGrowth),
      restock_estimate_days: restockDays,
      current_stock: currentStock,
      track_stock: trackStock,
      conversion_rate: Math.round(conversionRate * 10000) / 100,
      conversion_hint: conversionHint,
      flags,
      daily_metrics: metricsRows.map((r) => ({
        product_id: r.product_id,
        business_id: r.business_id,
        date: r.date.toISOString().split("T")[0],
        views: r.views,
        detail_opens: r.detail_opens,
        add_to_carts: r.add_to_carts,
        saves: r.saves,
        orders: r.orders,
        units_sold: r.units_sold,
        revenue: r.revenue,
      })),
    };
  }
}
