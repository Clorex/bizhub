// FILE: src/app/api/vendor/intent-radar/product/route.ts
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
        { ok: false, error: "Apex plan required.", code: "APEX_REQUIRED" },
        { status: 403 }
      );
    }

    const url = new URL(req.url);
    const productId = url.searchParams.get("productId");
    if (!productId) {
      return Response.json({ ok: false, error: "productId required" }, { status: 400 });
    }

    const data = await IntentDashboardService.getProductDetail(productId, me.businessId);
    if (!data) {
      return Response.json({ ok: false, error: "Product not found" }, { status: 404 });
    }

    return Response.json({ ok: true, data });
  } catch (e: any) {
    console.error("[GET /api/vendor/intent-radar/product]", e);
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}
