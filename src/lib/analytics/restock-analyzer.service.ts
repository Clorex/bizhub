import { prisma } from "@/lib/db";
import { RESTOCK_CONFIG } from "@/config/analytics.config";
import type {
  ProductInsightFlag,
  RestockFlagMetadata,
  RestockFlagType,
  RestockSeverity,
} from "@/types/restock";

type RestockConfig = {
  demandRisingThresholdPct: number;
  demandSpikeThresholdPct: number;
  lowConversionViewsMin: number;
  lowConversionRateThreshold: number;
};

const DEFAULT_CONFIG: RestockConfig = {
  demandRisingThresholdPct: RESTOCK_CONFIG.DEMAND_RISING_THRESHOLD_PCT,
  demandSpikeThresholdPct: RESTOCK_CONFIG.DEMAND_SPIKE_THRESHOLD_PCT,
  lowConversionViewsMin: RESTOCK_CONFIG.LOW_CONVERSION_VIEWS_MIN,
  lowConversionRateThreshold: RESTOCK_CONFIG.LOW_CONVERSION_RATE_THRESHOLD,
};

function asNum(v: any): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
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
    const config = this.getConfig(businessId);
    const metrics = await this.getProductMetrics(businessId, productId);

    if (metrics.length === 0) {
      return { flags: [], velocity: 0, trendPct: 0, daysToStockout: null };
    }

    const velocity = this.calculateVelocity(metrics);
    const trendPct = this.calculateTrend(metrics);

    const flags: ProductInsightFlag[] = [];

    // Demand spike / rising
    if (trendPct >= config.demandSpikeThresholdPct) {
      flags.push(
        this.makeFlag({
          businessId,
          productId,
          type: "demand_spike" as RestockFlagType,
          severity: "high" as RestockSeverity,
          message: `Demand spiked by ${Math.round(trendPct)}%. Consider restocking or promoting this listing.`,
          metadata: { views_growth_pct: trendPct, sales_velocity: velocity } as any,
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
          metadata: { views_growth_pct: trendPct, sales_velocity: velocity } as any,
        })
      );
    }

    // Conversion warning
    const totalViews = metrics.reduce((acc: number, m: any) => acc + asNum(m?.views), 0);
    const totalOrders = metrics.reduce((acc: number, m: any) => acc + asNum(m?.orders), 0);
    const convRate = totalViews > 0 ? totalOrders / totalViews : 0;

    if (
      totalViews >= config.lowConversionViewsMin &&
      convRate < config.lowConversionRateThreshold
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

    // Stockout analysis disabled (your Prisma Product type does not include stock fields)
    return { flags, velocity, trendPct, daysToStockout: null };
  }

  /**
   * Daily Cron Job: aggregate + analyze all active products
   */
  async runDailyAnalysis(businessId: string) {
    await this.aggregateDailyMetrics(businessId);

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
   * IMPORTANT:
   * We do NOT read config from DB because Prisma Client in Vercel does not expose restockAlertConfig.
   */
  private getConfig(_businessId: string): RestockConfig {
    return DEFAULT_CONFIG;
  }

  /**
   * Pull last ~10 days of metrics using snake_case Prisma fields.
   */
  private async getProductMetrics(businessId: string, productId: string): Promise<any[]> {
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

    return Array.isArray(rows) ? rows : [];
  }

  private calculateVelocity(metrics: any[]): number {
    const last = metrics.slice(-7);
    if (last.length === 0) return 0;
    const totalUnits = last.reduce((acc: number, m: any) => acc + asNum(m?.units_sold), 0);
    const v = totalUnits / last.length;
    return Math.round(v * 10) / 10;
  }

  private calculateTrend(metrics: any[]): number {
    if (metrics.length < 5) return 0;
    const last3 = metrics.slice(-3);
    const prev4 = metrics.slice(-7, -3);

    const last3Avg = last3.reduce((acc: number, m: any) => acc + asNum(m?.views), 0) / 3;
    const prev4Avg = prev4.reduce((acc: number, m: any) => acc + asNum(m?.views), 0) / 4;

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

    if (flags.length === 0) return;

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
    // Placeholder — depends on your raw event tables
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0];
    console.log(`[Restock] Aggregating metrics for ${businessId} on ${dateStr}`);
  }
}

export const restockAnalyzer = new RestockAnalyzerService();
