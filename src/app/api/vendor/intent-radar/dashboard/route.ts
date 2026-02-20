// FILE: src/app/api/vendor/intent-radar/dashboard/route.ts
import { requireAnyRole } from "@/lib/auth/server";
import { getBusinessPlanResolved } from "@/lib/vendor/planConfigServer";
import { IntentDashboardService } from "@/services/intent-radar/intent-dashboard.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) {
      return Response.json({ ok: false, error: "Missing businessId" }, { status: 400 });
    }

    const plan = await getBusinessPlanResolved(me.businessId);
    if (!plan.features.buyerIntentRadar) {
      return Response.json(
        {
          ok: false,
          error: "Buyer Intent Radar is an Apex-only feature.",
          code: "APEX_REQUIRED",
          upsell: {
            title: "Buyer Intent Radar (Hot Deals)",
            description: "Detect when buyers are seriously interested in your products. Get early signals and act fast to close sales.",
            cta: "Upgrade to Apex",
          },
        },
        { status: 403 }
      );
    }

    const data = await IntentDashboardService.getDashboard(me.businessId);
    return Response.json({ ok: true, data });
  } catch (e: any) {
    console.error("[GET /api/vendor/intent-radar/dashboard]", e);
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}
