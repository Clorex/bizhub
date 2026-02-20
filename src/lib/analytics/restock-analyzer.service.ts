import { prisma } from "@/lib/db";
import { RESTOCK_CONFIG } from "@/config/analytics.config";
import type {
  ProductInsightFlag,
  RestockFlagType,
  RestockSeverity,
  RestockFlagMetadata,
} from "@/types/restock";

type RestockConfig = {
  demandRisingThresholdPct: number;
  demandSpikeThresholdPct: number;
  stockoutWarnDays: number;
  stockoutUrgentDays: number;
  lowConversionViewsMin: number;
  lowConversionRateThreshold: number;
  alertCooldownHours: number;
};

const DEFAULT_CONFIG: RestockConfig = {
  demandRisingThresholdPct: RESTOCK_CONFIG.DEMAND_RISING_THRESHOLD_PCT,
  demandSpikeThresholdPct: RESTOCK_CONFIG.DEMAND_SPIKE_THRESHOLD_PCT,
  stockoutWarnDays: RESTOCK_CONFIG.STOCKOUT_WARN_DAYS,
  stockoutUrgentDays: RESTOCK_CONFIG.STOCKOUT_URGENT_DAYS,
  lowConversionViewsMin: RESTOCK_CONFIG.LOW_CONVERSION_VIEWS_MIN,
  lowConversionRateThreshold: RESTOCK_CONFIG.LOW_CONVERSION_RATE_THRESHOLD,
  alertCooldownHours: RESTOCK_CONFIG.ALERT_COOLDOWN_HOURS,
};

