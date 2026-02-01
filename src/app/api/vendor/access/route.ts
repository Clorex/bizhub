// FILE: src/app/api/vendor/access/route.ts
import { NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { computeVendorAccessState } from "@/lib/vendor/access";
import { getBusinessPlanResolved } from "@/lib/vendor/planConfigServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    const snap = await adminDb.collection("businesses").doc(me.businessId).get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: "Business not found" }, { status: 404 });

    const biz = { id: snap.id, ...(snap.data() as any) };

    const state = computeVendorAccessState(biz);
    const plan = await getBusinessPlanResolved(me.businessId);

    return NextResponse.json({
      ok: true,

      // Batch 8: never lock
      locked: false,
      reason: state.reason,

      // keep old fields for compatibility
      freeEndsAtMs: null,
      trialEndsAtMs: state.trialEndsAtMs,
      subscriptionExpiresAtMs: state.subscriptionExpiresAtMs,
      hasActiveSubscription: plan.hasActiveSubscription,
      trialActive: state.trialActive,

      planKey: plan.planKey,
      features: plan.features,
      limits: plan.limits,

      business: {
        id: biz.id,
        slug: biz.slug ?? null,
        name: biz.name ?? null,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}