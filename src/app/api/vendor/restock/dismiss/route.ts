// FILE: src/app/api/vendor/restock/dismiss/route.ts
// POST — Dismiss/resolve a product insight flag (Apex only)

import { requireAnyRole } from "@/lib/auth/server";
import { getBusinessPlanResolved } from "@/lib/vendor/planConfigServer";
import { ProductInsightFlagsRepository } from "@/repositories/product-insight-flags.repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) {
      return Response.json({ ok: false, error: "Missing businessId" }, { status: 400 });
    }

    const plan = await getBusinessPlanResolved(me.businessId);
    if (!plan.features.smartRestock) {
      return Response.json(
        { ok: false, error: "Apex plan required.", code: "APEX_REQUIRED" },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const flagId = String(body.flagId || "").trim();

    if (!flagId) {
      return Response.json({ ok: false, error: "flagId required" }, { status: 400 });
    }

    await ProductInsightFlagsRepository.resolve(flagId);

    return Response.json({ ok: true });
  } catch (e: any) {
    console.error("[POST /api/vendor/restock/dismiss]", e);
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}
