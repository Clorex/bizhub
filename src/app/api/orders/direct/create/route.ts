// FILE: src/app/api/orders/direct/create/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import crypto from "node:crypto";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { storeSlug, customerName, customerPhone, items, totalAmountKobo } = body;

    // 1. Basic Validation
    if (!storeSlug || !items || !items.length) {
      return NextResponse.json({ error: "Missing required order details." }, { status: 400 });
    }

    // 2. Generate a unique Order ID for the Receipt
    const orderId = `ord_dir_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    // 3. Prepare the Order Data
    const orderData = {
      orderId,
      storeSlug,
      status: "awaiting_confirmation", // Crucial: Vendor has to manually confirm they got the alert!
      paymentProvider: "direct_transfer",
      createdAt: FieldValue.serverTimestamp(),
      createdAtMs: Date.now(),
      customer: {
        fullName: customerName || "Guest",
        phone: customerPhone || "",
      },
      items,
      total: (totalAmountKobo || 0) / 100, // Converts Kobo back to Naira
      amountPaidKobo: totalAmountKobo || 0,
      currency: "NGN",
    };

    // 4. Save to Firestore safely using Admin DB
    await adminDb.collection("orders").doc(orderId).set(orderData);

    // 5. Tell the frontend it was successful so it redirects to the Receipt page!
    return NextResponse.json({ success: true, orderId });
    
  } catch (error: any) {
    console.error("Direct transfer order error:", error);
    return NextResponse.json({ error: "Failed to create order. Please try again." }, { status: 500 });
  }
}