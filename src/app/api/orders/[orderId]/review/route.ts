// FILE: src/app/api/orders/[orderId]/review/route.ts


import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  MAX_COMMENT_LENGTH,
  MIN_COMMENT_LENGTH,
  REVIEW_ELIGIBLE_OPS_STATUS,
  REVIEW_ELIGIBLE_ESCROW_STATUS,
  REVIEW_WINDOW_DAYS,
} from "@/lib/reviews/config";
import { computeVendorReviewSummary } from "@/lib/reviews/computeReviewScore";

export const dynamic = "force-dynamic";

function toMs(v: any): number {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "object") {
    if (typeof v.toMillis === "function") return Number(v.toMillis()) || 0;
    if (typeof v.seconds === "number") return Math.floor(v.seconds * 1000);
  }
  return 0;
}

function lowerEmail(v: any): string {
  return String(v || "").trim().toLowerCase();
}

/**
 * POST /api/orders/[orderId]/review
 * Buyer submits a review for a completed order.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ orderId: string }> }
) {
  try {
    // ── Auth ──
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const { orderId } = await ctx.params;
    if (!orderId) {
      return Response.json({ error: "Order ID required" }, { status: 400 });
    }

    // ── Parse body ──
    const body = await req.json().catch(() => ({}));
    const { rating, comment } = body;

    // ── Validate rating ──
    const ratingNum = Number(rating);
    if (!Number.isInteger(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return Response.json(
        { error: "Rating must be a whole number between 1 and 5" },
        { status: 400 }
      );
    }

    // ── Validate comment (optional) ──
    let cleanComment: string | null = null;
    if (comment !== undefined && comment !== null && comment !== "") {
      const trimmed = String(comment).trim();
      if (trimmed.length < MIN_COMMENT_LENGTH) {
        return Response.json(
          { error: `Comment must be at least ${MIN_COMMENT_LENGTH} characters` },
          { status: 400 }
        );
      }
      if (trimmed.length > MAX_COMMENT_LENGTH) {
        return Response.json(
          { error: `Comment must be under ${MAX_COMMENT_LENGTH} characters` },
          { status: 400 }
        );
      }
      cleanComment = trimmed;
    }

    // ── Fetch order ──
    const orderRef = adminDb.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return Response.json({ error: "Order not found" }, { status: 404 });
    }

    const order = orderSnap.data() as any;

    // ── Verify buyer owns this order ──
    const userDoc = await adminDb.collection("users").doc(uid).get();
    const userData = userDoc.data() as any;
    const buyerEmail = lowerEmail(userData?.email || decoded.email);
    const orderEmail = lowerEmail(order?.customer?.email);

    if (!buyerEmail || !orderEmail || buyerEmail !== orderEmail) {
      return Response.json(
        { error: "You can only review your own orders" },
        { status: 403 }
      );
    }

    // ── Check order is completed ──
    const opsStatus = String(order?.opsStatus || "").toLowerCase();
    const escrowStatus = String(order?.escrowStatus || "").toLowerCase();

    const isCompleted =
      opsStatus === REVIEW_ELIGIBLE_OPS_STATUS ||
      escrowStatus === REVIEW_ELIGIBLE_ESCROW_STATUS;

    if (!isCompleted) {
      return Response.json(
        { error: "You can only review completed orders" },
        { status: 400 }
      );
    }

    // ── Check review window ──
    const orderUpdatedMs = toMs(order?.updatedAt) || toMs(order?.createdAt);
    if (orderUpdatedMs > 0) {
      const daysSince = (Date.now() - orderUpdatedMs) / (1000 * 60 * 60 * 24);
      if (daysSince > REVIEW_WINDOW_DAYS) {
        return Response.json(
          { error: `Review window has expired (${REVIEW_WINDOW_DAYS} days)` },
          { status: 400 }
        );
      }
    }

    // ── Check not already reviewed ──
    const existingReview = await adminDb
      .collection("reviews")
      .where("orderId", "==", orderId)
      .where("buyerId", "==", uid)
      .limit(1)
      .get();

    if (!existingReview.empty) {
      return Response.json(
        { error: "You have already reviewed this order" },
        { status: 409 }
      );
    }

    // ── Check buyer is not suspended ──
    const buyerReviewProfile = userData?.reviewProfile;
    if (buyerReviewProfile?.reviewSuspended) {
      return Response.json(
        { error: "Your review privilege has been suspended" },
        { status: 403 }
      );
    }

    // ── Create review ──
    const businessId = String(order.businessId || "");
    const buyerName =
      String(
        order?.customer?.fullName ||
        userData?.displayName ||
        userData?.name ||
        "Anonymous"
      ).trim();

    const reviewData = {
      orderId,
      buyerId: uid,
      buyerName,
      businessId,
      rating: ratingNum,
      comment: cleanComment,
      status: "active",
      weightFactor: 1.0,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const reviewRef = await adminDb.collection("reviews").add(reviewData);

    // ── Mark order as reviewed ──
    await orderRef.update({
      reviewed: true,
      reviewId: reviewRef.id,
      reviewedAt: FieldValue.serverTimestamp(),
    });

    // ── Recompute vendor review summary ──
    await recomputeVendorReviewSummary(businessId);

    // ── Log activity ──
    await adminDb.collection("activityLog").add({
      type: "review_submitted",
      reviewId: reviewRef.id,
      orderId,
      businessId,
      buyerId: uid,
      rating: ratingNum,
      timestamp: FieldValue.serverTimestamp(),
    });

    return Response.json({
      ok: true,
      reviewId: reviewRef.id,
      message: "Thank you for your review!",
    });
  } catch (error: any) {
    console.error("[POST /api/orders/[orderId]/review]", error);
    return Response.json(
      { error: error.message || "Failed to submit review" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orders/[orderId]/review
 * Check if a review exists for this order (for the current buyer).
 */
