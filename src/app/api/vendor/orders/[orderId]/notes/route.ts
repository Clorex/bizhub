// FILE: src/app/api/vendor/orders/[orderId]/notes/route.ts

import { requireAnyRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";
import { getVendorLimitsResolved } from "@/lib/vendor/limitsServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(v: any, max = 2000) {
  return String(v || "").trim().slice(0, max);
}

export async function GET(req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) return Response.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const access = await getVendorLimitsResolved(me.businessId);
    if (!access.limits.canUseNotes) {
      return Response.json({ ok: false, code: "FEATURE_LOCKED", error: "Upgrade to use internal notes." }, { status: 403 });
    }

    const { orderId } = await ctx.params;
    const orderIdClean = String(orderId || "");
    if (!orderIdClean) return Response.json({ ok: false, error: "Missing orderId" }, { status: 400 });

    const orderSnap = await adminDb.collection("orders").doc(orderIdClean).get();
    if (!orderSnap.exists) return Response.json({ ok: false, error: "Order not found" }, { status: 404 });
    const order = orderSnap.data() as any;

    if (String(order.businessId || "") !== String(me.businessId || "")) {
      return Response.json({ ok: false, error: "Not allowed" }, { status: 403 });
    }

    const entriesSnap = await adminDb
      .collection("businesses")
      .doc(me.businessId)
      .collection("orderNotes")
      .doc(orderIdClean)
      .collection("entries")
      .orderBy("createdAtMs", "desc")
      .limit(50)
      .get();

    const notes = entriesSnap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .sort((a, b) => Number(a.createdAtMs || 0) - Number(b.createdAtMs || 0));

    return Response.json({ ok: true, notes });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return Response.json({ ok: false, code: "VENDOR_LOCKED", error: "Your free access has ended. Subscribe to continue." }, { status: 403 });
    }
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) return Response.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const access = await getVendorLimitsResolved(me.businessId);
    if (!access.limits.canUseNotes) {
      return Response.json({ ok: false, code: "FEATURE_LOCKED", error: "Upgrade to use internal notes." }, { status: 403 });
    }

    const { orderId } = await ctx.params;
    const orderIdClean = String(orderId || "");
    if (!orderIdClean) return Response.json({ ok: false, error: "Missing orderId" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const text = cleanText(body.text, 2000);
    if (text.length < 2) return Response.json({ ok: false, error: "Note is too short" }, { status: 400 });

    const orderSnap = await adminDb.collection("orders").doc(orderIdClean).get();
    if (!orderSnap.exists) return Response.json({ ok: false, error: "Order not found" }, { status: 404 });
    const order = orderSnap.data() as any;

    if (String(order.businessId || "") !== String(me.businessId || "")) {
      return Response.json({ ok: false, error: "Not allowed" }, { status: 403 });
    }

    const nowMs = Date.now();

    const parentRef = adminDb.collection("businesses").doc(me.businessId).collection("orderNotes").doc(orderIdClean);
    const entryRef = parentRef.collection("entries").doc();

    await adminDb.runTransaction(async (t) => {
      t.set(
        parentRef,
        {
          businessId: me.businessId,
          orderId: orderIdClean,
          updatedAtMs: nowMs,
          updatedAt: FieldValue.serverTimestamp(),
          createdAtMs: FieldValue.increment(0),
        },
        { merge: true }
      );

      t.set(entryRef, {
        businessId: me.businessId,
        orderId: orderIdClean,
        text,
        createdAtMs: nowMs,
        createdAt: FieldValue.serverTimestamp(),
        createdByUid: me.uid,
        createdByRole: me.role,
      });
    });

    return Response.json({ ok: true, id: entryRef.id });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return Response.json({ ok: false, code: "VENDOR_LOCKED", error: "Your free access has ended. Subscribe to continue." }, { status: 403 });
    }
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}