// FILE: src/app/api/escrow/confirm/route.ts
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { buildQuote } from "@/lib/checkout/pricingServer";
import { paymentsProvider } from "@/lib/payments/provider";
import { flwVerifyTransaction } from "@/lib/payments/flutterwaveServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function verifyPaystack(reference: string) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error("Missing PAYSTACK_SECRET_KEY");

  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });

  const data = await res.json().catch(() => ({} as any));
  if (!data.status) throw new Error(data.message || "Paystack verify failed");
  return data.data;
}

function fxNgnPerUsd() {
  const v = process.env.FX_NGN_PER_USD || process.env.NGN_PER_USD || process.env.USD_NGN_RATE || "";
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
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
    const body = await req.json().catch(() => ({} as any));
    const reference = String(body.reference || "").trim();
    const transactionId = body.transactionId != null ? String(body.transactionId).trim() : "";

    if (!reference) return NextResponse.json({ error: "reference is required" }, { status: 400 });

    const provider = paymentsProvider();

    let paidStatus = "";
    let paidCurrency = "NGN";
    let paidMinor = 0;
    let paidAt: any = null;
    let channel: any = null;
    let rawMetadata: any = {};
    let providerName: "paystack" | "flutterwave" = "paystack";
    let flutterwaveTxId: number | null = null;

    if (provider === "flutterwave") {
      if (!transactionId) {
        return NextResponse.json({ error: "transactionId is required for Flutterwave confirmation" }, { status: 400 });
      }

      const flwTx = await flwVerifyTransaction(transactionId);

      paidStatus = String(flwTx?.status || "");
      if (String(paidStatus).toLowerCase() !== "successful") {
        return NextResponse.json({ error: `Payment not successful: ${paidStatus}`, raw: flwTx }, { status: 400 });
      }

      if (String(flwTx?.tx_ref || "") !== reference) {
        return NextResponse.json({ error: "Reference mismatch (tx_ref does not match reference)" }, { status: 400 });
      }

      paidCurrency = String(flwTx?.currency || "NGN").toUpperCase();
      const amtMajor = Number((flwTx as any)?.amount || 0);
      if (!Number.isFinite(amtMajor) || amtMajor <= 0) {
        return NextResponse.json({ error: "Invalid amount from Flutterwave" }, { status: 400 });
      }

      paidMinor = Math.round(amtMajor * 100);
      paidAt = (flwTx as any)?.created_at || null;
      channel = null;

      // ✅ IMPORTANT: do not trust Flutterwave meta for full cart payload.
      // Load server-side session saved during initialize.
      const sessSnap = await adminDb.collection("paymentSessions").doc(reference).get();
      const sess = sessSnap.exists ? (sessSnap.data() as any) : null;

      if (sess?.payload) {
        rawMetadata = sess.payload;
      } else {
        // fallback (best-effort) if session missing
        rawMetadata = normalizeMetadata((flwTx as any)?.meta);
      }

      providerName = "flutterwave";
      flutterwaveTxId = Number((flwTx as any)?.id || 0) || null;
    } else {
      const paystackTx = await verifyPaystack(reference);

      paidStatus = String(paystackTx.status || "");
      if (paidStatus !== "success") {
        return NextResponse.json({ error: `Payment not successful: ${paidStatus}`, raw: paystackTx }, { status: 400 });
      }

      paidCurrency = String(paystackTx.currency || "NGN").toUpperCase();
      paidMinor = Number(paystackTx.amount || 0);
      paidAt = paystackTx.paid_at || null;
      channel = paystackTx.channel || null;
      rawMetadata = normalizeMetadata(paystackTx.metadata);
      providerName = "paystack";
    }

    const metadata = rawMetadata || {};
    const storeSlug = String(metadata.storeSlug || metadata.businessSlug || metadata.slug || "").trim();

    if (!storeSlug) {
      return NextResponse.json({ error: "Missing storeSlug in metadata (expected metadata.storeSlug)" }, { status: 400 });
    }

    const itemsMeta = safeItemsFromMetadata(Array.isArray(metadata.items) ? metadata.items : []);
    if (itemsMeta.length < 1) return NextResponse.json({ error: "Missing items in metadata" }, { status: 400 });

    const couponCode = metadata?.coupon?.code ? String(metadata.coupon.code) : null;
    const shipping = cleanShipping(metadata.shipping);
    const shippingFeeKobo = Number(shipping?.feeKobo || 0);

    const quote = await buildQuote({
      storeSlug,
      items: itemsMeta,
      couponCode,
      shippingFeeKobo,
    });

    const expectedKobo = Number(quote?.pricing?.totalKobo || 0);
    if (!Number.isFinite(expectedKobo) || expectedKobo <= 0) return NextResponse.json({ error: "Invalid total" }, { status: 400 });
    if (!Number.isFinite(paidMinor) || paidMinor <= 0) return NextResponse.json({ error: "Invalid paid amount" }, { status: 400 });

    const chargeCurrency = String(metadata?.charge?.currency || paidCurrency || "NGN").toUpperCase();

    if (chargeCurrency === "USD") {
      const fx = fxNgnPerUsd();
      if (!fx) return NextResponse.json({ error: "USD payments not configured (missing FX_NGN_PER_USD)" }, { status: 500 });

      const expectedUsdCents = Math.round(expectedKobo / fx);

      if (paidCurrency !== "USD") return NextResponse.json({ error: "Currency mismatch (expected USD)" }, { status: 400 });

      if (paidMinor !== expectedUsdCents) {
        await adminDb.collection("paymentMismatches").doc(String(reference)).set(
          {
            reference: String(reference),
            storeSlug,
            expectedKobo,
            expectedUsdCents,
            paidUsdCents: paidMinor,
            currency: "USD",
            provider: providerName,
            flutterwaveTxId,
            createdAtMs: Date.now(),
            createdAt: FieldValue.serverTimestamp(),
            quotePricing: quote.pricing,
          },
          { merge: true }
        );

        return NextResponse.json(
          { error: "Amount mismatch. Please refresh checkout and try again.", code: "AMOUNT_MISMATCH", expectedUsdCents, paidUsdCents: paidMinor },
          { status: 400 }
        );
      }
    } else {
      if (paidCurrency !== "NGN") return NextResponse.json({ error: "Currency mismatch (expected NGN)" }, { status: 400 });

      if (paidMinor !== expectedKobo) {
        await adminDb.collection("paymentMismatches").doc(String(reference)).set(
          {
            reference: String(reference),
            storeSlug,
            expectedKobo,
            paidKobo: paidMinor,
            currency: "NGN",
            provider: providerName,
            flutterwaveTxId,
            createdAtMs: Date.now(),
            createdAt: FieldValue.serverTimestamp(),
            quotePricing: quote.pricing,
          },
          { merge: true }
        );

        return NextResponse.json(
          { error: "Amount mismatch. Please refresh checkout and try again.", code: "AMOUNT_MISMATCH", expectedKobo, paidKobo: paidMinor },
          { status: 400 }
        );
      }
    }

    const customer = metadata.customer || {};

    const nowMs = Date.now();
    const holdMs = 5 * 60 * 1000;
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
          provider: providerName,
          reference: String(reference),
          status: providerName === "flutterwave" ? "successful" : "success",
          channel: channel || null,
          paidAt: paidAt || null,
          flutterwaveTxId,
          chargeCurrency: chargeCurrency === "USD" ? "USD" : "NGN",
          chargeMinor: paidMinor,
          fxNgnPerUsd: chargeCurrency === "USD" ? fxNgnPerUsd() : null,
        },

        escrowStatus: "held",
        orderStatus: "paid_held",

        opsStatus: "paid",
        opsUpdatedAtMs: nowMs,

        currency: "NGN",
        amountKobo: expectedKobo,
        amount: expectedKobo / 100,

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

        currency: "NGN",
        amountKobo: expectedKobo,
        amount: expectedKobo / 100,

        chargeCurrency: chargeCurrency === "USD" ? "USD" : "NGN",
        chargeMinor: paidMinor,
        provider: providerName,
        reference: String(reference),
        flutterwaveTxId,

        status: "held",
        holdUntilMs,
        pricing: quote.pricing,
        createdAt: FieldValue.serverTimestamp(),
      });

      const walletRef = adminDb.collection("wallets").doc(String(quote.businessId));
      t.set(
        walletRef,
        {
          businessId: quote.businessId,
          pendingBalanceKobo: FieldValue.increment(expectedKobo),
          availableBalanceKobo: FieldValue.increment(0),
          totalEarnedKobo: FieldValue.increment(0),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      if (couponApplied?.code) {
        const cRef = adminDb.collection("businesses").doc(String(quote.businessId)).collection("coupons").doc(couponApplied.code);
        t.set(
          cRef,
          { usedCount: FieldValue.increment(1), updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
      }

      return { ok: true, orderId, businessSlug: storeSlug, escrowStatus: "held", holdUntilMs, alreadyProcessed: false };
    });

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Escrow confirm failed" }, { status: 500 });
  }
}