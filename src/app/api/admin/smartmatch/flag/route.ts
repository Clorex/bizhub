// FILE: src/app/api/admin/smartmatch/flag/route.ts


import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/admin/smartmatch/flag
 *
 * Admin endpoint to flag/unflag vendors that exploit the SmartMatch system.
 *
 * Flagged vendors get a score penalty or are excluded from smart ranking.
 *
 * Body:
 * {
 *   businessId: string
 *   flagged: boolean
 *   reason?: string
 * }
 */
export async function POST(req: Request) {
  try {
    await requireRole(req, "admin");

    const body = await req.json().catch(() => ({}));

    const businessId = typeof body?.businessId === "string"
      ? body.businessId.trim()
      : "";

    if (!businessId) {
      return Response.json(
        { ok: false, error: "businessId is required" },
        { status: 400 }
      );
    }

    const flagged = body?.flagged === true;
    const reason = typeof body?.reason === "string"
      ? body.reason.trim().slice(0, 500)
      : "";

    const bizRef = adminDb.collection("businesses").doc(businessId);
    const snap = await bizRef.get();

    if (!snap.exists) {
      return Response.json(
        { ok: false, error: "Business not found" },
        { status: 404 }
      );
    }

    await bizRef.set(
      {
        smartMatch: {
          flagged,
          flagReason: flagged ? reason || "Flagged by admin" : null,
          flaggedAtMs: flagged ? Date.now() : null,
          flaggedBy: flagged ? "admin" : null,
        },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    // Log the action
    await adminDb.collection("activityLog").add({
      type: flagged ? "smartmatch_vendor_flagged" : "smartmatch_vendor_unflagged",
      businessId,
      reason: reason || null,
      timestamp: FieldValue.serverTimestamp(),
    });

    return Response.json({
      ok: true,
      businessId,
      flagged,
      reason: reason || null,
    });
  } catch (e: any) {
    return Response.json(
      { ok: false, error: e?.message || "Failed" },
      { status: 500 }
    );
  }
}