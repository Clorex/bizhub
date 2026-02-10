
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

const VALID_REASONS = [
  "abusive_language",
  "false_claim",
  "issue_resolved",
  "buyer_violated_policy",
  "spam_irrelevant",
] as const;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Reason = (typeof VALID_REASONS)[number];

export async function POST(
  request: Request,
  context: { params: Promise<{ reviewId: string }> } // <--- Note the Promise
) {
  try {
    const { reviewId } = await context.params; // <--- Await it here

    const body = await request.json().catch(() => ({}));
    let reason = String(body.reason || "").trim();

    if (!VALID_REASONS.includes(reason as Reason)) {
      return Response.json(
        { ok: false, error: "Invalid appeal reason" },
        { status: 400 }
      );
    }

    reason = reason as Reason;

    const appealRef = adminDb.collection("reviewAppeals").doc(reviewId);

    await appealRef.set({
      reviewId,
      reason,
      createdAt: FieldValue.serverTimestamp(),
    });

    return Response.json({ ok: true, reviewId, reason });
  } catch (err: any) {
    return Response.json(
      { ok: false, error: err?.message || "Failed" },
      { status: 500 }
    );
  }
}
