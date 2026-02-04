import { NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/server";
import { getBusinessPlanResolved } from "@/lib/vendor/planConfigServer";
import { addonsForPlan } from "@/lib/vendor/addons/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AddonCycle = "monthly" | "yearly";

function cleanPlanKey(v: any) {
  const k = String(v || "FREE").toUpperCase();
  return k === "LAUNCH" || k === "MOMENTUM" || k === "APEX" ? k : "FREE";
}

// Prefer last subscribed plan for catalog display even if subscription is currently inactive
function planKeyForCatalog(resolved: any) {
  const biz = resolved?.business || {};
  const subKey = cleanPlanKey(biz?.subscription?.planKey);
  const resolvedKey = cleanPlanKey(resolved?.planKey);
  return subKey !== "FREE" ? subKey : resolvedKey;
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

  if (status === "expired") return { status: "expired", expiresAtMs: expiresAtMs || 0 };

  return { status: "inactive", expiresAtMs: 0 };
}

export async function GET(req: Request) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    const resolved = await getBusinessPlanResolved(me.businessId);

    const catalogPlanKey = planKeyForCatalog(resolved);
    const subscriptionActive = !!resolved?.hasActiveSubscription;

    const biz = resolved?.business || {};
    const entMap =
      biz?.addonEntitlements && typeof biz.addonEntitlements === "object" ? biz.addonEntitlements : {};

    const items = addonsForPlan(catalogPlanKey as any).map((a) => {
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

    return NextResponse.json({
      ok: true,
      planKey: catalogPlanKey,
      subscriptionActive,
      cycleDefault: "yearly" as AddonCycle,
      items,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}