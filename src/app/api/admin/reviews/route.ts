// FILE: src/app/api/admin/reviews/route.ts


import { adminAuth, adminDb } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

/**
 * GET /api/admin/reviews
 * Admin fetches all reviews & pending appeals.
 */
export async function GET(req: Request) {
  try {
    // ── Admin auth ──
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    // Verify admin role
    const userDoc = await adminDb.collection("users").doc(uid).get();
    const userData = userDoc.data() as any;

    if (userData?.role !== "admin") {
      return Response.json({ error: "Admin access required" }, { status: 403 });
    }

    const url = new URL(req.url);
    const view = url.searchParams.get("view") || "appeals"; // "appeals" | "all" | "flagged"
    const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);

    if (view === "appeals") {
      // Fetch pending appeals
      const appealsSnap = await adminDb
        .collection("reviewAppeals")
        .where("status", "==", "pending")
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();

      const appeals = appealsSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }));

      // Fetch associated reviews
      const reviewIds = [
        ...new Set(appeals.map((a: any) => a.reviewId).filter(Boolean)),
      ];

      const reviewsMap: Record<string, any> = {};
      for (const rid of reviewIds) {
        const rSnap = await adminDb.collection("reviews").doc(rid as string).get();
        if (rSnap.exists) {
          reviewsMap[rid as string] = { id: rSnap.id, ...rSnap.data() };
        }
      }

      return Response.json({ ok: true, appeals, reviewsMap });
    }

    if (view === "flagged") {
      // Reviews currently under_review
      const snap = await adminDb
        .collection("reviews")
        .where("status", "==", "under_review")
        .orderBy("createdAt", "desc")
        .limit(limit)
        .get();

      const reviews = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      return Response.json({ ok: true, reviews });
    }

    // "all" — recent reviews
    const snap = await adminDb
      .collection("reviews")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    const reviews = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return Response.json({ ok: true, reviews });
  } catch (error: any) {
    console.error("[GET /api/admin/reviews]", error);
    return Response.json(
      { error: error.message || "Failed to fetch reviews" },
      { status: 500 }
    );
  }
}