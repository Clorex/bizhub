// FILE: src/app/api/vendor/purchases/initialize/route.ts
import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { getBusinessPlanResolved } from "@/lib/vendor/planConfigServer";
import { findAddonBySku } from "@/lib/vendor/addons/catalog";
import { paymentsProvider } from "@/lib/payments/provider";
import { flwCreatePaymentLink } from "@/lib/payments/flutterwaveServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AddonCycle = "monthly" | "yearly";

function cleanCycle(v: any): AddonCycle {
  return String(v || "yearly").toLowerCase() === "monthly" ? "monthly" : "yearly";
}

function cleanPlanKey(v: any) {
  const k = String(v || "FREE").toUpperCase();
  return k === "LAUNCH" || k === "MOMENTUM" || k === "APEX" ? k : "FREE";
}

function isSubscriptionActive(biz: any) {
  const exp = Number(biz?.subscription?.expiresAtMs || 0);
  return !!(biz?.subscription?.planKey && exp && exp > Date.now());
}

function baseUrlFromReq(req: Request) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto") || (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function paystackSecret() {
  return process.env.PAYSTACK_SECRET_KEY || process.env.PAYSTACK_SECRET || process.env.PAYSTACK_PRIVATE_KEY || "";
}

async function paystackInitialize(args: {
  email: string;
  amountKobo: number;
  reference: string;
  callbackUrl: string;
  metadata: any;
}) {
  const sk = paystackSecret();
  if (!sk) throw new Error("Missing PAYSTACK_SECRET_KEY env");

  const r = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${sk}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: args.email,
      amount: args.amountKobo,
      reference: args.reference,
      callback_url: args.callbackUrl,
      metadata: args.metadata,
    }),
  });

  const j = await r.json().catch(() => ({} as any));
  if (!r.ok || !j?.status) throw new Error(j?.message || "Paystack initialize failed");
  return j?.data as { authorization_url?: string; access_code?: string; reference?: string };
}

function genReference() {
  return `addon_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
}

export async function POST(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    const body = await req.json().catch(() => ({} as any));
    const sku = String(body.sku || "").trim();
    const cycle = cleanCycle(body.cycle);

    if (!sku) return NextResponse.json({ ok: false, error: "sku is required" }, { status: 400 });

    const addon = findAddonBySku(sku);
    if (!addon) return NextResponse.json({ ok: false, error: "Unknown add-on" }, { status: 400 });

    const plan = await getBusinessPlanResolved(me.businessId);
    const planKey = cleanPlanKey(plan.planKey);
    const biz = plan.business || {};

    // Only allow buying add-ons for your current plan
    if (planKey !== addon.plan) {
      return NextResponse.json({ ok: false, error: `This add-on is only available for ${addon.plan} plan.` }, { status: 403 });
    }

    // Require subscription active
    if (!isSubscriptionActive(biz)) {
      return NextResponse.json(
        { ok: false, error: "Your subscription is not active. Renew subscription to buy add-ons." },
        { status: 403 }
      );
    }

    const priceNgn = Number(addon.priceNgn?.[cycle] || 0);
    if (!Number.isFinite(priceNgn) || priceNgn <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid add-on price" }, { status: 400 });
    }

    // Determine email
    let email = String((me as any)?.email || "").trim();
    if (!email) {
      const uSnap = await adminDb.collection("users").doc(me.uid).get();
      const u = uSnap.exists ? (uSnap.data() as any) : {};
      email = String(u.email || u.emailLower || "").trim();
    }
    if (!email || !email.includes("@")) {
      return NextResponse.json({ ok: false, error: "Missing account email for payment" }, { status: 400 });
    }

    const reference = genReference();
    const origin = baseUrlFromReq(req);
    const callbackUrl = `${origin}/vendor/purchases/callback`;

    // Save intent (idempotency + validation)
    await adminDb.collection("addonPurchaseIntents").doc(reference).set({
      reference,
      businessId: me.businessId,
      uid: me.uid,
      planKey,
      sku: addon.sku,
      cycle,
      kind: addon.kind,
      amountNgn: priceNgn,
      amountKobo: Math.round(priceNgn * 100),
      createdAtMs: Date.now(),
      providerHint: paymentsProvider(),
    });

    const provider = paymentsProvider();

    // -------------------------
    // Flutterwave (default)
    // -------------------------
    if (provider === "flutterwave") {
      const { link } = await flwCreatePaymentLink({
        tx_ref: reference,
        amount: priceNgn, // NGN major
        currency: "NGN",
        redirect_url: callbackUrl,
        customer: { email },
        title: "Bizhub Add-on Purchase",
        description: `${addon.title ?? addon.sku} • ${cycle}`,
        meta: {
          type: "addon",
          businessId: me.businessId,
          uid: me.uid,
          sku: addon.sku,
          cycle,
          planKey,
        },
      });

      return NextResponse.json({
        ok: true,
        reference,
        authorization_url: link,
        access_code: null,
      });
    }

    // -------------------------
    // Paystack (kept, hidden)
    // -------------------------
    const data = await paystackInitialize({
      email,
      amountKobo: Math.round(priceNgn * 100),
      reference,
      callbackUrl,
      metadata: {
        type: "addon",
        businessId: me.businessId,
        uid: me.uid,
        sku: addon.sku,
        cycle,
        planKey,
      },
    });

    return NextResponse.json({
      ok: true,
      reference,
      authorization_url: data?.authorization_url,
      access_code: data?.access_code,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}