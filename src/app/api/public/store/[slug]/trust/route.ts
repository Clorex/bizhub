import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getPlanConfig, fallbackPlanConfig } from "@/lib/vendor/planConfigServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanSlug(v: any) {
  return String(v || "").trim().toLowerCase().slice(0, 80);
}

function hasActiveSubscription(biz: any) {
  const exp = Number(biz?.subscription?.expiresAtMs || 0);
  return !!(biz?.subscription?.planKey && exp && exp > Date.now());
}

/**
 * Public pages don't necessarily call /api/vendor/access (which does pause/resume sync).
 * So here we treat:
 * - active + expiresAtMs>now => active
 * - paused + remainingMs>0 => active *only if subscriptionActive* (effective resume)
 */
function addonIsActiveEffective(ent: any, nowMs: number, subscriptionActive: boolean) {
  if (!ent || typeof ent !== "object") return false;

  const status = String(ent.status || "");
  const expiresAtMs = Number(ent.expiresAtMs || 0) || 0;
  const remainingMs = Number(ent.remainingMs || 0) || 0;

  if (status === "active") return !!(expiresAtMs && expiresAtMs > nowMs);
  if (status === "paused") return subscriptionActive && remainingMs > 0;

  return false;
}

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const s = cleanSlug(slug);
    if (!s) return NextResponse.json({ ok: false, error: "Missing slug" }, { status: 400 });

    const snap = await adminDb.collection("businesses").where("slug", "==", s).limit(1).get();
    if (snap.empty) return NextResponse.json({ ok: false, error: "Store not found" }, { status: 404 });

    const bizDoc = snap.docs[0];
    const biz = { id: bizDoc.id, ...(bizDoc.data() as any) };

    const planKey = String(biz?.subscription?.planKey || "FREE").toUpperCase();
    const subscriptionActive = hasActiveSubscription(biz);
    const nowMs = Date.now();

    const cfg = await getPlanConfig().catch(() => fallbackPlanConfig());
    const plan = (cfg as any)?.plans?.[planKey] || (fallbackPlanConfig() as any).plans.FREE;

    const apexVerifiedFeatureOn = !!plan?.features?.apexVerifiedBadge;

    const badgeEarned = biz?.apexTrust?.badgeActive === true;
    const riskScore = Number(biz?.apexTrust?.riskScore || 0) || 0;

    // Earned/maintained Apex badge (APEX only)
    const apexBadgeActive = planKey === "APEX" && subscriptionActive && apexVerifiedFeatureOn && badgeEarned;

    // ✅ Temporary Apex badge (Momentum add-on)
    const entMap =
      biz?.addonEntitlements && typeof biz.addonEntitlements === "object" ? biz.addonEntitlements : {};
    const tempEnt = entMap["addon_probation_apex_badge"];

    const temporaryApexBadgeActive =
      planKey === "MOMENTUM" && addonIsActiveEffective(tempEnt, nowMs, subscriptionActive);

    const badge =
      apexBadgeActive
        ? { active: true, type: "earned_apex" as const }
        : temporaryApexBadgeActive
        ? { active: true, type: "temporary_apex" as const }
        : { active: false, type: null as any };

    return NextResponse.json({
      ok: true,
      businessId: biz.id,
      slug: s,
      planKey,
      hasActiveSubscription: subscriptionActive,

      apexBadgeActive,
      temporaryApexBadgeActive,
      badge,

      riskScore,
      reason: String(biz?.apexTrust?.reason || ""),
      updatedAtMs: Number(biz?.apexTrust?.updatedAtMs || 0) || 0,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}