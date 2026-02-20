/**
 * Restock Analyzer (Firestore-backed)
 * IMPORTANT:
 * - Your Prisma schema does NOT include ProductDailyMetric/ProductInsightFlag/RestockAlertConfig delegates.
 * - The restock feature in this repo is implemented using Firestore repositories.
 * - This service must NOT depend on Prisma, otherwise Vercel build will fail.
 */

import { adminDb } from "@/lib/firebase/admin";
import { RESTOCK_CONFIG } from "@/config/analytics.config";
import { ProductDailyMetricsRepository } from "@/repositories/product-daily-metrics.repository";
import { ProductInsightFlagsRepository } from "@/repositories/product-insight-flags.repository";
import { RestockAlertConfigRepository } from "@/repositories/restock-alert-config.repository";
import type {
  ProductInsightFlag,
  RestockFlagType,
  RestockSeverity,
  RestockFlagMetadata,
} from "@/types/restock";

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export class RestockAnalyzerService {
  /**
   * Analyze a single product and (optionally) persist flags.
   * This is safe for Vercel builds because it uses Firestore repos only.
   */
  async analyzeProduct(
    businessId: string,
    productId: string
  ): Promise<{
    flags: ProductInsightFlag[];
    velocity: number;
    trendPct: number;
    daysToStockout: number | null;
  }> {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const d14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
    const d7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const cfg = await RestockAlertConfigRepository.getByBusiness(businessId);

    // Pull metrics (Firestore agg collection)
    const rows = await ProductDailyMetricsRepository.getByProductDateRange(productId, d14, now);

    // Velocity (units/day last 7 days)
    const last7 = rows.filter((r) => r.date >= d7 && r.date <= now);
    const units7 = last7.reduce((acc: number, r) => acc + safeNum(r.units_sold), 0);
    const velocity = Math.round((units7 / 7) * 10) / 10;

    // Trend: last 3 days vs previous 3 days (views)
    const d3 = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const d6 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);

    const last3 = rows.filter((r) => r.date >= d3 && r.date <= now);
    const prev3 = rows.filter((r) => r.date >= d6 && r.date < d3);

    const last3Views = last3.reduce((acc: number, r) => acc + safeNum(r.views), 0);
    const prev3Views = prev3.reduce((acc: number, r) => acc + safeNum(r.views), 0);

    const trendPct =
      prev3Views === 0 ? (last3Views > 0 ? 100 : 0) : ((last3Views - prev3Views) / prev3Views) * 100;

    // Conversion (last 7)
    const views7 = last7.reduce((acc: number, r) => acc + safeNum(r.views), 0);
    const orders7 = last7.reduce((acc: number, r) => acc + safeNum(r.orders), 0);
    const convRate = views7 > 0 ? orders7 / views7 : 0;

    // Fetch product stock data from Firestore
    // (restock feature uses Firestore products collection)
    let trackStock = false;
    let currentStock: number | null = null;
    try {
      const snap = await adminDb.collection("products").doc(productId).get();
      if (snap.exists) {
        const p = snap.data() as any;
        trackStock = p?.trackStock === true || typeof p?.stock === "number";
        if (trackStock) currentStock = safeNum(p?.stock);
      }
    } catch {
      // non-fatal
    }

    const daysToStockout =
      trackStock && currentStock !== null && velocity > 0
        ? Math.round((currentStock / Math.max(velocity, 0.1)) * 10) / 10
        : null;

    const flags: ProductInsightFlag[] = [];

    // STOCKOUT FLAGS
    if (daysToStockout !== null) {
      if (daysToStockout <= cfg.stockout_urgent_days) {
        flags.push(
          this.makeFlag(businessId, productId, "stockout_urgent", "urgent", `Stock may run out in ${Math.ceil(daysToStockout)} day(s).`, {
            current_stock: currentStock ?? undefined,
            sales_velocity: velocity,
            days_to_stockout: daysToStockout,
            track_stock: true,
          })
        );
      } else if (daysToStockout <= cfg.stockout_warn_days) {
        flags.push(
          this.makeFlag(businessId, productId, "stockout_warning", "high", `Low stock risk: ~${Math.ceil(daysToStockout)} day(s) remaining.`, {
            current_stock: currentStock ?? undefined,
            sales_velocity: velocity,
            days_to_stockout: daysToStockout,
            track_stock: true,
          })
        );
      }
    }

    // DEMAND FLAGS
    if (trendPct >= cfg.spike_threshold_pct) {
      flags.push(
        this.makeFlag(businessId, productId, "demand_spike", "high", `Demand spiked by ${Math.round(trendPct)}%.`, {
          views_growth_pct: Math.round(trendPct),
          sales_velocity: velocity,
        })
      );
    } else if (trendPct >= cfg.growth_threshold_pct) {
      flags.push(
        this.makeFlag(businessId, productId, "demand_rising", "warning", `Demand rising (+${Math.round(trendPct)}%).`, {
          views_growth_pct: Math.round(trendPct),
          sales_velocity: velocity,
        })
      );
    }

    // NO STOCK TRACKING + HIGH DEMAND
    if (!trackStock && velocity >= 5 && trendPct >= cfg.growth_threshold_pct) {
      flags.push(
        this.makeFlag(businessId, productId, "no_stock_high_demand", "warning", "High demand detected but stock tracking is disabled.", {
          views_growth_pct: Math.round(trendPct),
          sales_velocity: velocity,
          track_stock: false,
        })
      );
    }

    // CONVERSION WARNING (use configured thresholds)
    if (views7 >= RESTOCK_CONFIG.LOW_CONVERSION_VIEWS_MIN && convRate < RESTOCK_CONFIG.LOW_CONVERSION_RATE_THRESHOLD) {
      flags.push(
        this.makeFlag(businessId, productId, "conversion_warning", "info", "Low conversion rate. Improve photos, price, or description.", {
          views_count: views7,
          orders_count: orders7,
          conversion_rate: Math.round(convRate * 10000) / 100,
        })
      );
    }

    return { flags, velocity, trendPct, daysToStockout };
  }

  /**
   * Run analysis for all products in a business (safe Firestore scan).
   * This is optional — your main cron uses RestockEngineService already.
   */
  async runDailyAnalysis(businessId: string): Promise<{ productsProcessed: number; flagsCreated: number; errors: string[] }> {
    const errors: string[] = [];
    let productsProcessed = 0;
    let flagsCreated = 0;

    const snap = await adminDb
      .collection("products")
      .where("businessId", "==", businessId)
      .limit(500)
      .get();

    const products = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .filter((p) => !p.isDeleted && !p.deletedAt);

    for (const p of products) {
      try {
        const productId = String(p.id);
        const { flags } = await this.analyzeProduct(businessId, productId);
        productsProcessed++;

        for (const f of flags) {
          const recent = await ProductInsightFlagsRepository.hasRecentFlag(
            productId,
            f.flag_type,
            cfgCooldownHours(businessId)
          );
          if (!recent) {
            await ProductInsightFlagsRepository.create({
              product_id: productId,
              business_id: businessId,
              flag_type: f.flag_type,
              severity: f.severity,
              message: f.message,
              metadata: f.metadata ?? null,
              expires_at: f.expires_at ? new Date(f.expires_at) : undefined,
            });
            flagsCreated++;
          }
        }
      } catch (e: any) {
        errors.push(e?.message || String(e));
      }
    }

    return { productsProcessed, flagsCreated, errors };
  }

  private makeFlag(
    businessId: string,
    productId: string,
    type: RestockFlagType,
    severity: RestockSeverity,
    message: string,
    metadata: RestockFlagMetadata
  ): ProductInsightFlag {
    const now = new Date();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    return {
      id: `temp_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      product_id: productId,
      business_id: businessId,
      flag_type: type,
      severity,
      message,
      metadata: metadata ?? null,
      created_at: now.toISOString(),
      resolved_at: null,
      expires_at: expires.toISOString(),
    };
  }
}

async function cfgCooldownHours(businessId: string): Promise<number> {
  try {
    const cfg = await RestockAlertConfigRepository.getByBusiness(businessId);
    return clamp(Number(cfg.alert_cooldown_hours || 48), 6, 168);
  } catch {
    return 48;
  }
}

export const restockAnalyzer = new RestockAnalyzerService();
