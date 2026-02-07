// FILE: src/app/api/orders/[orderId]/installments/[idx]/paystack/init/route.ts
import { NextResponse, type NextRequest } from "next/server";
import crypto from "node:crypto";
import { adminDb } from "@/lib/firebase/admin";
import { requireMe } from "@/lib/auth/server";
import { paymentsProvider } from "@/lib/payments/provider";
import { flwCreatePaymentLink } from "@/lib/payments/flutterwaveServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function lowerEmail(v: any) {
  return String(v || "").trim().toLowerCase();
}

function getBaseUrl(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto") || "http";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  return `${proto}://${host}`;
}

function genReference(orderId: string, idx: number) {
  return `inst_${orderId}_${idx}_${Date.now()}_${crypto.randomBytes(6).toString("hex")}`;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ orderId: string; idx: string }> }) {
  try {
    const me = await requireMe(req);

    const { orderId, idx } = await ctx.params;
    const orderIdClean = String(orderId || "").trim();
    const i = Math.floor(Number(idx));

    if (!orderIdClean) return NextResponse.json({ ok: false, error: "Missing orderId" }, { status: 400 });
    if (!Number.isFinite(i) || i < 0) {
      return NextResponse.json({ ok: false, error: "Invalid installment index" }, { status: 400 });
    }

    const snap = await adminDb.collection("orders").doc(orderIdClean).get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });

    const o = snap.data() as any;

    // ownership
    if (me.role === "customer") {
      const myEmail = lowerEmail(me.email);
      const orderEmail = lowerEmail(o?.customer?.email);
      if (!myEmail || !orderEmail || myEmail !== orderEmail) {
        return NextResponse.json({ ok: false, error: "Not allowed" }, { status: 403 });
      }
    }

    // This is your existing card-escrow order type (kept for compatibility)
    if (String(o?.paymentType || "") !== "paystack_escrow") {
      return NextResponse.json({ ok: false, error: "This is not a card/escrow order." }, { status: 400 });
    }

    const plan = o?.paymentPlan;
    const list = Array.isArray(plan?.installments) ? plan.installments : [];
    if (!plan?.enabled || list.length === 0) {
      return NextResponse.json({ ok: false, error: "No installment plan found on this order." }, { status: 400 });
    }
    if (!list[i]) return NextResponse.json({ ok: false, error: "Installment not found." }, { status: 404 });

    const inst = list[i];
    const status = String(inst?.status || "pending");
    if (status === "paid" || status === "accepted") {
      return NextResponse.json({ ok: false, error: "Installment already paid." }, { status: 400 });
    }

    const amountKobo = Number(inst?.amountKobo || 0);
    if (!Number.isFinite(amountKobo) || amountKobo <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid installment amount." }, { status: 400 });
    }

    const email = lowerEmail(o?.customer?.email || me.email || "");
    if (!email) return NextResponse.json({ ok: false, error: "Missing customer email." }, { status: 400 });

    const baseUrl = getBaseUrl(req);
    const redirect_url = `${baseUrl}/orders/${encodeURIComponent(orderIdClean)}?installmentIdx=${i}`;

    const provider = paymentsProvider();

    // -------------------------
    // Flutterwave (default)
    // -------------------------
    if (provider === "flutterwave") {
      const reference = genReference(orderIdClean, i);

      const { link } = await flwCreatePaymentLink({
        tx_ref: reference,
        amount: amountKobo / 100,
        currency: "NGN",
        redirect_url,
        customer: { email },
        title: "Bizhub Installment Payment",
        description: `Order ${orderIdClean.slice(0, 8)} • Installment ${i + 1}`,
        meta: {
          type: "installment",
          orderId: orderIdClean,
          installmentIdx: i,
          amountKobo,
          currency: "NGN",
        },
      });

      return NextResponse.json({
        ok: true,
        authorization_url: link,
        reference,
        provider: "flutterwave",
      });
    }

    // -------------------------
    // Paystack (kept, hidden)
    // -------------------------
    const secret = process.env.PAYSTACK_SECRET_KEY;
    if (!secret) return NextResponse.json({ ok: false, error: "Missing PAYSTACK_SECRET_KEY" }, { status: 500 });

    const body = {
      email,
      amount: amountKobo,
      currency: "NGN",
      callback_url: redirect_url,
      metadata: {
        orderId: orderIdClean,
        installmentIdx: i,
        type: "installment",
      },
    };

    const r = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await r.json().catch(() => ({} as any));
    if (!r.ok || data?.status !== true) {
      return NextResponse.json({ ok: false, error: data?.message || "Failed to start payment" }, { status: 400 });
    }

    return NextResponse.json({
      ok: true,
      authorization_url: data?.data?.authorization_url || null,
      reference: data?.data?.reference || null,
      provider: "paystack",
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}