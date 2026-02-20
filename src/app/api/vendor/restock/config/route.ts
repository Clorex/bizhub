// FILE: src/app/api/vendor/restock/config/route.ts
// GET + PUT — Restock alert configuration (Apex only)

import { requireRole } from "@/lib/auth/server";
import { getBusinessPlanResolved } from "@/lib/vendor/planConfigServer";
import { RestockAlertConfigRepository } from "@/repositories/restock-alert-config.repository";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const me = await requireRole(req, "owner");
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

    const config = await RestockAlertConfigRepository.getByBusiness(me.businessId);
    return Response.json({ ok: true, config });
  } catch (e: any) {
    console.error("[GET /api/vendor/restock/config]", e);
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const me = await requireRole(req, "owner");
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

    // Validate and sanitize
    const updates: any = {};

    if (typeof body.enabled === "boolean") updates.enabled = body.enabled;
    if (typeof body.email_alerts_enabled === "boolean") updates.email_alerts_enabled = body.email_alerts_enabled;

    if (typeof body.growth_threshold_pct === "number") {
      updates.growth_threshold_pct = Math.max(10, Math.min(300, Math.floor(body.growth_threshold_pct)));
    }
    if (typeof body.spike_threshold_pct === "number") {
      updates.spike_threshold_pct = Math.max(50, Math.min(500, Math.floor(body.spike_threshold_pct)));
    }
    if (typeof body.stockout_warn_days === "number") {
      updates.stockout_warn_days = Math.max(1, Math.min(30, Math.floor(body.stockout_warn_days)));
    }
    if (typeof body.stockout_urgent_days === "number") {
      updates.stockout_urgent_days = Math.max(1, Math.min(14, Math.floor(body.stockout_urgent_days)));
    }
    if (typeof body.alert_cooldown_hours === "number") {
      updates.alert_cooldown_hours = Math.max(6, Math.min(168, Math.floor(body.alert_cooldown_hours)));
    }

    await RestockAlertConfigRepository.upsert(me.businessId, updates);

    const config = await RestockAlertConfigRepository.getByBusiness(me.businessId);
    return Response.json({ ok: true, config });
  } catch (e: any) {
    console.error("[PUT /api/vendor/restock/config]", e);
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}
