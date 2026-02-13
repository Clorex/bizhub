// FILE: src/app/api/public/store/[slug]/trust/route.ts
//
// GET — Public: fetch trust + entitlements for a store.
// Returns verification tier, review summary, and plan/entitlement signals.
// No internal formulas or scores exposed.

import { adminDb } from "@/lib/firebase/admin";
import { ratingToLabel } from "@/lib/reviews/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function tierLabel(tier: number): string {
  switch (tier) {
    case 3:
      return "Trusted Vendor";
    case 2:
      return "Verified Information Submitted";
    case 1:
      return "Basic Verified";
    default:
      return "Unverified";
  }
}

function tierColor(tier: number): { bg: string; text: string; border: string } {
  switch (tier) {
    case 3:
      return { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" };
    case 2:
      return { bg: "bg-blue-50", text: "text-blue-700", border: "border-blue-200" };
    case 1:
      return { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200" };
    default:
      return { bg: "bg-gray-50", text: "text-gray-500", border: "border-gray-200" };
  }
}

function resolvePlanKey(biz: any): string {
  const candidates = [
    biz?.activePlanKey,
    biz?.planKey,
    biz?.subscriptionPlanKey,
    biz?.subscription?.planKey,
    biz?.billing?.planKey,
    biz?.entitlements?.planKey,
  ]
    .map((x) => String(x || "").trim())
    .filter(Boolean);

  return (candidates[0] || "").toUpperCase();
}

function isApexActive(biz: any, planKey: string): boolean {
  // Be defensive: different deployments store this differently
  const flags = [
    biz?.apexActive,
    biz?.apexPlanActive,
    biz?.entitlements?.apexActive,
    biz?.entitlements?.apex,
    biz?.features?.apex,
    biz?.apexBadgeActive, // some projects use this as an entitlement toggle
  ].some((v) => v === true);

  return flags || planKey === "APEX";
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug) {
      return Response.json({ ok: false, error: "Missing slug" }, { status: 400 });
    }

    const bizSnap = await adminDb
      .collection("businesses")
      .where("slug", "==", slug)
      .limit(1)
      .get();

    if (bizSnap.empty) {
      return Response.json({ ok: false, error: "Store not found" }, { status: 404 });
    }

    const biz = bizSnap.docs[0].data() as any;

    const tier = Number(biz?.verificationTier || 0);
    const reviewSummary = biz?.reviewSummary || null;

    const avgRating = Number(reviewSummary?.averageRating || 0);
    const totalReviews = Number(reviewSummary?.totalReviews || 0);

    const planKey = resolvePlanKey(biz);
    const apexActive = isApexActive(biz, planKey);

    return Response.json({
      ok: true,

      // New: entitlements/plan info (used for Apex plan badge)
      plan: {
        key: planKey || null,
        apexActive,
        label: apexActive ? "Apex" : planKey || "Standard",
      },
      entitlements: {
        apexActive,
      },

      // Existing trust payload (kept)
      trust: {
        verificationTier: tier,
        verificationLabel: tierLabel(tier),
        verificationColor: tierColor(tier),

        averageRating: avgRating,
        totalReviews,
        ratingLabel: avgRating > 0 ? ratingToLabel(avgRating) : "No ratings yet",

        signals: [
          tier >= 1 && "Identity presence confirmed",
          tier >= 2 && "Government ID information submitted",
          tier >= 3 && "Address documentation provided",
          totalReviews >= 5 && `${totalReviews} verified buyer reviews`,
          avgRating >= 4.0 && `${avgRating.toFixed(1)}★ average rating`,
        ].filter(Boolean),
      },
    });
  } catch (e: any) {
    console.error("[GET /api/public/store/[slug]/trust]", e);
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}