function num(v: any, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function asDateMs(v: any): number {
  try {
    if (!v) return 0;
    if (v instanceof Date) return v.getTime();
    if (typeof v?.toDate === "function") return v.toDate().getTime();
    if (typeof v === "string" || typeof v === "number") {
      const d = new Date(v);
      return isNaN(d.getTime()) ? 0 : d.getTime();
    }
    return 0;
  } catch {
    return 0;
  }
}

export class RestockAnalyzerService {
  /**
   * Main entry point: Analyze a single product
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
    const config = await this.getConfig(businessId);
    const metrics = await this.getProductMetrics(businessId, productId);

    if (!metrics.length) {
      return { flags: [], velocity: 0, trendPct: 0, daysToStockout: null };
    }

    // 1) Velocity: units/day (last up to 7 records)
    const velocity = this.calculateVelocity(metrics);

    // 2) Trend: views last 3 vs previous 4
    const trendPct = this.calculateTrend(metrics);

    // 3) Stock: your Prisma Product type (as seen in earlier error) does not include stock/trackStock.
    //    So we disable stockout math safely.
    const currentStock: number | null = null;
    const daysToStockout: number | null = null;

    const flags: ProductInsightFlag[] = [];

    // A) If stock tracking doesn't exist, still detect high demand
    if (currentStock === null) {
      if (velocity >= 5 && trendPct >= 50) {
        flags.push(
          this.makeFlag({
            businessId,
            productId,
            type: "no_stock_high_demand" as RestockFlagType,
            severity: "warning" as RestockSeverity,
            message:
              "High demand detected but stock tracking is unavailable. Enable inventory tracking in your product model to unlock stockout alerts.",
            metadata: {
              sales_velocity: velocity,
              views_growth_pct: trendPct,
            } as any,
          })
        );
      }
    } else {
      // (kept for future if you add stock fields)
      if (daysToStockout !== null && daysToStockout <= config.stockoutUrgentDays) {
        flags.push(
          this.makeFlag({
            businessId,
            productId,
            type: "stockout_urgent" as RestockFlagType,
            severity: "urgent" as RestockSeverity,
            message: `Stock will run out in ${daysToStockout} days. Restock immediately.`,
            metadata: {
              current_stock: currentStock,
              sales_velocity: velocity,
              days_to_stockout: daysToStockout,
            } as any,
          })
        );
      } else if (daysToStockout !== null && daysToStockout <= config.stockoutWarnDays) {
        flags.push(
          this.makeFlag({
            businessId,
            productId,
            type: "stockout_warning" as RestockFlagType,
            severity: "warning" as RestockSeverity,
            message: `Low stock. Will run out in ~${daysToStockout} days.`,
            metadata: {
              current_stock: currentStock,
              sales_velocity: velocity,
              days_to_stockout: daysToStockout,
            } as any,
          })
        );
      }
    }

    // B) Demand spikes / rising
    if (trendPct >= config.demandSpikeThresholdPct) {
      flags.push(
        this.makeFlag({
          businessId,
          productId,
          type: "demand_spike" as RestockFlagType,
          severity: "high" as RestockSeverity,
          message: `Demand spiked by ${Math.round(trendPct)}%! Consider restocking or boosting this listing.`,
          metadata: {
            views_growth_pct: trendPct,
            sales_velocity: velocity,
          } as any,
        })
      );
    } else if (trendPct >= config.demandRisingThresholdPct) {
      flags.push(
        this.makeFlag({
          businessId,
          productId,
          type: "demand_rising" as RestockFlagType,
          severity: "info" as RestockSeverity,
          message: `Demand is trending up (+${Math.round(trendPct)}%).`,
          metadata: {
            views_growth_pct: trendPct,
            sales_velocity: velocity,
          } as any,
        })
      );
    }

    // C) Conversion warning
    const totalViews = metrics.reduce((acc, m) => acc + Number((m as any)?.views || 0), 0);
    const totalOrders = metrics.reduce((acc, m) => acc + Number((m as any)?.orders || 0), 0);
    const convRate = totalViews > 0 ? totalOrders / totalViews : 0;

    if (
      totalViews >= config.lowConversionViewsMin &&
      convRate < config.lowConversionRateThreshold &&
      totalViews > 0
    ) {
      flags.push(
        this.makeFlag({
          businessId,
          productId,
          type: "conversion_warning" as RestockFlagType,
          severity: "warning" as RestockSeverity,
          message: "Low conversion rate. Improve photos, title, pricing, or delivery offer.",
          metadata: {
            views_count: totalViews,
            orders_count: totalOrders,
            conversion_rate: convRate,
          } as any,
        })
      );
    }

    return { flags, velocity, trendPct, daysToStockout };
  }

  /**
   * Daily Cron Job: aggregate + analyze all active products
   */
  async runDailyAnalysis(businessId: string) {
    console.log(`[Restock] Running daily analysis for ${businessId}`);

    await this.aggregateDailyMetrics(businessId);

    // Product model in your Prisma appears snake_case (vendor_id, is_active)
    const products = await prisma.product.findMany({
      where: { vendor_id: businessId, is_active: true },
      select: { id: true },
    });

    for (const p of products) {
      // eslint-disable-next-line no-await-in-loop
      await this.analyzeAndSaveFlags(businessId, p.id);
    }
  }

  /**
   * Load config overrides (safe).
   * We DO NOT attempt to create a DB config row here because we don't know your table shape.
   * We simply read what exists and merge numeric overrides if present.
   */
  private async getConfig(businessId: string): Promise<RestockConfig> {
    try {
      const row = await prisma.restockAlertConfig.findUnique({
        where: { business_id: businessId },
      });

      const r: any = row;

      return {
        demandRisingThresholdPct: num(
          r?.demand_rising_threshold_pct ?? r?.DEMAND_RISING_THRESHOLD_PCT,
          DEFAULT_CONFIG.demandRisingThresholdPct
        ),
        demandSpikeThresholdPct: num(
          r?.demand_spike_threshold_pct ?? r?.DEMAND_SPIKE_THRESHOLD_PCT,
          DEFAULT_CONFIG.demandSpikeThresholdPct
        ),
        stockoutWarnDays: num(
          r?.stockout_warn_days ?? r?.STOCKOUT_WARN_DAYS,
          DEFAULT_CONFIG.stockoutWarnDays
        ),
        stockoutUrgentDays: num(
          r?.stockout_urgent_days ?? r?.STOCKOUT_URGENT_DAYS,
          DEFAULT_CONFIG.stockoutUrgentDays
        ),
        lowConversionViewsMin: num(
          r?.low_conversion_views_min ?? r?.LOW_CONVERSION_VIEWS_MIN,
          DEFAULT_CONFIG.lowConversionViewsMin
        ),
        lowConversionRateThreshold: num(
          r?.low_conversion_rate_threshold ?? r?.LOW_CONVERSION_RATE_THRESHOLD,
          DEFAULT_CONFIG.lowConversionRateThreshold
        ),
        alertCooldownHours: num(
          r?.alert_cooldown_hours ?? r?.ALERT_COOLDOWN_HOURS,
          DEFAULT_CONFIG.alertCooldownHours
        ),
      };
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  private async getProductMetrics(businessId: string, productId: string) {
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    const rows = await prisma.productDailyMetric.findMany({
      where: {
        business_id: businessId,
        product_id: productId,
        date: { gte: tenDaysAgo },
      },
      orderBy: { date: "asc" },
    });

    // Ensure stable ordering even if DB returns weird types
    return rows.sort((a: any, b: any) => asDateMs(a?.date) - asDateMs(b?.date));
  }

  private calculateVelocity(metrics: any[]): number {
    if (!metrics.length) return 0;
    const last = metrics.slice(-7);
    const totalUnits = last.reduce((acc, m) => acc + Number((m as any)?.units_sold || 0), 0);
    const denom = Math.max(1, last.length);
    const v = totalUnits / denom;
    return Math.round(v * 10) / 10; // 1dp
  }

  private calculateTrend(metrics: any[]): number {
    if (metrics.length < 5) return 0;

    const last3 = metrics.slice(-3);
    const prev4 = metrics.slice(-7, -3);

    const last3Avg = last3.reduce((acc, m) => acc + Number((m as any)?.views || 0), 0) / 3;
    const prev4Avg = prev4.reduce((acc, m) => acc + Number((m as any)?.views || 0), 0) / 4;

    if (prev4Avg === 0) return last3Avg > 0 ? 100 : 0;
    return ((last3Avg - prev4Avg) / prev4Avg) * 100;
  }

  private makeFlag(args: {
    businessId: string;
    productId: string;
    type: RestockFlagType;
    severity: RestockSeverity;
    message: string;
    metadata: RestockFlagMetadata;
  }): ProductInsightFlag {
    return {
      id: `temp_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      product_id: args.productId,
      business_id: args.businessId,
      flag_type: args.type,
      severity: args.severity,
      message: args.message,
      metadata: args.metadata,
      created_at: new Date().toISOString(),
      resolved_at: null,
      expires_at: null,
    } as any;
  }

  private async analyzeAndSaveFlags(businessId: string, productId: string) {
    const { flags } = await this.analyzeProduct(businessId, productId);

    await prisma.productInsightFlag.deleteMany({
      where: { business_id: businessId, product_id: productId, resolved_at: null },
    });

    if (!flags.length) return;

    const expiresAtIso = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await prisma.productInsightFlag.createMany({
      data: flags.map((f: any) => ({
        business_id: businessId,
        product_id: productId,
        flag_type: f.flag_type,
        severity: f.severity,
        message: f.message,
        metadata: f.metadata,
        created_at: f.created_at || new Date().toISOString(),
        resolved_at: null,
        expires_at: expiresAtIso,
      })) as any,
    });
  }

  private async aggregateDailyMetrics(businessId: string) {
    // Placeholder (your comment said real impl depends on your raw events table)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0];
    console.log(`[Restock] Aggregating metrics for ${businessId} on ${dateStr}`);
  }
}

export const restockAnalyzer = new RestockAnalyzerService();
