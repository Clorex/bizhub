import { NextResponse } from "next/server";
import { assertBuyerNotFrozen } from "@/lib/buyers/freezeServer";
import { buildQuote } from "@/lib/checkout/pricingServer";

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

export async function POST(req: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ error: "Missing PAYSTACK_SECRET_KEY" }, { status: 500 });
  }

  try {
    const body = await req.json().catch(() => ({} as any));
    const email = String(body.email || "").trim();
    const metadata = (body.metadata && typeof body.metadata === "object") ? body.metadata : {};

    if (!email) {
      return NextResponse.json({ error: "email is required" }, { status: 400 });
    }

    // ✅ Buyer freeze enforcement
    try {
      const customer = metadata?.customer || {};
      await assertBuyerNotFrozen({
        phone: customer?.phone || null,
        email: customer?.email || email || null,
      });
    } catch (e: any) {
      if (e?.code === "BUYER_FROZEN") {
        return NextResponse.json(
          { error: "Your account is currently restricted. Please resolve pending issues before making payments." },
          { status: 403 }
        );
      }
      return NextResponse.json({ error: e?.message || "Blocked" }, { status: 403 });
    }

    const callback_url = `${process.env.NEXT_PUBLIC_APP_URL}/payment/callback`;

    // ✅ Secure pricing: if this is a store checkout, recompute total from Firestore
    let amountKobo = Number(body.amountKobo || 0);

    const storeSlug = String(metadata?.storeSlug || "").trim();
    const itemsRaw = Array.isArray(metadata?.items) ? metadata.items : null;

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

      // Replace metadata items with normalized server priced items (final unit prices)
      metadata.items = Array.isArray(q.normalizedItems)
        ? q.normalizedItems.map((it: any) => ({
            productId: String(it.productId || ""),
            name: String(it.name || "Item"),
            qty: Number(it.qty || 1),
            price: Number(it.finalUnitPriceKobo || 0) / 100, // NGN unit price (final)
            selectedOptions: it.selectedOptions || null,
          }))
        : metadata.items;

      // Store server quote inside metadata (still recomputed again on confirm)
      metadata.quote = {
        pricing: q.pricing,
        couponResult: q.couponResult || null,
        computedAtMs: Date.now(),
        source: "server",
      };

      // Keep coupon code only (don’t trust client-provided discount numbers)
      if (couponCode) metadata.coupon = { code: String(couponCode).trim().toUpperCase() };
    }

    const amount = Number(amountKobo);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "amountKobo must be a positive number" }, { status: 400 });
    }

    const res = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        amount,
        callback_url,
        metadata: metadata ?? {},
      }),
    });

    const data = await res.json();

    if (!data.status) {
      return NextResponse.json({ error: data.message || "Paystack init failed", raw: data }, { status: 400 });
    }

    return NextResponse.json({
      authorization_url: data.data.authorization_url,
      reference: data.data.reference,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Paystack init failed" }, { status: 500 });
  }
}