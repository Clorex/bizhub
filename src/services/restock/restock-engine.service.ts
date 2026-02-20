// FILE: src/services/restock/restock-engine.service.ts
// Core computation engine for Smart Restock & Demand Alerts
// Runs daily via cron. Never computed on request.

import { adminDb } from "@/lib/firebase/admin";
import { ProductDailyMetricsRepository } from "@/repositories/product-daily-metrics.repository";
import { ProductInsightFlagsRepository } from "@/repositories/product-insight-flags.repository";
import { RestockAlertConfigRepository } from "@/repositories/restock-alert-config.repository";
import { sendBusinessPush } from "@/lib/push/sendBusinessPush";
import type {
  RestockFlagType,
  RestockSeverity,
  RestockAlertConfig,
} from "@/types/restock";

interface ProductData {
  id: string;
  name: string;
  price: number;
  stock: number;
  trackStock: boolean;
  businessId: string;
  images?: string[];
}

interface ComputedMetrics {
  // Velocity
  units_sold_last_7: number;
  sales_velocity: number;

  // Stock
  days_to_stockout: number | null;

  // Growth (3-day window vs previous 3 days)
  views_last_3: number;
  views_prev_3: number;
  views_growth_pct: number;
  carts_last_3: number;
  carts_prev_3: number;
  cart_growth_pct: number;

  // Growth (7-day window vs previous 7 days)
  orders_last_7: number;
  orders_prev_7: number;
  orders_growth_pct: number;

  // Conversion
  views_last_7: number;
  conversion_rate: number;
}

