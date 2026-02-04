import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { buildQuote } from "@/lib/checkout/pricingServer";

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

function safeItemsFromMetadata(items: any[]) {
  return (Array.isArray(items) ? items : [])
    .map((it) => ({
      productId: String(it?.productId || "").trim(),
      qty: Math.max(1, Math.floor(Number(it?.qty || 1))),
      selectedOptions: it?.selectedOptions && typeof it.selectedOptions === "object" ? it.selectedOptions : null,
    }))
    .filter((x) => !!x.productId)
    .slice(0, 50);
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

    const paystackTx = await verifyPaystack(String(reference));

    if (paystackTx.status !== "success") {
      return NextResponse.json({ error: `Payment not successful: ${paystackTx.status}`, raw: paystackTx }, { status: 400 });
    }

    const metadata = normalizeMetadata(paystackTx.metadata);
    const storeSlug = String(metadata.storeSlug || metadata.businessSlug || metadata.slug || "").trim();

    if (!storeSlug) {
      return NextResponse.json({ error: "Missing storeSlug in metadata (expected metadata.storeSlug)" }, { status: 400 });
    }

    const itemsMeta = safeItemsFromMetadata(Array.isArray(metadata.items) ? metadata.items : []);
    if (itemsMeta.length < 1) {
      return NextResponse.json({ error: "Missing items in metadata" }, { status: 400 });
    }

    const couponCode = metadata?.coupon?.code ? String(metadata.coupon.code) : null;
    const shipping = cleanShipping(metadata.shipping);
    const shippingFeeKobo = Number(shipping?.feeKobo || 0);

    // ✅ Recompute the correct total on server (sale first, coupon after sale)
    const quote = await buildQuote({
      storeSlug,
      items: itemsMeta,
      couponCode,
      shippingFeeKobo,
    });

    const expectedKobo = Number(quote?.pricing?.totalKobo || 0);
    const paidKobo = Number(paystackTx.amount || 0);

    if (!Number.isFinite(paidKobo) || paidKobo <= 0) {
      return NextResponse.json({ error: "Invalid amount from Paystack", raw: paystackTx }, { status: 400 });
    }

    // ✅ If mismatch, DO NOT create order (prevents underpay exploit)
    if (paidKobo !== expectedKobo) {
      await adminDb.collection("paymentMismatches").doc(String(reference)).set(
        {
          reference: String(reference),
          storeSlug,
          expectedKobo,
          paidKobo,
          currency: paystackTx.currency || "NGN",
          createdAtMs: Date.now(),
          createdAt: FieldValue.serverTimestamp(),
          metadata: {
            couponCode: couponCode ? String(couponCode).toUpperCase() : null,
            shippingFeeKobo,
          },
          quotePricing: quote.pricing,
        },
        { merge: true }
      );

      return NextResponse.json(
        {
          error: "Amount mismatch. Please refresh checkout and try again.",
          code: "AMOUNT_MISMATCH",
          expectedKobo,
          paidKobo,
        },
        { status: 400 }
      );
    }

    const customer = metadata.customer || {};

    const nowMs = Date.now();
    const holdMs = 5 * 60 * 1000; // 5 minutes max
    const holdUntilMs = nowMs + holdMs;

    const txRef = adminDb.collection("transactions").doc(String(reference));

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

      // Normalize items with server final prices (NGN)
      const items = Array.isArray(quote.normalizedItems)
        ? quote.normalizedItems.map((it: any) => ({
            productId: String(it.productId || ""),
            name: String(it.name || "Item"),
            qty: Number(it.qty || 1),
            price: Number(it.finalUnitPriceKobo || 0) / 100,
            imageUrl: null,
            selectedOptions: it.selectedOptions || null,
            pricing: {
              baseUnitPriceKobo: Number(it.baseUnitPriceKobo || 0),
              finalUnitPriceKobo: Number(it.finalUnitPriceKobo || 0),
              saleApplied: !!it.saleApplied,
              saleId: it.saleId ?? null,
              saleType: it.saleType ?? null,
              salePercent: it.salePercent ?? null,
              saleAmountOffNgn: it.saleAmountOffNgn ?? null,
            },
          }))
        : [];

      const couponApplied =
        quote?.couponResult?.ok === true && Number(quote?.pricing?.couponDiscountKobo || 0) > 0
          ? { code: String(couponCode || "").toUpperCase(), discountKobo: Number(quote.pricing.couponDiscountKobo || 0) }
          : null;

      // Create order
      t.set(orderRef, {
        businessId: quote.businessId,
        businessSlug: storeSlug,

        items,
        customer,

        coupon: couponApplied,
        shipping: shipping || null,

        paymentType: "paystack_escrow",
        paymentStatus: "paid",
        payment: {
          provider: "paystack",
          reference: String(reference),
          status: "success",
          channel: paystackTx.channel || null,
          paidAt: paystackTx.paid_at || null,
          feesKobo: paystackTx.fees ?? null,
        },

        escrowStatus: "held",
        orderStatus: "paid_held",

        opsStatus: "paid",
        opsUpdatedAtMs: nowMs,

        currency: paystackTx.currency || "NGN",
        amountKobo: paidKobo,
        amount: paidKobo / 100,

        // ✅ pricing breakdown stored
        pricing: {
          ...quote.pricing,
          computedAtMs: nowMs,
          rule: "sale_then_coupon",
        },

        holdUntilMs,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      t.set(txRef, {
        orderId,
        businessId: quote.businessId,
        businessSlug: storeSlug,
        amount: paidKobo / 100,
        amountKobo: paidKobo,
        status: "held",
        provider: "paystack",
        reference: String(reference),
        holdUntilMs,
        pricing: quote.pricing,
        createdAt: FieldValue.serverTimestamp(),
      });

      // Wallet pending balance
      const walletRef = adminDb.collection("wallets").doc(String(quote.businessId));
      t.set(
        walletRef,
        {
          businessId: quote.businessId,
          pendingBalanceKobo: FieldValue.increment(paidKobo),
          availableBalanceKobo: FieldValue.increment(0),
          totalEarnedKobo: FieldValue.increment(0),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Coupon usage increment (only if coupon actually applied)
      if (couponApplied?.code) {
        const cRef = adminDb.collection("businesses").doc(String(quote.businessId)).collection("coupons").doc(couponApplied.code);
        t.set(cRef, { usedCount: FieldValue.increment(1), updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
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