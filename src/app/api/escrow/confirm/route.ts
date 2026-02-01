// FILE: src/app/api/escrow/confirm/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function verifyPaystack(reference: string) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error("Missing PAYSTACK_SECRET_KEY");

  const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });

  const data = await res.json();
  if (!data.status) throw new Error(data.message || "Paystack verify failed");
  return data.data;
}

function normalizeMetadata(raw: any) {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw;
}

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
    const { reference } = await req.json();
    if (!reference) {
      return NextResponse.json({ error: "reference is required" }, { status: 400 });
    }

    const paystackTx = await verifyPaystack(reference);

    if (paystackTx.status !== "success") {
      return NextResponse.json(
        { error: `Payment not successful: ${paystackTx.status}`, raw: paystackTx },
        { status: 400 }
      );
    }

    const metadata = normalizeMetadata(paystackTx.metadata);
    const storeSlug = metadata.storeSlug || metadata.businessSlug || metadata.slug;

    const items = Array.isArray(metadata.items) ? metadata.items : [];
    const customer = metadata.customer || {};

    const couponMeta = metadata.coupon || null;
    const couponCode = couponMeta?.code ? cleanCode(couponMeta.code) : "";
    const discountKobo = couponMeta?.discountKobo != null ? Number(couponMeta.discountKobo) : null;
    const subtotalKobo = couponMeta?.subtotalKobo != null ? Number(couponMeta.subtotalKobo) : null;

    const shipping = cleanShipping(metadata.shipping);

    if (!storeSlug) {
      return NextResponse.json(
        { error: "Missing storeSlug in metadata (expected metadata.storeSlug)" },
        { status: 400 }
      );
    }

    const bizSnap = await adminDb.collection("businesses").where("slug", "==", storeSlug).limit(1).get();

    if (bizSnap.empty) {
      return NextResponse.json({ error: "Business not found for slug" }, { status: 404 });
    }

    const bizDoc = bizSnap.docs[0];
    const businessId = bizDoc.id;

    const amountKobo = Number(paystackTx.amount || 0);
    if (!Number.isFinite(amountKobo) || amountKobo <= 0) {
      return NextResponse.json({ error: "Invalid amount from Paystack", raw: paystackTx }, { status: 400 });
    }

    const amount = amountKobo / 100;

    const nowMs = Date.now();
    const holdMs = 5 * 60 * 1000; // ✅ 5 minutes max (your instruction)
    const holdUntilMs = nowMs + holdMs;

    const txRef = adminDb.collection("transactions").doc(reference);

    const result = await adminDb.runTransaction(async (t) => {
      const existingTxSnap = await t.get(txRef);
      if (existingTxSnap.exists) {
        const txData = existingTxSnap.data() as any;
        return {
          ok: true,
          orderId: txData.orderId,
          businessSlug: txData.businessSlug,
          escrowStatus: txData.status,
          holdUntilMs: txData.holdUntilMs ?? null,
          alreadyProcessed: true,
        };
      }

      const orderRef = adminDb.collection("orders").doc();
      const orderId = orderRef.id;

      const coupon =
        couponCode
          ? {
              code: couponCode,
              discountKobo: Number.isFinite(discountKobo as any) ? Number(discountKobo) : null,
              subtotalKobo: Number.isFinite(subtotalKobo as any) ? Number(subtotalKobo) : null,
            }
          : null;

      t.set(orderRef, {
        businessId,
        businessSlug: storeSlug,
        items,
        customer,

        coupon: coupon || null,
        shipping: shipping || null,

        paymentType: "paystack_escrow",
        paymentStatus: "paid",

        payment: {
          provider: "paystack",
          reference,
          status: "success",
          channel: paystackTx.channel || null,
          paidAt: paystackTx.paid_at || null,
          feesKobo: paystackTx.fees ?? null,
        },

        escrowStatus: "held",
        orderStatus: "paid_held",

        // ops progress (Batch 2)
        opsStatus: "paid",
        opsUpdatedAtMs: nowMs,

        currency: paystackTx.currency || "NGN",
        amount,
        amountKobo,

        holdUntilMs,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      t.set(txRef, {
        orderId,
        businessId,
        businessSlug: storeSlug,
        amount,
        amountKobo,
        status: "held",
        provider: "paystack",
        reference,
        holdUntilMs,
        createdAt: FieldValue.serverTimestamp(),
      });

      const walletRef = adminDb.collection("wallets").doc(businessId);
      t.set(
        walletRef,
        {
          businessId,
          pendingBalanceKobo: FieldValue.increment(amountKobo),
          availableBalanceKobo: FieldValue.increment(0),
          totalEarnedKobo: FieldValue.increment(0),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      if (couponCode) {
        const cRef = adminDb.collection("businesses").doc(businessId).collection("coupons").doc(couponCode);
        t.set(
          cRef,
          { usedCount: FieldValue.increment(1), updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
      }

      return {
        ok: true,
        orderId,
        businessSlug: storeSlug,
        escrowStatus: "held",
        holdUntilMs,
        alreadyProcessed: false,
      };
    });

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Escrow confirm failed" }, { status: 500 });
  }
}