// FILE: src/app/api/admin/reviews/[reviewId]/resolve/route.ts
//
// POST — Admin resolves a review appeal.
// Decisions: review_valid, partially_valid, review_invalid


import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { computeVendorReviewSummary } from "@/lib/reviews/computeReviewScore";
import { BUYER_WARN_THRESHOLD, BUYER_SUSPEND_THRESHOLD } from "@/lib/reviews/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Decision = "review_valid" | "partially_valid" | "review_invalid";

const VALID_DECISIONS: Decision[] = ["review_valid", "partially_valid", "review_invalid"];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const me = await requireRole(req, "admin");
    const { reviewId } = await params;

    if (!reviewId) {
      return Response.json({ ok: false, error: "Missing reviewId" }, { status: 400 });
    }

    const body = await req.json().catch(() => ({}));
    const decision = String(body.decision || "").trim() as Decision;
    const notes = String(body.notes || "").trim().slice(0, 500);

    if (!VALID_DECISIONS.includes(decision)) {
      return Response.json({ ok: false, error: "Invalid decision" }, { status: 400 });
    }

    // ── Load review ──
    const reviewRef = adminDb.collection("reviews").doc(reviewId);
    const reviewSnap = await reviewRef.get();
    if (!reviewSnap.exists) {
      return Response.json({ ok: false, error: "Review not found" }, { status: 404 });
    }

    const review = reviewSnap.data() as any;
    const businessId = String(review.businessId || "");
    const buyerId = String(review.buyerId || "");
    const nowMs = Date.now();

    // ── Find the pending appeal ──
    const appealSnap = await adminDb
      .collection("reviewAppeals")
      .where("reviewId", "==", reviewId)
      .where("status", "==", "pending")
      .limit(1)
      .get();

    const appealDoc = appealSnap.empty ? null : appealSnap.docs[0];

    const batch = adminDb.batch();

    let adminAction: string = "";
    let logAction: string = "";
    let message = "";

    switch (decision) {
      case "review_valid": {
        // Review stands — restore to active
        batch.set(
          reviewRef,
          {
            status: "active",
            updatedAt: FieldValue.serverTimestamp(),
            updatedAtMs: nowMs,
          },
          { merge: true }
        );
        adminAction = "restored";
        logAction = "review_restored";
        message = "Review restored as valid. Appeal dismissed.";
        break;
      }

      case "partially_valid": {
        // Keep rating, remove comment text
        batch.set(
          reviewRef,
          {
            status: "active",
            comment: null,
            updatedAt: FieldValue.serverTimestamp(),
            updatedAtMs: nowMs,
          },
          { merge: true }
        );
        adminAction = "comment_edited";
        logAction = "comment_edited";
        message = "Comment removed, star rating kept.";
        break;
      }

      case "review_invalid": {
        // Remove the review entirely
        batch.set(
          reviewRef,
          {
            status: "removed",
            updatedAt: FieldValue.serverTimestamp(),
            updatedAtMs: nowMs,
          },
          { merge: true }
        );
        adminAction = "removed";
        logAction = "review_removed";
        message = "Review removed.";

        // ── Buyer abuse tracking ──
        if (buyerId) {
          const buyerProfileRef = adminDb.collection("buyerReviewProfiles").doc(buyerId);
          const buyerProfileSnap = await buyerProfileRef.get();
          const buyerProfile = buyerProfileSnap.exists ? (buyerProfileSnap.data() as any) : {};

          const totalReviews = Number(buyerProfile.totalReviews || 0);
          const removedReviews = Number(buyerProfile.removedReviews || 0) + 1;

          const updates: any = {
            totalReviews,
            removedReviews,
            updatedAt: FieldValue.serverTimestamp(),
          };

          if (removedReviews >= BUYER_SUSPEND_THRESHOLD) {
            updates.reviewSuspended = true;
            updates.suspensionReason = "Multiple reviews removed by moderation";

            const suspendLog = adminDb.collection("reviewActionLogs").doc();
            batch.set(suspendLog, {
              reviewId,
              action: "buyer_suspended",
              adminUid: me.uid,
              details: `Buyer ${buyerId} suspended after ${removedReviews} removed reviews`,
              timestamp: FieldValue.serverTimestamp(),
            });
            message += " Buyer review privilege suspended.";
          } else if (removedReviews >= BUYER_WARN_THRESHOLD) {
            updates.lastWarningAt = FieldValue.serverTimestamp();

            const warnLog = adminDb.collection("reviewActionLogs").doc();
            batch.set(warnLog, {
              reviewId,
              action: "buyer_warned",
              adminUid: me.uid,
              details: `Buyer ${buyerId} warned (${removedReviews} removed reviews)`,
              timestamp: FieldValue.serverTimestamp(),
            });
            message += " Buyer warned.";
          }

          batch.set(buyerProfileRef, updates, { merge: true });
        }
        break;
      }
    }

    // ── Update appeal if one exists ──
    if (appealDoc) {
      batch.set(
        appealDoc.ref,
        {
          status: decision,
          adminUid: me.uid,
          adminNotes: notes || null,
          adminAction,
          resolvedAt: FieldValue.serverTimestamp(),
          resolvedAtMs: nowMs,
        },
        { merge: true }
      );
    }

    // ── Log the resolution ──
    const actionLogRef = adminDb.collection("reviewActionLogs").doc();
    batch.set(actionLogRef, {
      reviewId,
      appealId: appealDoc?.id || null,
      action: logAction,
      adminUid: me.uid,
      details: notes || `Decision: ${decision}`,
      timestamp: FieldValue.serverTimestamp(),
    });

    await batch.commit();

    // ── Recompute vendor review summary ──
    if (businessId) {
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
        console.error("[resolve] Failed to recompute summary:", e);
      }
    }

    return Response.json({ ok: true, message });
  } catch (e: any) {
    console.error("[POST /api/admin/reviews/[reviewId]/resolve]", e);
    return Response.json(
      { ok: false, error: e?.message || "Failed to resolve" },
      { status: 500 }
    );
  }
}