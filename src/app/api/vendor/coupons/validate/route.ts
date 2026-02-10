
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanCode(v: any) {
  const raw = String(v || "").trim().toUpperCase();
  const ok = /^[A-Z0-9]{3,20}$/.test(raw);
  return ok ? raw : "";
}

function clampKobo(n: any) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, v);
}

function computeDiscount(params: {
  type: "percent" | "fixed";
  percent?: number | null;
  amountOffKobo?: number | null;
  subtotalKobo: number;
  maxDiscountKobo?: number | null;
}) {
  const subtotal = params.subtotalKobo;

  let discount = 0;

  if (params.type === "percent") {
    const pct = Math.max(0, Math.min(90, Number(params.percent || 0)));
    discount = Math.floor((subtotal * pct) / 100);
  } else {
    discount = Math.floor(Number(params.amountOffKobo || 0));
  }

  if (params.maxDiscountKobo != null) {
    discount = Math.min(discount, Math.floor(Number(params.maxDiscountKobo || 0)));
  }

  discount = Math.max(0, Math.min(discount, subtotal));
  return discount;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const storeSlug = String(body.storeSlug || "").trim();
    const codeUpper = cleanCode(body.code);
    const subtotalKobo = clampKobo(body.subtotalKobo);

    if (!storeSlug) return Response.json({ ok: false, error: "storeSlug required" }, { status: 400 });
    if (!codeUpper) return Response.json({ ok: false, error: "Invalid code format" }, { status: 400 });
    if (subtotalKobo <= 0) return Response.json({ ok: false, error: "Invalid subtotal" }, { status: 400 });

    // Find business by slug
    const bizSnap = await adminDb
      .collection("businesses")
      .where("slug", "==", storeSlug)
      .limit(1)
      .get();

    if (bizSnap.empty) {
      return Response.json({ ok: false, error: "Store not found" }, { status: 404 });
    }

    const bizDoc = bizSnap.docs[0];
    const businessId = bizDoc.id;

    const cSnap = await adminDb
      .collection("businesses")
      .doc(businessId)
      .collection("coupons")
      .doc(codeUpper)
      .get();

    if (!cSnap.exists) {
      return Response.json({ ok: false, code: "NOT_FOUND", error: "Invalid code" }, { status: 404 });
    }

    const c = cSnap.data() as any;
    const now = Date.now();

    if (c.active === false) {
      return Response.json({ ok: false, code: "INACTIVE", error: "Code is inactive" }, { status: 400 });
    }

    const startsAtMs = c.startsAtMs ? Number(c.startsAtMs) : null;
    const endsAtMs = c.endsAtMs ? Number(c.endsAtMs) : null;

    if (startsAtMs && now < startsAtMs) {
      return Response.json({ ok: false, code: "NOT_STARTED", error: "Code not active yet" }, { status: 400 });
    }
    if (endsAtMs && now > endsAtMs) {
      return Response.json({ ok: false, code: "EXPIRED", error: "Code expired" }, { status: 400 });
    }

    const minOrderKobo = clampKobo(c.minOrderKobo);
    if (minOrderKobo && subtotalKobo < minOrderKobo) {
      return Response.json(
        { ok: false, code: "MIN_ORDER", error: "Order total is too low for this code", minOrderKobo },
        { status: 400 }
      );
    }

    const usageLimitTotal = c.usageLimitTotal != null ? Number(c.usageLimitTotal) : null;
    const usedCount = Number(c.usedCount || 0);

    if (usageLimitTotal != null && usedCount >= usageLimitTotal) {
      return Response.json({ ok: false, code: "LIMIT_REACHED", error: "Code usage limit reached" }, { status: 400 });
    }

    const type = String(c.type || "percent") === "fixed" ? "fixed" : "percent";

    const discountKobo = computeDiscount({
      type,
      percent: c.percent ?? null,
      amountOffKobo: c.amountOffKobo ?? null,
      subtotalKobo,
      maxDiscountKobo: c.maxDiscountKobo ?? null,
    });

    const totalKobo = Math.max(0, subtotalKobo - discountKobo);

    return Response.json({
      ok: true,
      coupon: {
        code: codeUpper,
        type,
        percent: c.percent ?? null,
        amountOffKobo: c.amountOffKobo ?? null,
        minOrderKobo: minOrderKobo || 0,
        maxDiscountKobo: c.maxDiscountKobo ?? null,
      },
      subtotalKobo,
      discountKobo,
      totalKobo,
    });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}