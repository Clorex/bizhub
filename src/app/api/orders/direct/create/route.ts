// FILE: src/app/api/orders/direct/create/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { assertBuyerNotFrozen } from "@/lib/buyers/freezeServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanCode(v: any) {
  const raw = String(v || "").trim().toUpperCase();
  const ok = /^[A-Z0-9]{3,20}$/.test(raw);
  return ok ? raw : "";
}

function cleanShipping(s: any) {
  if (!s || typeof s !== "object") return null;

  const optionId = s.optionId ? String(s.optionId) : null;
  const type = String(s.type || "delivery") === "pickup" ? "pickup" : "delivery";
  const name = String(s.name || "").slice(0, 60) || (type === "pickup" ? "Pickup" : "Delivery");
  const feeKobo = Number(s.feeKobo || 0);

  return {
    optionId,
    type,
    name,
    feeKobo: Number.isFinite(feeKobo) ? Math.max(0, Math.floor(feeKobo)) : 0,
  };
}

export async function POST(req: Request) {
  try {
    const { businessId, businessSlug, items, amountKobo, customer, coupon, shipping } = await req.json();

    if (!businessId || !businessSlug) {
      return NextResponse.json({ error: "businessId and businessSlug are required" }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "items required" }, { status: 400 });
    }

    const amt = Number(amountKobo);
    if (!Number.isFinite(amt) || amt <= 0) {
      return NextResponse.json({ error: "amountKobo required" }, { status: 400 });
    }

    // ✅ Batch 4: buyer freeze enforcement (blocks new orders until resolved)
    try {
      await assertBuyerNotFrozen({
        phone: customer?.phone || null,
        email: customer?.email || null,
      });
    } catch (e: any) {
      if (e?.code === "BUYER_FROZEN") {
        return NextResponse.json(
          { error: "Your account is currently restricted. Please resolve pending issues before creating new orders." },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: e?.message || "Blocked" }, { status: 403 });
    }

    const orderRef = adminDb.collection("orders").doc();
    const orderId = orderRef.id;

    const couponCode = coupon?.code ? cleanCode(coupon.code) : "";
    const discountKobo = coupon?.discountKobo != null ? Number(coupon.discountKobo) : null;
    const subtotalKobo = coupon?.subtotalKobo != null ? Number(coupon.subtotalKobo) : null;

    const shippingClean = cleanShipping(shipping);

    await orderRef.set({
      businessId,
      businessSlug,
      items,
      customer: customer ?? {},

      coupon: couponCode
        ? {
            code: couponCode,
            discountKobo: Number.isFinite(discountKobo as any) ? Number(discountKobo) : null,
            subtotalKobo: Number.isFinite(subtotalKobo as any) ? Number(subtotalKobo) : null,
          }
        : null,

      shipping: shippingClean,

      paymentType: "direct_transfer",
      paymentStatus: "pending",
      escrowStatus: "none",
      orderStatus: "awaiting_vendor_confirmation",

      opsStatus: "new",
      opsUpdatedAtMs: Date.now(),

      currency: "NGN",
      amountKobo: amt,
      amount: amt / 100,

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    if (couponCode) {
      await adminDb
        .collection("businesses")
        .doc(businessId)
        .collection("coupons")
        .doc(couponCode)
        .set(
          { usedCount: FieldValue.increment(1), updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
    }

    return NextResponse.json({ ok: true, orderId });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to create direct order" }, { status: 500 });
  }
}