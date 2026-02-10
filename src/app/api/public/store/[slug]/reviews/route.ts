// FILE: src/app/api/public/store/[slug]/reviews/route.ts
//
// GET — Public: fetch active reviews + summary for a store.
// No auth required. Only active reviews shown.


import { adminDb } from "@/lib/firebase/admin";
import { computeVendorReviewSummary } from "@/lib/reviews/computeReviewScore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (!slug) {
      return Response.json({ ok: false, error: "Missing slug" }, { status: 400 });
    }

    // Find business by slug
    const bizSnap = await adminDb
      .collection("businesses")
      .where("slug", "==", slug)
      .limit(1)
      .get();

    if (bizSnap.empty) {
      return Response.json({ ok: false, error: "Store not found" }, { status: 404 });
    }

    const bizDoc = bizSnap.docs[0];
    const businessId = bizDoc.id;

    // Fetch active reviews only
    const reviewsSnap = await adminDb
      .collection("reviews")
      .where("businessId", "==", businessId)
      .where("status", "==", "active")
      .orderBy("createdAtMs", "desc")
      .limit(20)
      .get();

    const reviews = reviewsSnap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        buyerName: data.buyerName || "Anonymous",
        rating: Number(data.rating || 0),
        comment: data.comment || null,
        status: "active",
        createdAt: data.createdAt || null,
      };
    });

    // Compute summary from all active reviews (not just page)
    const allActiveSnap = await adminDb
      .collection("reviews")
      .where("businessId", "==", businessId)
      .where("status", "==", "active")
      .get();

    const allActive = allActiveSnap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as any),
    }));

    const fullSummary = computeVendorReviewSummary(allActive);

    const summary = {
      averageRating: fullSummary.averageRating,
      totalReviews: fullSummary.totalReviews,
    };

    return Response.json({ ok: true, reviews, summary });
  } catch (e: any) {
    console.error("[GET /api/public/store/[slug]/reviews]", e);
    return Response.json(
      { ok: false, error: e?.message || "Failed" },
      { status: 500 }
    );
  }
}