// FILE: src/app/api/orders/direct/create/route.ts
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import crypto from "node:crypto";

export const runtime = "nodejs";

function safeInt(n: any, fallback = 0) {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) ? v : fallback;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const { storeSlug, customerName, customerPhone, customerEmail, items, totalAmountKobo } = body;

    // 1) Basic validation
    if (!storeSlug) return Response.json({ error: "Missing store slug" }, { status: 400 });
    if (!customerName || !customerPhone) {
      return Response.json({ error: "Customer name and phone are required" }, { status: 400 });
    }

    // 2) Look up business
    const bizSnap = await adminDb.collection("businesses").where("slug", "==", storeSlug).limit(1).get();
    if (bizSnap.empty) return Response.json({ error: "Store not found" }, { status: 404 });

    const bizDoc = bizSnap.docs[0];
    const businessId = bizDoc.id;
    const bizData = bizDoc.data();

    // 3) Generate unique internal Order ID (doc id)
    const orderId = `dir_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    // 4) Amounts
    const amountKobo = safeInt(totalAmountKobo, 0);
    const amountNgn = amountKobo / 100;

    const orderRef = adminDb.collection("orders").doc(orderId);

    // Counter doc per business (atomic)
    const counterRef = adminDb.collection("businessCounters").doc(businessId);

    const result = await adminDb.runTransaction(async (t) => {
      // orderId is unique, but keep safe anyway
      const existing = await t.get(orderRef);
      if (existing.exists) {
        const d: any = existing.data() || {};
        return { ok: true, orderId, orderNumber: d.orderNumber ?? null, alreadyExisted: true };
      }

      const counterSnap = await t.get(counterRef);
      const cur = counterSnap.exists ? safeInt((counterSnap.data() as any)?.orderSeq, 0) : 0;
      const next = cur + 1;

      t.set(counterRef, { orderSeq: next, updatedAt: FieldValue.serverTimestamp() }, { merge: true });

      const nowMs = Date.now();

      const orderData = {
        // IDs
        orderId,
        id: orderId, // optional convenience
        businessId,
        businessSlug: storeSlug,
        storeSlug,

        // NEW: simple sequential order number
        orderNumber: next,

        // Status
        status: "awaiting_confirmation",
        orderStatus: "awaiting_confirmation",
        escrowStatus: "awaiting_transfer_confirmation",
        paymentType: "direct_transfer",
        paymentProvider: "direct_transfer",

        // Customer
        customer: {
          fullName: String(customerName || "").trim().slice(0, 100),
          phone: String(customerPhone || "").trim().slice(0, 30),
          email: String(customerEmail || "").trim().slice(0, 120),
        },
        buyerName: String(customerName || "").trim(),
        buyerPhone: String(customerPhone || "").trim(),
        buyerEmail: String(customerEmail || "").trim(),

        // Items
        items: Array.isArray(items) ? items : [],

        // Amount
        amount: amountNgn,
        amountKobo,
        amountPaidKobo: 0,
        currency: "NGN",

        // Timestamps
        createdAt: FieldValue.serverTimestamp(),
        createdAtMs: nowMs,
        updatedAt: FieldValue.serverTimestamp(),
        updatedAtMs: nowMs,

        // Transfer proof
        transferProof: null,
        transferProofUploadedAt: null,

        // Vendor info for reference
        vendorName: (bizData as any)?.name || storeSlug,
      };

      t.set(orderRef, orderData);
      return { ok: true, orderId, orderNumber: next, alreadyExisted: false };
    });

    return Response.json({
      success: true,
      ok: true,
      orderId: result.orderId,
      orderNumber: result.orderNumber ?? null,
      message: "Order created. Awaiting payment confirmation.",
    });
  } catch (error: any) {
    console.error("Direct transfer order error:", error);
    return Response.json({ error: error?.message || "Failed to create order" }, { status: 500 });
  }
}