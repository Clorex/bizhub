
import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { getBusinessPlanResolved } from "@/lib/vendor/planConfigServer";
import { addonsForPlan } from "@/lib/vendor/addons/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AddonCycle = "monthly" | "yearly";

function isSubscriptionActive(biz: any) {
  const exp = Number(biz?.subscription?.expiresAtMs || 0);
  return !!(biz?.subscription?.planKey && exp && exp > Date.now());
}

function cleanPlanKey(v: any) {
  const k = String(v || "FREE").toUpperCase();
  return k === "LAUNCH" || k === "MOMENTUM" || k === "APEX" ? k : "FREE";
}

function computeAddonStatus(ent: any, nowMs = Date.now()) {
  const status = String(ent?.status || "inactive");
  const expiresAtMs = Number(ent?.expiresAtMs || 0);
  const remainingMs = Number(ent?.remainingMs || 0);

  if (status === "active") {
    if (expiresAtMs && expiresAtMs > nowMs) return { status: "active", expiresAtMs };
    return { status: "expired", expiresAtMs: expiresAtMs || 0 };
  }

  if (status === "paused") {
    if (remainingMs > 0) return { status: "paused", expiresAtMs: 0 };
    return { status: "expired", expiresAtMs: 0 };
  }

  return { status: "inactive", expiresAtMs: 0 };
}

export async function GET(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) return Response.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    const plan = await getBusinessPlanResolved(me.businessId);
    const planKey = cleanPlanKey(plan.planKey);
    const biz = plan.business || {};
    const subscriptionActive = isSubscriptionActive(biz);

    const entMap = (biz?.addonEntitlements && typeof biz.addonEntitlements === "object") ? biz.addonEntitlements : {};

    const items = addonsForPlan(planKey as any).map((a) => {
      const ent = entMap[a.sku] || null;
      const st = computeAddonStatus(ent);

      return {
        sku: a.sku,
        kind: a.kind,
        title: a.title,
        description: a.description,
        includesSkus: a.includesSkus || null,
        priceNgn: a.priceNgn,
        status: st.status,
        expiresAtMs: st.expiresAtMs || null,
      };
    });

    return Response.json({
      ok: true,
      planKey,
      subscriptionActive,
      cycleDefault: "yearly" as AddonCycle,
      items,
    });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}