// FILE: src/app/api/admin/verification/route.ts

import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { syncBusinessSignalsToProducts } from "@/lib/vendor/syncBusinessSignals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanTier(v: any): "tier1" | "tier2" | "tier3" {
  const s = String(v || "").trim();
  if (s === "tier1" || s === "tier2" || s === "tier3") return s;
  return "tier2";
}

function cleanDecision(v: any): "approve" | "reject" {
  const s = String(v || "").trim();
  return s === "reject" ? "reject" : "approve";
}

function cleanNote(v: any) {
  return String(v || "").trim().slice(0, 400);
}

export async function GET(req: Request) {
  try {
    await requireRole(req, "admin");

    const url = new URL(req.url);
    const status = String(url.searchParams.get("status") || "pending").trim();

    const snap = await adminDb
      .collection("verificationSubmissions")
      .orderBy("createdAtMs", "desc")
      .limit(200)
      .get();

    let items = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    if (status) items = items.filter((x) => String(x.status || "") === status);

    const bizIds = Array.from(new Set(items.map((x) => String(x.businessId || "")).filter(Boolean))).slice(0, 200);

    const bizMap = new Map<string, any>();
    for (const id of bizIds) {
      const bSnap = await adminDb.collection("businesses").doc(id).get();
      if (bSnap.exists) bizMap.set(id, { id: bSnap.id, ...(bSnap.data() as any) });
    }

    const enriched = items.map((x) => ({
      ...x,
      business: bizMap.get(String(x.businessId || "")) || null,
    }));

    return Response.json({ ok: true, items: enriched });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireRole(req, "admin");

    const body = await req.json().catch(() => ({}));
    const submissionId = String(body.submissionId || "").trim();
    const decision = cleanDecision(body.decision);
    const tier = cleanTier(body.tier);
    const note = cleanNote(body.note);

    if (!submissionId) return Response.json({ ok: false, error: "submissionId required" }, { status: 400 });

    const subRef = adminDb.collection("verificationSubmissions").doc(submissionId);
    const subSnap = await subRef.get();
    if (!subSnap.exists) return Response.json({ ok: false, error: "Submission not found" }, { status: 404 });

    const sub = subSnap.data() as any;
    const businessId = String(sub.businessId || "");
    if (!businessId) return Response.json({ ok: false, error: "Submission missing businessId" }, { status: 400 });

    const bizRef = adminDb.collection("businesses").doc(businessId);

    const nowMs = Date.now();

    await adminDb.runTransaction(async (t) => {
      const bizSnap = await t.get(bizRef);
      if (!bizSnap.exists) throw new Error("Business not found");

      const biz = bizSnap.data() as any;
      const verification = biz?.verification || {};

      if (!verification[tier]) verification[tier] = {};
      verification[tier].status = decision === "approve" ? "verified" : "rejected";
      verification[tier].reviewedAtMs = nowMs;
      verification[tier].reviewedByUid = me.uid;
      verification[tier].adminNote = decision === "reject" ? (note || "Not approved") : null;
      verification[tier].updatedAtMs = nowMs;

      t.set(
        bizRef,
        { verification, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );

      t.set(
        subRef,
        {
          status: decision === "approve" ? "approved" : "rejected",
          reviewedAtMs: nowMs,
          reviewedAt: FieldValue.serverTimestamp(),
          reviewedByUid: me.uid,
          note: decision === "reject" ? (note || "Not approved") : null,
        },
        { merge: true }
      );
    });

    await syncBusinessSignalsToProducts({ businessId });

    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}