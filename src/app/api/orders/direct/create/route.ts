import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { assertBuyerNotFrozen } from "@/lib/buyers/freezeServer";
import { buildQuote } from "@/lib/checkout/pricingServer";

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

function safeItems(items: any[]) {
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
  try {
    const body = await req.json().catch(() => ({} as any));

    const businessSlug = String(body.businessSlug || body.storeSlug || "").trim().toLowerCase();
    if (!businessSlug) {
      return NextResponse.json({ error: "businessSlug/storeSlug is required" }, { status: 400 });
    }

    const itemsRaw = Array.isArray(body.items) ? body.items : [];
    if (!itemsRaw.length) {
      return NextResponse.json({ error: "items required" }, { status: 400 });
    }

    const customer = body.customer ?? {};
    const shipping = cleanShipping(body.shipping);
    const shippingFeeKobo = Number(shipping?.feeKobo || 0);

    // ✅ Buyer freeze enforcement
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

    // Coupon code (optional)
    const couponCode = body?.coupon?.code ? cleanCode(body.coupon.code) : "";

    // ✅ Build server quote (sale first, then coupon)
    const quote = await buildQuote({
      storeSlug: businessSlug,
      items: safeItems(itemsRaw),
      couponCode: couponCode || null,
      shippingFeeKobo,
    });

    const amountKobo = Number(quote?.pricing?.totalKobo || 0);
    if (!Number.isFinite(amountKobo) || amountKobo <= 0) {
      return NextResponse.json({ error: "Invalid total" }, { status: 400 });
    }

    const amount = amountKobo / 100;

    const orderRef = adminDb.collection("orders").doc();
    const orderId = orderRef.id;

    const couponApplied =
      quote?.couponResult?.ok === true && Number(quote?.pricing?.couponDiscountKobo || 0) > 0 && couponCode
        ? {
            code: couponCode,
            discountKobo: Number(quote.pricing.couponDiscountKobo || 0),
          }
        : null;

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

    await orderRef.set({
      businessId: quote.businessId,
      businessSlug: businessSlug,

      items,
      customer: customer ?? {},

      coupon: couponApplied,
      shipping: shipping || null,

      paymentType: "direct_transfer",
      paymentStatus: "pending",
      escrowStatus: "none",
      orderStatus: "awaiting_vendor_confirmation",

      opsStatus: "new",
      opsUpdatedAtMs: Date.now(),

      currency: "NGN",
      amountKobo,
      amount,

      pricing: {
        ...quote.pricing,
        computedAtMs: Date.now(),
        rule: "sale_then_coupon",
      },

      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Keep coupon usage increment for direct transfer only if coupon applied
    if (couponApplied?.code) {
      await adminDb
        .collection("businesses")
        .doc(String(quote.businessId))
        .collection("coupons")
        .doc(couponApplied.code)
        .set(
          { usedCount: FieldValue.increment(1), updatedAtMs: Date.now(), updatedAt: FieldValue.serverTimestamp() },
          { merge: true }
        );
    }

    return NextResponse.json({ ok: true, orderId, amountKobo });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to create direct order" }, { status: 500 });
  }
}