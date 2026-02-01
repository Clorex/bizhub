import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hasActiveSubscription(biz: any) {
  const exp = Number(biz?.subscription?.expiresAtMs || 0);
  return !!(biz?.subscription?.planKey && exp && exp > Date.now());
}

function cleanCode(v: any) {
  const raw = String(v || "").trim().toUpperCase();
  const ok = /^[A-Z0-9]{3,20}$/.test(raw);
  return ok ? raw : "";
}

function clampInt(n: any, min: number, max: number) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function clampKobo(n: any) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, v);
}

export async function GET(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const snap = await adminDb
      .collection("businesses")
      .doc(me.businessId)
      .collection("coupons")
      .limit(200)
      .get();

    const coupons = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .sort((a, b) => String(a.codeUpper || a.id).localeCompare(String(b.codeUpper || b.id)));

    return NextResponse.json({ ok: true, coupons });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json({ ok: false, code: "VENDOR_LOCKED", error: "Subscribe to continue." }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    const { business } = await requireVendorUnlocked(me.businessId);

    // Coupons are an advanced feature: require active subscription
    if (!hasActiveSubscription(business)) {
      return NextResponse.json(
        { ok: false, code: "SUBSCRIPTION_REQUIRED", error: "Subscribe to create discount codes." },
        { status: 403 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const codeUpper = cleanCode(body.code);
    if (!codeUpper) {
      return NextResponse.json(
        { ok: false, error: "Code must be 3–20 characters (A–Z, 0–9) with no spaces." },
        { status: 400 }
      );
    }

    const type = String(body.type || "percent") === "fixed" ? "fixed" : "percent";

    // percent: 1–90
    const percent = clampInt(body.percent, 1, 90);

    // fixed: min 100 NGN, max 1,000,000 NGN
    const amountOffKobo = clampKobo(body.amountOffKobo);
    const minOrderKobo = clampKobo(body.minOrderKobo);
    const maxDiscountKobo = clampKobo(body.maxDiscountKobo);

    const startsAtMs = body.startsAtMs ? Number(body.startsAtMs) : null;
    const endsAtMs = body.endsAtMs ? Number(body.endsAtMs) : null;

    const usageLimitTotal = body.usageLimitTotal ? clampInt(body.usageLimitTotal, 1, 1000000) : null;

    const ref = adminDb.collection("businesses").doc(me.businessId).collection("coupons").doc(codeUpper);

    // Create/update coupon
    await ref.set(
      {
        businessId: me.businessId,
        businessSlug: business?.slug ?? me.businessSlug ?? null,

        codeUpper,
        code: codeUpper,

        active: body.active === false ? false : true,

        type, // percent | fixed
        percent: type === "percent" ? percent : null,
        amountOffKobo: type === "fixed" ? amountOffKobo : null,

        minOrderKobo: minOrderKobo || 0,
        maxDiscountKobo: maxDiscountKobo || null,

        startsAtMs: startsAtMs && Number.isFinite(startsAtMs) ? startsAtMs : null,
        endsAtMs: endsAtMs && Number.isFinite(endsAtMs) ? endsAtMs : null,

        usageLimitTotal,
        usedCount: FieldValue.increment(0),

        createdByUid: me.uid,
        createdAtMs: Date.now(),
        updatedAtMs: Date.now(),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, code: codeUpper });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json({ ok: false, code: "VENDOR_LOCKED", error: "Subscribe to continue." }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}