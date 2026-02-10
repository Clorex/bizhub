// FILE: src/app/api/vendor/insights/route.ts
//
// GET — Private vendor performance insights.
// Shows coaching-style tips, anonymous comparisons, factor status.
// Never exposes exact formulas, competitor names, or admin notes.


import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { ratingToLabel } from "@/lib/reviews/config";
import type { FactorStatus, VendorMatchInsight } from "@/lib/smartmatch/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function status(good: boolean, bad: boolean): FactorStatus {
  if (good) return "good";
  if (bad) return "bad";
  return "improve";
}

export async function GET(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) {
      return Response.json({ ok: false, error: "Missing businessId" }, { status: 400 });
    }

    const bizSnap = await adminDb.collection("businesses").doc(me.businessId).get();
    if (!bizSnap.exists) {
      return Response.json({ ok: false, error: "Business not found" }, { status: 404 });
    }

    const biz = bizSnap.data() as any;
    const tier = Number(biz?.verificationTier || 0);
    const reviewSummary = biz?.reviewSummary || {};
    const avgRating = Number(reviewSummary?.averageRating || 0);
    const totalReviews = Number(reviewSummary?.totalReviews || 0);
    const recentTrend = reviewSummary?.recentTrend || "stable";

    // ── Count products ──
    const productsSnap = await adminDb
      .collection("products")
      .where("businessId", "==", me.businessId)
      .limit(500)
      .get();
    const productCount = productsSnap.size;
    const productsWithImages = productsSnap.docs.filter(
      (d) => {
        const data = d.data() as any;
        return Array.isArray(data.images) && data.images.length > 0;
      }
    ).length;
    const imageCompleteness = productCount > 0 ? Math.round((productsWithImages / productCount) * 100) : 0;

    // ── Count completed orders ──
    const ordersSnap = await adminDb
      .collection("orders")
      .where("businessId", "==", me.businessId)
      .limit(500)
      .get();
    const totalOrders = ordersSnap.size;
    const completedOrders = ordersSnap.docs.filter((d) => {
      const data = d.data() as any;
      const ops = String(data.opsStatus || "").toLowerCase();
      return ops === "delivered";
    }).length;
    const fulfillmentRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;

    // ── Build insights ──
    const insights: VendorMatchInsight[] = [];

    // Verification
    insights.push({
      factor: "verification",
      label: "Verification Level",
      status: status(tier >= 2, tier === 0),
      value: `Tier ${tier}`,
      tip: tier === 0
        ? "Complete basic verification to unlock marketplace visibility."
        : tier === 1
          ? "Submit your ID to reach Tier 2 — verified vendors get more engagement."
          : tier === 2
            ? "Add proof of address for Trusted Vendor status and priority exposure."
            : "You have the highest verification level. Great job!",
    });

    // Reviews
    insights.push({
      factor: "reviews",
      label: "Customer Reviews",
      status: status(avgRating >= 4.0 && totalReviews >= 5, avgRating > 0 && avgRating < 3.0),
      value: totalReviews > 0 ? `${avgRating.toFixed(1)}★ (${totalReviews})` : "No reviews yet",
      tip: totalReviews === 0
        ? "Completed orders will give buyers the chance to rate your service."
        : avgRating >= 4.0
          ? "Your ratings are strong. Keep delivering quality to maintain this."
          : "Focus on delivery speed and communication to improve your ratings.",
    });

    // Review trend
    if (totalReviews >= 5) {
      insights.push({
        factor: "review_trend",
        label: "Rating Trend",
        status: status(recentTrend === "improving", recentTrend === "declining"),
        value: recentTrend === "improving" ? "Improving" : recentTrend === "declining" ? "Declining" : "Stable",
        tip: recentTrend === "declining"
          ? "Recent reviews are lower than before. Focus on order quality and responsiveness."
          : recentTrend === "improving"
            ? "Your recent reviews are trending up. Keep it up!"
            : "Your review ratings are holding steady.",
      });
    }

    // Fulfillment
    insights.push({
      factor: "fulfillment",
      label: "Order Fulfillment",
      status: status(fulfillmentRate >= 90, fulfillmentRate < 70 && totalOrders >= 5),
      value: totalOrders > 0 ? `${fulfillmentRate}%` : "No orders yet",
      tip: totalOrders === 0
        ? "Your fulfillment rate will appear once you complete orders."
        : fulfillmentRate >= 90
          ? "Excellent fulfillment rate! This significantly helps your visibility."
          : "Improving your delivery consistency will increase buyer confidence.",
    });

    // Product completeness
    insights.push({
      factor: "product_completeness",
      label: "Product Quality",
      status: status(imageCompleteness >= 80 && productCount >= 3, imageCompleteness < 50),
      value: productCount > 0 ? `${imageCompleteness}% with images` : "No products",
      tip: productCount === 0
        ? "Add products to your store to start appearing in the marketplace."
        : imageCompleteness < 80
          ? "Products with clear images get significantly more buyer interest."
          : "Your products are well-presented. Consider adding descriptions too.",
    });

    // ── Anonymous comparison (aggregate, no names) ──
    // Compute simple platform averages for context
    let comparison: { metric: string; yours: string; average: string }[] = [];

    try {
      // Get a sample of other businesses for anonymous comparison
      const sampleSnap = await adminDb
        .collection("businesses")
        .where("verificationTier", ">=", 1)
        .limit(50)
        .get();

      if (sampleSnap.size >= 5) {
        const otherRatings = sampleSnap.docs
          .map((d) => Number((d.data() as any)?.reviewSummary?.averageRating || 0))
          .filter((r) => r > 0);

        if (otherRatings.length >= 3) {
          const avgOtherRating = otherRatings.reduce((a, b) => a + b, 0) / otherRatings.length;
          comparison.push({
            metric: "Average Rating",
            yours: avgRating > 0 ? avgRating.toFixed(1) : "—",
            average: avgOtherRating.toFixed(1),
          });
        }

        const otherTiers = sampleSnap.docs.map((d) => Number((d.data() as any)?.verificationTier || 0));
        const avgTier = otherTiers.reduce((a, b) => a + b, 0) / otherTiers.length;
        comparison.push({
          metric: "Verification Level",
          yours: `Tier ${tier}`,
          average: `Tier ${avgTier.toFixed(1)}`,
        });
      }
    } catch {
      // Non-fatal — comparison is supplementary
    }

    return Response.json({
      ok: true,
      insights,
      comparison,
      summary: {
        verificationTier: tier,
        averageRating: avgRating,
        totalReviews,
        fulfillmentRate,
        productCount,
        imageCompleteness,
      },
    });
  } catch (e: any) {
    console.error("[GET /api/vendor/insights]", e);
    return Response.json(
      { ok: false, error: e?.message || "Failed" },
      { status: 500 }
    );
  }
}