export async function GET(
  req: Request,
  ctx: { params: Promise<{ orderId: string }> }
) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    const decoded = await adminAuth.verifyIdToken(token);
    const uid = decoded.uid;

    const { orderId } = await ctx.params;

    // Check if review exists
    const snap = await adminDb
      .collection("reviews")
      .where("orderId", "==", orderId)
      .where("buyerId", "==", uid)
      .limit(1)
      .get();

    if (snap.empty) {
      // Check if order is eligible for review
      const orderSnap = await adminDb.collection("orders").doc(orderId).get();
      const order = orderSnap.data() as any;

      const opsStatus = String(order?.opsStatus || "").toLowerCase();
      const escrowStatus = String(order?.escrowStatus || "").toLowerCase();

      const isEligible =
        opsStatus === REVIEW_ELIGIBLE_OPS_STATUS ||
        escrowStatus === REVIEW_ELIGIBLE_ESCROW_STATUS;

      return Response.json({
        ok: true,
        hasReview: false,
        canReview: isEligible,
        review: null,
      });
    }

    const reviewDoc = snap.docs[0];
    const review = { id: reviewDoc.id, ...reviewDoc.data() };

    return Response.json({
      ok: true,
      hasReview: true,
      canReview: false,
      review,
    });
  } catch (error: any) {
    console.error("[GET /api/orders/[orderId]/review]", error);
    return Response.json(
      { error: error.message || "Failed to check review" },
      { status: 500 }
    );
  }
}

/* ------------------------------------------------------------------ */
/*  Helper: Recompute vendor review summary                           */
/* ------------------------------------------------------------------ */

async function recomputeVendorReviewSummary(businessId: string) {
  try {
    const reviewsSnap = await adminDb
      .collection("reviews")
      .where("businessId", "==", businessId)
      .get();

    const reviews = reviewsSnap.docs.map((d) => ({
      id: d.id,
      rating: Number(d.data().rating || 0),
      status: String(d.data().status || ""),
      createdAt: d.data().createdAt,
    }));

    // Count appeals
    const appealsSnap = await adminDb
      .collection("reviewAppeals")
      .where("businessId", "==", businessId)
      .get();

    const summary = computeVendorReviewSummary(reviews);
    summary.appealCount = appealsSnap.size;

    // Store on business doc
    await adminDb
      .collection("businesses")
      .doc(businessId)
      .set({ reviewSummary: summary }, { merge: true });
  } catch (err) {
    console.error("[recomputeVendorReviewSummary]", err);
  }
}