// FILE: src/app/api/paystack/initialize/route.ts

import crypto from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";

import { assertBuyerNotFrozen } from "@/lib/buyers/freezeServer";
import { buildQuote } from "@/lib/checkout/pricingServer";
import { paymentsProvider } from "@/lib/payments/provider";
import { flwCreatePaymentLink } from "@/lib/payments/flutterwaveServer";
import { getBusinessPlanResolved } from "@/lib/vendor/planConfigServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function fxNgnPerUsd() {
  const v = process.env.FX_NGN_PER_USD || process.env.NGN_PER_USD || process.env.USD_NGN_RATE || "";
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function cleanChargeCurrency(v: any): "NGN" | "USD" {
  return String(v || "NGN").toUpperCase() === "USD" ? "USD" : "NGN";
}

function genReference(prefix: string) {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
}

function originFromReq(req: Request) {
  const o = req.headers.get("origin");
  if (o) return String(o).replace(/\/$/, "");

  const app = process.env.NEXT_PUBLIC_APP_URL || "";
  if (app) return String(app).replace(/\/$/, "");

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || "http";
  if (host) return `${proto}://${host}`;

  return "";
}

export async function POST(req: Request) {
  const provider = paymentsProvider();
  const paystackSecret = process.env.PAYSTACK_SECRET_KEY || "";

  try {
    const body = await req.json().catch(() => ({} as any));
    const email = String(body.email || "").trim();
    const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
    const requestedCurrency = cleanChargeCurrency(body.currency);

    if (!email) return Response.json({ error: "email is required" }, { status: 400 });

    // Buyer freeze enforcement
    try {
      const customer = metadata?.customer || {};
      await assertBuyerNotFrozen({
        phone: customer?.phone || null,
        email: customer?.email || email || null,
      });
    } catch (e: any) {
      if (e?.code === "BUYER_FROZEN") {
        return Response.json(
          { error: "Your account is currently restricted. Please resolve pending issues before making payments." },
          { status: 403 }
        );
      }
      return Response.json({ error: e?.message || "Blocked" }, { status: 403 });
    }

    // ✅ Robust callback URL (works on localhost too) - UPDATED
    const callback_url = `${originFromReq(req)}/order/success`;

    // Secure pricing recompute
    let amountKobo = Number(body.amountKobo || 0);

    const storeSlug = String(metadata?.storeSlug || "").trim();
    const itemsRaw = Array.isArray(metadata?.items) ? metadata.items : null;

    let vendorPlanKey: string = "FREE";
    let vendorHasActiveSub = false;
    let vendorUsdCheckoutEnabled = false;

    if (storeSlug && itemsRaw) {
      const items = safeItemsFromMetadata(itemsRaw);
      const couponCode = metadata?.coupon?.code ? String(metadata.coupon.code) : null;
      const shippingFeeKobo = metadata?.shipping?.feeKobo != null ? Number(metadata.shipping.feeKobo) : 0;

      const q = await buildQuote({
        storeSlug,
        items,
        couponCode,
        shippingFeeKobo,
      });

      amountKobo = Number(q?.pricing?.totalKobo || 0);

      metadata.items = Array.isArray(q.normalizedItems)
        ? q.normalizedItems.map((it: any) => ({
            productId: String(it.productId || ""),
            name: String(it.name || "Item"),
            qty: Number(it.qty || 1),
            price: Number(it.finalUnitPriceKobo || 0) / 100,
            selectedOptions: it.selectedOptions || null,
          }))
        : metadata.items;

      metadata.quote = {
        pricing: q.pricing,
        couponResult: q.couponResult || null,
        computedAtMs: Date.now(),
        source: "server",
      };

      if (couponCode) metadata.coupon = { code: String(couponCode).trim().toUpperCase() };

      const businessId = String(q?.businessId || "");
      if (businessId) {
        try {
          const resolved = await getBusinessPlanResolved(businessId);
          vendorPlanKey = String(resolved?.planKey || "FREE").toUpperCase();
          vendorHasActiveSub = !!resolved?.hasActiveSubscription;
          vendorUsdCheckoutEnabled = !!(resolved as any)?.features?.usdCheckout;
        } catch {
          // ignore
        }
      }
    }

    if (!Number.isFinite(amountKobo) || amountKobo <= 0) {
      return Response.json({ error: "amountKobo must be a positive number" }, { status: 400 });
    }

    const usdAllowed =
      vendorHasActiveSub && (vendorPlanKey === "MOMENTUM" || vendorPlanKey === "APEX") && vendorUsdCheckoutEnabled;

    const chargeCurrency: "NGN" | "USD" = requestedCurrency === "USD" && usdAllowed ? "USD" : "NGN";

    metadata.purpose = metadata.purpose || "escrow_checkout";
    metadata.charge = metadata.charge && typeof metadata.charge === "object" ? metadata.charge : {};
    metadata.charge.currency = chargeCurrency;
    metadata.charge.vendorPlanKey = vendorPlanKey;
    metadata.charge.vendorHasActiveSubscription = vendorHasActiveSub;
    metadata.charge.vendorUsdCheckoutEnabled = vendorUsdCheckoutEnabled;
    metadata.charge.usdAllowed = usdAllowed;

    let chargeAmountMajor = amountKobo / 100; // NGN major
    let amountMinor = amountKobo; // NGN kobo

    if (chargeCurrency === "USD") {
      const fx = fxNgnPerUsd();
      if (!fx) {
        return Response.json({ error: "USD payments not configured (missing FX_NGN_PER_USD)" }, { status: 500 });
      }

      // amountKobo is NGN kobo (NGN * 100). Divide by NGN/USD => USD * 100 => USD cents.
      const usdCents = Math.round(amountKobo / fx);
      if (!Number.isFinite(usdCents) || usdCents <= 0) {
        return Response.json({ error: "USD conversion failed" }, { status: 500 });
      }

      metadata.charge.fxNgnPerUsd = fx;
      metadata.charge.usdCents = usdCents;
      metadata.charge.ngnKobo = amountKobo;

      chargeAmountMajor = usdCents / 100;
      amountMinor = usdCents;
    } else {
      metadata.charge.ngnKobo = amountKobo;
    }

    // --------------------------
    // Flutterwave (default)
    // --------------------------
    if (provider === "flutterwave") {
      const reference = genReference("ord");

      // ✅ Save the full (nested) metadata server-side (Flutterwave meta is strict)
      await adminDb
        .collection("paymentSessions")
        .doc(reference)
        .set(
          {
            provider: "flutterwave",
            reference,
            storeSlug: String(metadata?.storeSlug || ""),
            email,
            currency: chargeCurrency,
            amountMinor,
            amountMajor: chargeAmountMajor,
            payload: metadata,
            createdAtMs: Date.now(),
            createdAt: FieldValue.serverTimestamp(),
            expiresAtMs: Date.now() + 24 * 60 * 60 * 1000, // 24h
          },
          { merge: true }
        );

      const customer = metadata?.customer || {};
      const customerName =
        String(customer?.fullName || customer?.name || "").trim().slice(0, 80) || "Customer";
      const customerPhone =
        String(customer?.phone || customer?.phonenumber || customer?.phone_number || "").trim().slice(0, 30) || undefined;

      const { link } = await flwCreatePaymentLink({
        tx_ref: reference,
        amount: chargeAmountMajor,
        currency: chargeCurrency,
        redirect_url: callback_url,
        customer: {
          email,
          name: customerName,
          phonenumber: customerPhone,
        },
        // ✅ Only flat meta (prevents "Invalid meta data passed")
        meta: { reference },
        title: "Bizhub Checkout",
        description: "Order payment",
        // optional: you can restrict methods by currency if you want later
        // payment_options: chargeCurrency === "USD" ? "card" : undefined,
      });

      return Response.json({
        authorization_url: link,
        reference,
        provider: "flutterwave",
        currency: chargeCurrency,
        amountMinor,
      });
    }

    // --------------------------
    // Paystack (NGN only)
    // --------------------------
    if (!paystackSecret) return Response.json({ error: "Missing PAYSTACK_SECRET_KEY" }, { status: 500 });
    if (chargeCurrency !== "NGN")
      return Response.json({ error: "USD checkout is only available on Flutterwave" }, { status: 400 });

    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount: amountKobo,
        callback_url,
        metadata: metadata ?? {},
      }),
    });

    const data = await res.json().catch(() => ({} as any));
    if (!data?.status) return Response.json({ error: data?.message || "Paystack init failed", raw: data }, { status: 400 });

    return Response.json({
      authorization_url: data.data.authorization_url,
      reference: data.data.reference,
      provider: "paystack",
      currency: "NGN",
      amountMinor: amountKobo,
    });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Init failed" }, { status: 500 });
  }
}