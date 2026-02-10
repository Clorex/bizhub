// FILE: src/app/api/orders/[orderId]/review/route.ts
//
// POST — Buyer submits a review for a completed order.
// One review per order. Buyer must be the order customer.
// Order must be delivered/released before review is allowed.


import { requireMe } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  MAX_COMMENT_LENGTH,
  MIN_COMMENT_LENGTH,
  REVIEW_WINDOW_DAYS,
  REVIEW_ELIGIBLE_OPS_STATUS,
  REVIEW_ELIGIBLE_ESCROW_STATUS,
} from "@/lib/reviews/config";
import { computeVendorReviewSummary } from "@/lib/reviews/computeReviewScore";
import { simpleTextGuard } from "@/lib/moderation/simpleTextGuard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toMs(v: any): number {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "object") {
    if (typeof v.toMillis === "function") return Number(v.toMillis()) || 0;
    if (typeof v.seconds === "number") return Math.floor(v.seconds * 1000);
  }
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : 0;
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> }
) {
  try {
    const me = await requireMe(req);
    const { orderId } = await params;

    if (!orderId) {
      return Response.json({ ok: false, error: "Missing orderId" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const rating = Number(body.rating);
    if (!rating || rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return Response.json({ ok: false, error: "Rating must be 1–5" }, { status: 400 });
    }

    let comment: string | null = null;
    if (body.comment && typeof body.comment === "string" && body.comment.trim()) {
      const trimmed = body.comment.trim().slice(0, MAX_COMMENT_LENGTH);
      if (trimmed.length < MIN_COMMENT_LENGTH) {
        return Response.json(
          { ok: false, error: `Comment must be at least ${MIN_COMMENT_LENGTH} characters` },
          { status: 400 }
        );
      }
      // Basic moderation check
      const guardResult = simpleTextGuard(trimmed);
      if (guardResult.blocked) {
        return Response.json(
          { ok: false, error: "Your comment contains inappropriate language. Please revise." },
          { status: 400 }
        );
      }
      comment = trimmed;
    }

    // ── Load order ──
    const orderRef = adminDb.collection("orders").doc(orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return Response.json({ ok: false, error: "Order not found" }, { status: 404 });
    }

    const order = orderSnap.data() as any;

    // ── Verify buyer owns this order ──
    const orderCustomerEmail = String(order?.customer?.email || "").toLowerCase().trim();
    const meEmail = String(me.email || "").toLowerCase().trim();
    const orderBuyerId = String(order?.buyerUid || order?.customerId || "").trim();

    const isBuyer =
      (orderBuyerId && orderBuyerId === me.uid) ||
      (meEmail && orderCustomerEmail && meEmail === orderCustomerEmail);

    if (!isBuyer) {
      return Response.json({ ok: false, error: "You can only review your own orders" }, { status: 403 });
    }

    // ── Check order is complete ──
    const opsStatus = String(order?.opsStatus || "").toLowerCase();
    const escrowStatus = String(order?.escrowStatus || "").toLowerCase();

    const isComplete =
      opsStatus === REVIEW_ELIGIBLE_OPS_STATUS ||
      escrowStatus === REVIEW_ELIGIBLE_ESCROW_STATUS;

    if (!isComplete) {
      return Response.json(
        { ok: false, error: "You can only review after your order is delivered" },
        { status: 400 }
      );
    }

    // ── Check review window ──
    const completedAtMs = toMs(order?.deliveredAt || order?.releasedAt || order?.updatedAt);
    if (completedAtMs) {
      const windowMs = REVIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;
      if (Date.now() - completedAtMs > windowMs) {
        return Response.json(
          { ok: false, error: `Review window has closed (${REVIEW_WINDOW_DAYS} days after delivery)` },
          { status: 400 }
        );
      }
    }

    // ── Check for existing review ──
    const existingSnap = await adminDb
      .collection("reviews")
      .where("orderId", "==", orderId)
      .where("buyerId", "==", me.uid)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      return Response.json(
        { ok: false, error: "You have already reviewed this order" },
        { status: 409 }
      );
    }

    // ── Check buyer is not suspended ──
    const buyerProfileSnap = await adminDb.collection("buyerReviewProfiles").doc(me.uid).get();
    if (buyerProfileSnap.exists) {
      const buyerProfile = buyerProfileSnap.data() as any;
      if (buyerProfile?.reviewSuspended) {
        return Response.json(
          { ok: false, error: "Your review privilege has been temporarily suspended" },
          { status: 403 }
        );
      }
    }

    const businessId = String(order?.businessId || "").trim();
    if (!businessId) {
      return Response.json({ ok: false, error: "Order missing business reference" }, { status: 400 });
    }

    // ── Get buyer display name ──
    const buyerName =
      String(order?.customer?.fullName || "").trim() ||
      String(me.email || "").split("@")[0] ||
      "Anonymous";

    // ── Create review ──
    const reviewRef = adminDb.collection("reviews").doc();
    const nowMs = Date.now();

    const reviewData = {
      orderId,
      buyerId: me.uid,
      buyerName,
      businessId,
      rating,
      comment,
      status: "active" as const,
      weightFactor: 1.0,
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: nowMs,
      updatedAt: FieldValue.serverTimestamp(),
      updatedAtMs: nowMs,
    };

    await reviewRef.set(reviewData);

    // ── Mark order as reviewed ──
    await orderRef.set(
      { reviewed: true, reviewId: reviewRef.id, updatedAt: FieldValue.serverTimestamp() },
      { merge: true }
    );

    // ── Recompute vendor review summary ──
    try {
      const allReviewsSnap = await adminDb
        .collection("reviews")
        .where("businessId", "==", businessId)
        .get();

      const allReviews = allReviewsSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));

      const summary = computeVendorReviewSummary(allReviews, nowMs);

      await adminDb.collection("businesses").doc(businessId).set(
        { reviewSummary: summary, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    } catch (e) {
      console.error("[review] Failed to recompute summary:", e);
      // Non-fatal — review is already saved
    }

    return Response.json({
      ok: true,
      reviewId: reviewRef.id,
      message: "Thank you for your review!",
    });
  } catch (e: any) {
    console.error("[POST /api/orders/[orderId]/review]", e);
    return Response.json(
      { ok: false, error: e?.message || "Failed to submit review" },
      { status: 500 }
    );
  }
}