// FILE: src/app/api/cron/intent-radar/route.ts
// POST — Cron: compute buyer intent scores and hot deal flags
// Run every 4-6 hours. Protected by CRON_SECRET.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { IntentEngineService } from "@/services/intent-radar/intent-engine.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized." },
        { status: 401 }
      );
    }

    console.log("[Intent Radar Cron] Starting...");

    const result = await IntentEngineService.processAllApexBusinesses();

    console.log(
      `[Intent Radar Cron] Done: ${result.businessesProcessed} businesses, ${result.flagsCreated} flags`
    );

    return NextResponse.json({
      ok: true,
      data: {
        businesses_processed: result.businessesProcessed,
        flags_created: result.flagsCreated,
        errors_count: result.errors.length,
        errors: result.errors.slice(0, 20),
      },
    });
  } catch (error: any) {
    console.error("[Intent Radar Cron] Fatal:", error);
    return NextResponse.json(
      { ok: false, error: error?.message || "Failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/cron/intent-radar",
    method: "POST",
    description: "Compute buyer intent scores and hot deal flags for Apex vendors",
    auth: "Bearer CRON_SECRET",
    schedule: "Every 4-6 hours",
  });
}
