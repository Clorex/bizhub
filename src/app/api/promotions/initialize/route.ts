import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function appUrlFrom(req: Request) {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const u = new URL(req.url);
  return u.origin;
}

function clampInt(n: any, min: number, max: number) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

async function paystackInitialize(params: {
  email: string;
  amountKobo: number;
  callbackUrl: string;
  metadata: any;
}) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error("Missing PAYSTACK_SECRET_KEY");

  const res = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      callback_url: params.callbackUrl,
      metadata: params.metadata ?? {},
    }),
  });

  const data = await res.json();
  if (!data.status) throw new Error(data.message || "Paystack init failed");
  return data.data as { authorization_url: string; reference: string };
}

export async function POST(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });
    if (!me.email) return NextResponse.json({ ok: false, error: "Missing email" }, { status: 400 });

    // HARD LOCK
    await requireVendorUnlocked(me.businessId);

    const body = await req.json().catch(() => ({}));

    const productIdsRaw = Array.isArray(body.productIds) ? body.productIds : [];
    const productIds = productIdsRaw.map(String).filter(Boolean).slice(0, 5);
    if (productIds.length < 1) {
      return NextResponse.json({ ok: false, error: "Select at least 1 product" }, { status: 400 });
    }

    const days = clampInt(body.days, 2, 60);
    const dailyBudgetKobo = clampInt(body.dailyBudgetKobo, 1700 * 100, 500000 * 100);

    // Verify products belong to this vendor
    const pSnap = await adminDb
      .collection("products")
      .where("businessId", "==", me.businessId)
      .limit(500)
      .get();

    const owned = new Set(pSnap.docs.map((d) => d.id));
    for (const id of productIds) {
      if (!owned.has(id)) {
        return NextResponse.json({ ok: false, error: "One or more products not owned by you" }, { status: 403 });
      }
    }

    const totalBudgetKobo = dailyBudgetKobo * days;

    const callbackUrl = `${appUrlFrom(req)}/payment/promotion/callback`;

    const { authorization_url, reference } = await paystackInitialize({
      email: me.email,
      amountKobo: totalBudgetKobo,
      callbackUrl,
      metadata: {
        purpose: "promotion",
        businessId: me.businessId,
        businessSlug: me.businessSlug ?? null,
        ownerUid: me.uid,
        productIds,
        days,
        dailyBudgetKobo,
        totalBudgetKobo,
      },
    });

    return NextResponse.json({ ok: true, authorization_url, reference });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json(
        { ok: false, code: "VENDOR_LOCKED", error: "Your free access has ended. Subscribe to continue." },
        { status: 403 }
      );
    }
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}