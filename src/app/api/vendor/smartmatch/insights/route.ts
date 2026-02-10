// FILE: src/app/api/vendor/smartmatch/insights/route.ts


import { requireAnyRole } from "@/lib/auth/server";
import { isSmartMatchEnabledServer } from "@/lib/smartmatch/featureFlag";
import {
  getCachedVendorProfile,
  computeAndStoreVendorProfile,
} from "@/lib/smartmatch/profileServer";
import { buildVendorInsights } from "@/lib/smartmatch/insights";
import { computeMatchScore } from "@/lib/smartmatch/score";
import { getSmartMatchConfig } from "@/lib/smartmatch/configServer";
import type { BuyerIntentProfile } from "@/lib/smartmatch/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/vendor/smartmatch/insights
 *
 * Returns the vendor's SmartMatch visibility insights:
 * - Their reliability profile
 * - Factor-by-factor breakdown with status + tips
 * - A simulated "average match score" (what a typical buyer would see)
 */
export async function GET(req: Request) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) {
      return Response.json(
        { ok: false, error: "Missing businessId" },
        { status: 400 }
      );
    }

    if (!isSmartMatchEnabledServer()) {
      return Response.json({
        ok: true,
        enabled: false,
        message: "SmartMatch is not enabled on this platform.",
      });
    }

    const config = await getSmartMatchConfig();
    if (!config.enabled) {
      return Response.json({
        ok: true,
        enabled: false,
        message: "SmartMatch is currently disabled by admin.",
      });
    }

    // Try cached profile first, compute if missing/expired
    let profile = await getCachedVendorProfile(me.businessId);

    if (!profile) {
      try {
        profile = await computeAndStoreVendorProfile(me.businessId);
      } catch (e: any) {
        return Response.json(
          {
            ok: false,
            error: `Could not compute your profile: ${e?.message || "Unknown error"}`,
          },
          { status: 500 }
        );
      }
    }

    // Build insights
    const insights = buildVendorInsights(profile);

    // Simulate a "typical buyer" match score
    // This gives vendors a rough idea of how they'd score
    const typicalBuyer: BuyerIntentProfile = {
      state: profile.state || null,
      city: profile.city || null,
      category: null,
      priceMin: null,
      priceMax: null,
      preferredPaymentType: "card",
      prefersPickup: false,
      prefersDelivery: true,
      vendorHistory: {},
      pastCategories: [],
    };

    const sameLocationScore = computeMatchScore({
      buyer: typicalBuyer,
      vendor: profile,
      weights: config.weights,
    });

    // Also compute for a buyer in a different location
    const differentLocationBuyer: BuyerIntentProfile = {
      ...typicalBuyer,
      state: "different_state",
      city: "different_city",
    };

    const differentLocationScore = computeMatchScore({
      buyer: differentLocationBuyer,
      vendor: profile,
      weights: config.weights,
    });

    // Factor statuses summary
    const goodCount = insights.filter((i) => i.status === "good").length;
    const improveCount = insights.filter((i) => i.status === "improve").length;
    const badCount = insights.filter((i) => i.status === "bad").length;

    return Response.json({
      ok: true,
      enabled: true,
      profile: {
        fulfillmentRate: profile.fulfillmentRate,
        avgDeliveryHours: profile.avgDeliveryHours,
        disputeRate: profile.disputeRate,
        totalCompletedOrders: profile.totalCompletedOrders,
        verificationTier: profile.verificationTier,
        apexBadgeActive: profile.apexBadgeActive,
        stockAccuracyRate: profile.stockAccuracyRate,
        computedAtMs: profile.computedAtMs,
      },
      insights,
      simulatedScores: {
        sameLocation: {
          total: sameLocationScore.total,
          breakdown: sameLocationScore,
        },
        differentLocation: {
          total: differentLocationScore.total,
          breakdown: differentLocationScore,
        },
      },
      summary: {
        good: goodCount,
        improve: improveCount,
        bad: badCount,
        overallHealth:
          badCount === 0 && improveCount <= 1
            ? "strong"
            : badCount === 0
              ? "moderate"
              : "needs_work",
      },
    });
  } catch (e: any) {
    console.error("[GET /api/vendor/smartmatch/insights]", e?.message);
    return Response.json(
      { ok: false, error: e?.message || "Failed" },
      { status: 500 }
    );
  }
}