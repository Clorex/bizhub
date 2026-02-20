// FILE: src/app/api/cron/restock-alerts/route.ts
// POST — Daily cron: aggregate product metrics + generate restock alerts
// Should run AFTER aggregate-daily-stats (needs order data)
// Protected by CRON_SECRET

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ProductMetricsAggregatorService } from "@/services/restock/product-metrics-aggregator.service";
import { RestockEngineService } from "@/services/restock/restock-engine.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120; // Allow up to 2 minutes

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized. Invalid CRON_SECRET." },
        { status: 401 }
      );
    }

    const url = new URL(request.url);
    const dateParam = url.searchParams.get("date");

    // Determine which date to process
    let targetDate: Date;
    if (dateParam) {
      targetDate = new Date(dateParam);
      if (isNaN(targetDate.getTime())) {
        return NextResponse.json(
          { ok: false, error: "Invalid date format. Use YYYY-MM-DD." },
          { status: 400 }
        );
      }
    } else {
      // Default: yesterday
      targetDate = new Date();
      targetDate.setDate(targetDate.getDate() - 1);
    }
    targetDate.setHours(0, 0, 0, 0);

    const dateStr = targetDate.toISOString().split("T")[0];
    console.log(`[Restock Cron] Processing date: ${dateStr}`);

    // Step 1: Aggregate product-level metrics
    console.log("[Restock Cron] Step 1: Aggregating product metrics...");
    const aggResult = await ProductMetricsAggregatorService.aggregateAllApex(targetDate);
    console.log(
      `[Restock Cron] Aggregated: ${aggResult.businessesProcessed} businesses, ${aggResult.productsProcessed} products`
    );

    // Step 2: Run restock engine (compute alerts)
    console.log("[Restock Cron] Step 2: Computing restock alerts...");
    const engineResult = await RestockEngineService.processAllApexBusinesses();
    console.log(
      `[Restock Cron] Engine: ${engineResult.businessesProcessed} businesses, ${engineResult.flagsCreated} flags created`
    );

    const allErrors = [...aggResult.errors, ...engineResult.errors];

    return NextResponse.json({
      ok: true,
      data: {
        date: dateStr,
        aggregation: {
          businesses_processed: aggResult.businessesProcessed,
          products_processed: aggResult.productsProcessed,
          errors: aggResult.errors.length,
        },
        alerts: {
          businesses_processed: engineResult.businessesProcessed,
          flags_created: engineResult.flagsCreated,
          errors: engineResult.errors.length,
        },
        total_errors: allErrors.length,
        errors: allErrors.slice(0, 20), // Cap error output
      },
    });
  } catch (error: any) {
    console.error("[Restock Cron] Fatal error:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Restock cron failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/cron/restock-alerts",
    method: "POST",
    description: "Daily cron: aggregate product metrics + generate restock/demand alerts for Apex vendors",
    params: {
      default: "Processes yesterday for all Apex businesses",
      date: "?date=YYYY-MM-DD - Process specific date",
    },
    auth: "Bearer CRON_SECRET header required",
    schedule: "Run AFTER /api/cron/aggregate-daily-stats",
  });
}
