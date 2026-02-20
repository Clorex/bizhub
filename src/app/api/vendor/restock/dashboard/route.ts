// FILE: src/app/api/vendor/restock/dashboard/route.ts
// GET — Smart Restock Dashboard data (Apex only)

import { requireAnyRole } from "@/lib/auth/server";
import { getBusinessPlanResolved } from "@/lib/vendor/planConfigServer";
import { RestockDashboardService } from "@/services/restock/restock-dashboard.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) {
      return Response.json({ ok: false, error: "Missing businessId" }, { status: 400 });
    }

    // Apex-only check
    const plan = await getBusinessPlanResolved(me.businessId);
    if (!plan.features.smartRestock) {
      return Response.json(
        {
          ok: false,
          error: "Smart Restock & Demand Alerts is an Apex-only feature.",
          code: "APEX_REQUIRED",
          upsell: {
            title: "Smart Restock & Demand Alerts",
            description: "Get intelligent stock predictions, demand spike detection, and conversion insights — only on Apex.",
            cta: "Upgrade to Apex",
          },
        },
        { status: 403 }
      );
    }

    const data = await RestockDashboardService.getDashboard(me.businessId);

    return Response.json({
      ok: true,
      data,
      meta: {
        planKey: plan.planKey,
        businessId: me.businessId,
      },
    });
  } catch (e: any) {
    console.error("[GET /api/vendor/restock/dashboard]", e);
    return Response.json(
      { ok: false, error: e?.message || "Failed" },
      { status: 500 }
    );
  }
}
