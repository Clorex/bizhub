// FILE: src/app/api/subscriptions/initialize/route.ts

import crypto from "node:crypto";
import { requireRole } from "@/lib/auth/server";
import { paymentsProvider } from "@/lib/payments/provider";
import { flwCreatePaymentLink } from "@/lib/payments/flutterwaveServer";
import {
  priceKoboFor,
  type BizhubBillingCycle,
  type BizhubPlanKey,
} from "@/lib/bizhubPlans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function appUrlFrom(req: Request) {
  const env = process.env.NEXT_PUBLIC_APP_URL;
  if (env) return env.replace(/\/$/, "");
  const u = new URL(req.url);
  return u.origin;
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

  const data = await res.json().catch(() => ({} as any));
  if (!data.status) throw new Error(data.message || "Paystack init failed");
  return data.data as { authorization_url: string; reference: string };
}

function genReference(prefix: string) {
  // Short + unique enough for tx_ref/doc ids
  return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
}

export async function POST(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) return Response.json({ ok: false, error: "Missing businessId" }, { status: 400 });
    if (!me.email) return Response.json({ ok: false, error: "Missing email" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const planKey = String(body.planKey || "") as BizhubPlanKey;
    const cycle = String(body.cycle || "") as BizhubBillingCycle;

    const allowedPlans: BizhubPlanKey[] = ["LAUNCH", "MOMENTUM", "APEX"];
    const allowedCycles: BizhubBillingCycle[] = ["monthly", "quarterly", "biannually", "yearly"];

    if (!allowedPlans.includes(planKey)) {
      return Response.json({ ok: false, error: "Invalid planKey" }, { status: 400 });
    }
    if (!allowedCycles.includes(cycle)) {
      return Response.json({ ok: false, error: "Invalid cycle" }, { status: 400 });
    }

    const amountKobo = priceKoboFor(planKey, cycle);
    if (amountKobo <= 0) return Response.json({ ok: false, error: "Invalid amount" }, { status: 400 });

    const callbackUrl = `${appUrlFrom(req)}/payment/subscription/callback`;

    const provider = paymentsProvider();

    // -------------------------
    // Flutterwave (default)
    // -------------------------
    if (provider === "flutterwave") {
      const reference = genReference("sub");

      const amountMajor = amountKobo / 100; // NGN major
      const { link } = await flwCreatePaymentLink({
        tx_ref: reference,
        amount: amountMajor,
        currency: "NGN",
        redirect_url: callbackUrl,
        customer: { email: me.email },
        title: "Bizhub Subscription",
        description: `${planKey} • ${cycle}`,
        meta: {
          purpose: "subscription",
          businessId: me.businessId,
          businessSlug: me.businessSlug ?? null,
          ownerUid: me.uid,
          planKey,
          cycle,
          amountKobo,
        },
      });

      return Response.json({ ok: true, authorization_url: link, reference });
    }

    // -------------------------
    // Paystack (kept, hidden)
    // -------------------------
    const { authorization_url, reference } = await paystackInitialize({
      email: me.email,
      amountKobo,
      callbackUrl,
      metadata: {
        purpose: "subscription",
        businessId: me.businessId,
        businessSlug: me.businessSlug ?? null,
        ownerUid: me.uid,
        planKey,
        cycle,
        amountKobo,
      },
    });

    return Response.json({ ok: true, authorization_url, reference });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}