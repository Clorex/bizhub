// FILE: src/lib/escrow/releaseServer.ts
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export async function releaseEscrowIfEligible(params: { orderId: string }) {
  const { orderId } = params;

  const orderRef = adminDb.collection("orders").doc(orderId);

  const result = await adminDb.runTransaction(async (t) => {
    const orderSnap = await t.get(orderRef);
    if (!orderSnap.exists) {
      return { ok: false, status: 404, error: "Order not found" as const };
    }

    const order = orderSnap.data() as any;

    if (order.escrowStatus !== "held") {
      return {
        ok: true,
        message: "Not held",
        escrowStatus: order.escrowStatus,
      };
    }

    const holdUntilMs = Number(order.holdUntilMs || 0);
    if (Date.now() < holdUntilMs) {
      return { ok: true, message: "Still holding", holdUntilMs };
    }

    const businessId = order.businessId;
    const amountKobo = Number(order.amountKobo || 0);

    if (!businessId || !Number.isFinite(amountKobo) || amountKobo <= 0) {
      return { ok: false, status: 400, error: "Invalid order data" as const };
    }

    const walletRef = adminDb.collection("wallets").doc(businessId);
    t.set(
      walletRef,
      {
        pendingBalanceKobo: FieldValue.increment(-amountKobo),
        availableBalanceKobo: FieldValue.increment(amountKobo),
        totalEarnedKobo: FieldValue.increment(amountKobo),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    t.set(
      orderRef,
      {
        escrowStatus: "released",
        orderStatus: "released_to_vendor_wallet",
        releasedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    const reference = order?.payment?.reference;
    if (reference) {
      const txRef = adminDb.collection("transactions").doc(String(reference));
      t.set(txRef, { status: "released", releasedAt: FieldValue.serverTimestamp() }, { merge: true });
    }

    return { ok: true, message: "Released to vendor wallet" };
  });

  return result;
}