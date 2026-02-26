import { NextResponse } from "next/server";
import { HotDealEngine } from "@/services/hotdeal/hotdeal-engine.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    await HotDealEngine.recalculateAll();

    return NextResponse.json({
      success: true,
      message: "Hot scores recalculated",
    });
  } catch (error) {
    console.error("HotDeal cron error:", error);
    return NextResponse.json(
      { success: false, error: "Hot score recalculation failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    endpoint: "/api/cron/recalculate-hot-scores",
    method: "POST",
    description: "Recalculate product hot scores",
    auth: "Bearer CRON_SECRET required",
  });
}
