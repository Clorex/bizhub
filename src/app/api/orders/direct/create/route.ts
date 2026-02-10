// FILE: src/app/api/orders/direct/create/route.ts

import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import crypto from "node:crypto";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const {
      storeSlug,
      customerName,
      customerPhone,
      customerEmail,
      items,
      totalAmountKobo,
    } = body;

    // 1. Basic Validation
    if (!storeSlug) {
      return Response.json(
        { error: "Missing store slug" },
        { status: 400 }
      );
    }

    if (!customerName || !customerPhone) {
      return Response.json(
        { error: "Customer name and phone are required" },
        { status: 400 }
      );
    }

    // 2. Look up the business to get businessId
    const bizSnap = await adminDb
      .collection("businesses")
      .where("slug", "==", storeSlug)
      .limit(1)
      .get();

    if (bizSnap.empty) {
      return Response.json(
        { error: "Store not found" },
        { status: 404 }
      );
    }

    const bizDoc = bizSnap.docs[0];
    const businessId = bizDoc.id;
    const bizData = bizDoc.data();

    // 3. Generate unique Order ID
    const orderId = `dir_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    // 4. Calculate amount
    const amountKobo = Number(totalAmountKobo) || 0;
    const amountNgn = amountKobo / 100;

    // 5. Prepare order data
    const orderData = {
      // IDs
      orderId,
      businessId,
      businessSlug: storeSlug,
      storeSlug,

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
      amountPaidKobo: 0, // Not confirmed yet
      currency: "NGN",

      // Timestamps
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: Date.now(),
      updatedAt: FieldValue.serverTimestamp(),
      updatedAtMs: Date.now(),

      // Transfer proof
      transferProof: null,
      transferProofUploadedAt: null,

      // Vendor info for reference
      vendorName: bizData.name || storeSlug,
    };

    // 6. Save to Firestore
    await adminDb.collection("orders").doc(orderId).set(orderData);

    // 7. Return success
    return Response.json({
      success: true,
      ok: true,
      orderId,
      message: "Order created. Awaiting payment confirmation.",
    });
  } catch (error: any) {
    console.error("Direct transfer order error:", error);
    return Response.json(
      { error: error?.message || "Failed to create order" },
      { status: 500 }
    );
  }
}