function growthPct(current: number, previous: number): number {
  if (previous === 0 && current === 0) return 0;
  if (previous === 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

export class RestockEngineService {
  /**
   * Main entry: process all Apex businesses.
   */
  static async processAllApexBusinesses(): Promise<{
    businessesProcessed: number;
    flagsCreated: number;
    errors: string[];
  }> {
    let businessesProcessed = 0;
    let flagsCreated = 0;
    const errors: string[] = [];

    try {
      // Get all businesses with active Apex subscription
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

      console.log(`[RestockEngine] Found ${apexBusinesses.length} active Apex businesses`);

      for (const biz of apexBusinesses) {
        try {
          const result = await this.processOneBusiness(biz.id);
          businessesProcessed++;
          flagsCreated += result.flagsCreated;
        } catch (err: any) {
          const msg = `Business ${biz.id}: ${err?.message || err}`;
          console.error(`[RestockEngine] ${msg}`);
          errors.push(msg);
        }
      }
    } catch (err: any) {
      errors.push(`Global error: ${err?.message || err}`);
    }

    return { businessesProcessed, flagsCreated, errors };
  }

  /**
   * Process one business: aggregate metrics, detect signals, create flags.
   */
  static async processOneBusiness(businessId: string): Promise<{
    productsProcessed: number;
    flagsCreated: number;
  }> {
    const config = await RestockAlertConfigRepository.getByBusiness(businessId);
    if (!config.enabled) {
      return { productsProcessed: 0, flagsCreated: 0 };
    }

    // Get all active products for this business from Firestore
    const prodSnap = await adminDb
      .collection("products")
      .where("businessId", "==", businessId)
      .limit(500)
      .get();

    const products: ProductData[] = prodSnap.docs
      .map((d) => {
        const data = d.data() as any;
        if (data.isDeleted || data.deletedAt) return null;
        return {
          id: d.id,
          name: String(data.name || "Unnamed"),
          price: Number(data.price || 0),
          stock: Number(data.stock ?? 0),
          trackStock: data.trackStock === true || (typeof data.stock === "number" && data.stock >= 0),
          businessId,
          images: Array.isArray(data.images) ? data.images : [],
        };
      })
      .filter(Boolean) as ProductData[];

    if (products.length === 0) {
      return { productsProcessed: 0, flagsCreated: 0 };
    }

    // Compute store-wide average velocity for trending detection
    let totalStoreVelocity = 0;
    let productsWithSales = 0;
    let flagsCreated = 0;

    // First pass: compute metrics for each product
    const productMetrics: Map<string, ComputedMetrics> = new Map();

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    for (const product of products) {
      const metrics = await this.computeProductMetrics(product.id, now);
      productMetrics.set(product.id, metrics);

      if (metrics.sales_velocity > 0) {
        totalStoreVelocity += metrics.sales_velocity;
        productsWithSales++;
      }
    }

    const storeAvgVelocity =
      productsWithSales > 0 ? totalStoreVelocity / productsWithSales : 0;

    // Second pass: generate alerts
    for (const product of products) {
      const metrics = productMetrics.get(product.id);
      if (!metrics) continue;

      const created = await this.generateAlerts(
        product,
        metrics,
        config,
        storeAvgVelocity
      );
      flagsCreated += created;
    }

    // Resolve expired flags
    await ProductInsightFlagsRepository.resolveExpired();

    // Send consolidated push if new flags were created
    if (flagsCreated > 0) {
      try {
        await sendBusinessPush({
          businessId,
          title: "Smart Restock Alert",
          body: `${flagsCreated} new product insight${flagsCreated !== 1 ? "s" : ""} need your attention.`,
          url: "/vendor/restock",
        });
      } catch {
        // Push failure is non-fatal
      }
    }

    return { productsProcessed: products.length, flagsCreated };
  }

  /**
   * Compute all metrics for a single product.
   */
  static async computeProductMetrics(
    productId: string,
    today: Date
  ): Promise<ComputedMetrics> {
    const day = 24 * 60 * 60 * 1000;

    // Date windows
    const d1 = new Date(today.getTime() - 1 * day); // yesterday
    const d3 = new Date(today.getTime() - 3 * day);
    const d6 = new Date(today.getTime() - 6 * day);
    const d7 = new Date(today.getTime() - 7 * day);
    const d14 = new Date(today.getTime() - 14 * day);

    // Get last 14 days of metrics
    const rows = await ProductDailyMetricsRepository.getByProductDateRange(
      productId,
      d14,
      d1
    );

    // Split into windows
    const last3 = rows.filter(
      (r) => r.date >= d3 && r.date <= d1
    );
    const prev3 = rows.filter(
      (r) => r.date >= d6 && r.date < d3
    );
    const last7 = rows.filter(
      (r) => r.date >= d7 && r.date <= d1
    );
    const prev7 = rows.filter(
      (r) => r.date >= d14 && r.date < d7
    );

    const sum = (arr: typeof rows, key: "views" | "add_to_carts" | "orders" | "units_sold") =>
      arr.reduce((s, r) => s + (r[key] ?? 0), 0);

    const units_sold_last_7 = sum(last7, "units_sold");
    const sales_velocity = units_sold_last_7 / 7;

    const views_last_3 = sum(last3, "views");
    const views_prev_3 = sum(prev3, "views");
    const carts_last_3 = sum(last3, "add_to_carts");
    const carts_prev_3 = sum(prev3, "add_to_carts");
    const orders_last_7 = sum(last7, "orders");
    const orders_prev_7 = sum(prev7, "orders");
    const views_last_7 = sum(last7, "views");

    const conversion_rate =
      views_last_7 > 0 ? orders_last_7 / views_last_7 : 0;

    return {
      units_sold_last_7,
      sales_velocity,
      days_to_stockout: null, // Computed per-product with stock data
      views_last_3,
      views_prev_3,
      views_growth_pct: growthPct(views_last_3, views_prev_3),
      carts_last_3,
      carts_prev_3,
      cart_growth_pct: growthPct(carts_last_3, carts_prev_3),
      orders_last_7,
      orders_prev_7,
      orders_growth_pct: growthPct(orders_last_7, orders_prev_7),
      views_last_7,
      conversion_rate,
    };
  }

  /**
   * Generate alerts for a product based on computed metrics.
   */
  static async generateAlerts(
    product: ProductData,
    metrics: ComputedMetrics,
    config: RestockAlertConfig,
    storeAvgVelocity: number
  ): Promise<number> {
    let created = 0;
    const cooldown = config.alert_cooldown_hours;

    // === 1. STOCKOUT PREDICTION ===
    if (product.trackStock && product.stock >= 0) {
      const velocity = Math.max(metrics.sales_velocity, 0.1);
      const daysToStockout = product.stock / velocity;

      if (daysToStockout <= config.stockout_urgent_days) {
        if (
          !(await ProductInsightFlagsRepository.hasRecentFlag(
            product.id,
            "stockout_urgent",
            cooldown
          ))
        ) {
          await ProductInsightFlagsRepository.create({
            product_id: product.id,
            business_id: product.businessId,
            flag_type: "stockout_urgent",
            severity: "urgent",
            message: `Stock critical — may run out in ${Math.ceil(daysToStockout)} day${Math.ceil(daysToStockout) !== 1 ? "s" : ""} based on current sales.`,
            metadata: {
              current_stock: product.stock,
              sales_velocity: Math.round(metrics.sales_velocity * 100) / 100,
              days_to_stockout: Math.round(daysToStockout * 10) / 10,
              track_stock: true,
              product_name: product.name,
              product_price: product.price,
            },
            expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          });
          created++;
        }
      } else if (daysToStockout <= config.stockout_warn_days) {
        if (
          !(await ProductInsightFlagsRepository.hasRecentFlag(
            product.id,
            "stockout_warning",
            cooldown
          ))
        ) {
          await ProductInsightFlagsRepository.create({
            product_id: product.id,
            business_id: product.businessId,
            flag_type: "stockout_warning",
            severity: "high",
            message: `Stock may finish in about ${Math.ceil(daysToStockout)} days based on current sales rate.`,
            metadata: {
              current_stock: product.stock,
              sales_velocity: Math.round(metrics.sales_velocity * 100) / 100,
              days_to_stockout: Math.round(daysToStockout * 10) / 10,
              track_stock: true,
              product_name: product.name,
              product_price: product.price,
            },
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          });
          created++;
        }
      }
    }

    // === 2. DEMAND SPIKE / RISING (no stock tracking — proxy) ===
    const maxGrowth = Math.max(
      metrics.views_growth_pct,
      metrics.cart_growth_pct,
      metrics.orders_growth_pct
    );

    if (maxGrowth >= config.spike_threshold_pct) {
      if (
        !(await ProductInsightFlagsRepository.hasRecentFlag(
          product.id,
          "demand_spike",
          cooldown
        ))
      ) {
        await ProductInsightFlagsRepository.create({
          product_id: product.id,
          business_id: product.businessId,
          flag_type: "demand_spike",
          severity: "high",
          message: `Demand spiking — interest up ${Math.round(maxGrowth)}%. Make sure you can keep up.`,
          metadata: {
            views_growth_pct: Math.round(metrics.views_growth_pct),
            cart_growth_pct: Math.round(metrics.cart_growth_pct),
            orders_growth_pct: Math.round(metrics.orders_growth_pct),
            product_name: product.name,
            product_price: product.price,
          },
          expires_at: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        });
        created++;
      }
    } else if (maxGrowth >= config.growth_threshold_pct) {
      if (
        !(await ProductInsightFlagsRepository.hasRecentFlag(
          product.id,
          "demand_rising",
          cooldown
        ))
      ) {
        await ProductInsightFlagsRepository.create({
          product_id: product.id,
          business_id: product.businessId,
          flag_type: "demand_rising",
          severity: "warning",
          message: `Demand rising fast — consider restocking soon.`,
          metadata: {
            views_growth_pct: Math.round(metrics.views_growth_pct),
            cart_growth_pct: Math.round(metrics.cart_growth_pct),
            orders_growth_pct: Math.round(metrics.orders_growth_pct),
            product_name: product.name,
            product_price: product.price,
          },
          expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        });
        created++;
      }
    }

    // === 3. NO STOCK TRACKING + HIGH DEMAND ===
    if (!product.trackStock && maxGrowth >= config.growth_threshold_pct) {
      if (
        !(await ProductInsightFlagsRepository.hasRecentFlag(
          product.id,
          "no_stock_high_demand",
          cooldown
        ))
      ) {
        await ProductInsightFlagsRepository.create({
          product_id: product.id,
          business_id: product.businessId,
          flag_type: "no_stock_high_demand",
          severity: "warning",
          message: `High demand detected but stock isn't tracked. Enable stock tracking to get restock predictions.`,
          metadata: {
            views_growth_pct: Math.round(metrics.views_growth_pct),
            cart_growth_pct: Math.round(metrics.cart_growth_pct),
            product_name: product.name,
          },
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
        created++;
      }
    }

    // === 4. CONVERSION WARNING ===
    if (
      metrics.views_last_7 >= 20 &&
      metrics.conversion_rate < 0.02
    ) {
      if (
        !(await ProductInsightFlagsRepository.hasRecentFlag(
          product.id,
          "conversion_warning",
          cooldown
        ))
      ) {
        await ProductInsightFlagsRepository.create({
          product_id: product.id,
          business_id: product.businessId,
          flag_type: "conversion_warning",
          severity: "info",
          message: `Many views but low orders — review price, photos, or description.`,
          metadata: {
            views_count: metrics.views_last_7,
            orders_count: metrics.orders_last_7,
            conversion_rate: Math.round(metrics.conversion_rate * 10000) / 100,
            product_name: product.name,
            product_price: product.price,
          },
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        });
        created++;
      }
    }

    // === 5. OPPORTUNITY — TRENDING ABOVE STORE AVERAGE ===
    if (
      storeAvgVelocity > 0 &&
      metrics.sales_velocity >= storeAvgVelocity * 1.5 &&
      metrics.sales_velocity >= 0.5
    ) {
      if (
        !(await ProductInsightFlagsRepository.hasRecentFlag(
          product.id,
          "opportunity_trending",
          cooldown
        ))
      ) {
        await ProductInsightFlagsRepository.create({
          product_id: product.id,
          business_id: product.businessId,
          flag_type: "opportunity_trending",
          severity: "info",
          message: `This product is trending above your store average.`,
          metadata: {
            store_avg_velocity: Math.round(storeAvgVelocity * 100) / 100,
            product_velocity: Math.round(metrics.sales_velocity * 100) / 100,
            product_name: product.name,
            product_price: product.price,
          },
          expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        });
        created++;
      }
    }

    return created;
  }
}
