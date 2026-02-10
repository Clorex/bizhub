// FILE: src/app/api/public/store/[slug]/payment-options/route.ts

import { adminDb } from "@/lib/firebase/admin";
import { getBusinessPlanResolved } from "@/lib/vendor/planConfigServer";
import { paymentsProvider } from "@/lib/payments/provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanSlug(v: any) {
  return String(v || "").trim().toLowerCase().slice(0, 80);
}

function fxNgnPerUsd() {
  const v = process.env.FX_NGN_PER_USD || process.env.NGN_PER_USD || process.env.USD_NGN_RATE || "";
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await ctx.params;
    const s = cleanSlug(slug);
    if (!s) return Response.json({ ok: false, error: "Missing slug" }, { status: 400 });

    const snap = await adminDb.collection("businesses").where("slug", "==", s).limit(1).get();
    if (snap.empty) return Response.json({ ok: false, error: "Store not found" }, { status: 404 });

    const bizDoc = snap.docs[0];
    const businessId = bizDoc.id;

    const resolved = await getBusinessPlanResolved(businessId);

    const provider = paymentsProvider();
    const fxOk = fxNgnPerUsd() > 0;

    const planKey = String(resolved.planKey || "FREE").toUpperCase();
    const hasSub = !!resolved.hasActiveSubscription;
    const usdFeature = !!(resolved.features as any)?.usdCheckout;

    const usdEligible =
      provider === "flutterwave" &&
      fxOk &&
      hasSub &&
      (planKey === "MOMENTUM" || planKey === "APEX") &&
      usdFeature;

    return Response.json({
      ok: true,
      slug: s,
      businessId,
      usdEligible,
      debug: {
        provider,
        fxOk,
        planKey,
        hasActiveSubscription: hasSub,
        usdFeature,
      },
    });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}