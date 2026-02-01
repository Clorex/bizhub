// FILE: src/app/api/admin/disputes/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { syncBusinessSignalsToProducts } from "@/lib/vendor/syncBusinessSignals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    await requireRole(req, "admin");

    const snap = await adminDb.collection("disputes").orderBy("createdAt", "desc").limit(150).get();
    return NextResponse.json({ ok: true, disputes: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireRole(req, "admin");

    const { disputeId, decision } = await req.json();
    if (!disputeId || !decision) return NextResponse.json({ error: "disputeId and decision required" }, { status: 400 });

    const disputeRef = adminDb.collection("disputes").doc(disputeId);
    const disputeSnap = await disputeRef.get();
    if (!disputeSnap.exists) return NextResponse.json({ error: "Dispute not found" }, { status: 404 });

    const dispute = disputeSnap.data() as any;

    await disputeRef.set(
      { status: "closed", adminDecision: decision, resolvedAt: FieldValue.serverTimestamp(), resolvedByUid: me.uid, resolvedAtMs: Date.now() },
      { merge: true }
    );

    const orderRef = adminDb.collection("orders").doc(dispute.orderId);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const order = orderSnap.data() as any;

    if (decision === "release") {
      const amountKobo = Number(order.amountKobo || 0);
      const businessId = String(order.businessId || "");

      await adminDb.collection("wallets").doc(businessId).set(
        {
          pendingBalanceKobo: FieldValue.increment(-amountKobo),
          availableBalanceKobo: FieldValue.increment(amountKobo),
          totalEarnedKobo: FieldValue.increment(amountKobo),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await orderRef.set(
        { escrowStatus: "released", orderStatus: "released_to_vendor_wallet", updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    }

    if (decision === "refund") {
      await orderRef.set(
        { escrowStatus: "refunded", orderStatus: "refunded", updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );
    }

    const nowMs = Date.now();
    const buyerKey = String(dispute.buyerKey || "").trim();
    const businessId = String(dispute.businessId || order.businessId || "").trim();

    if (buyerKey) {
      const bsRef = adminDb.collection("buyerSignals").doc(buyerKey);

      await adminDb.runTransaction(async (t) => {
        const bsSnap = await t.get(bsRef);
        const bs = bsSnap.exists ? (bsSnap.data() as any) : {};
        const curOpen = Number(bs.openDisputes || 0);
        const nextOpen = Math.max(0, curOpen - 1);

        t.set(
          bsRef,
          {
            openDisputes: nextOpen,
            frozen: nextOpen > 0 ? true : false,
            frozenReason: nextOpen > 0 ? "Open dispute" : null,
            updatedAtMs: nowMs,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      });
    }

    if (businessId) {
      await adminDb.collection("businesses").doc(businessId).set(
        {
          trust: {
            openDisputes: FieldValue.increment(-1),
            lastDisputeResolvedAtMs: nowMs,
          },
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      await syncBusinessSignalsToProducts({ businessId });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}