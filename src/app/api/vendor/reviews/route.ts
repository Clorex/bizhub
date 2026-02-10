// FILE: src/app/api/vendor/reviews/route.ts
//
// GET — Vendor fetches their reviews + summary for the dashboard.


import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { computeVendorReviewSummary } from "@/lib/reviews/computeReviewScore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) {
      return Response.json({ ok: false, error: "Missing businessId" }, { status: 400 });
    }

    // Fetch reviews for this business
    const reviewsSnap = await adminDb
      .collection("reviews")
      .where("businessId", "==", me.businessId)
      .orderBy("createdAtMs", "desc")
      .limit(100)
      .get();

    const reviews = reviewsSnap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        orderId: data.orderId || null,
        buyerName: data.buyerName || "Anonymous",
        rating: Number(data.rating || 0),
        comment: data.status === "under_review" ? null : (data.comment || null),
        status: data.status || "active",
        createdAt: data.createdAt || null,
        createdAtMs: data.createdAtMs || 0,
      };
    });

    // Compute summary
    const allReviewsForSummary = reviewsSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));

    const summary = computeVendorReviewSummary(allReviewsForSummary);

    // Fetch appeal count
    const appealsSnap = await adminDb
      .collection("reviewAppeals")
      .where("businessId", "==", me.businessId)
      .where("status", "==", "pending")
      .limit(100)
      .get();

    summary.appealCount = appealsSnap.size;

    return Response.json({ ok: true, reviews, summary });
  } catch (e: any) {
    console.error("[GET /api/vendor/reviews]", e);
    return Response.json(
      { ok: false, error: e?.message || "Failed to load reviews" },
      { status: 500 }
    );
  }
}