// FILE: src/app/api/paystack/initialize/route.ts
import { NextResponse } from "next/server";
import { assertBuyerNotFrozen } from "@/lib/buyers/freezeServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    return NextResponse.json({ error: "Missing PAYSTACK_SECRET_KEY" }, { status: 500 });
  }

  const body = await req.json();
  const { email, amountKobo, metadata } = body;

  if (!email || !amountKobo) {
    return NextResponse.json({ error: "email and amountKobo are required" }, { status: 400 });
  }

  const amount = Number(amountKobo);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "amountKobo must be a positive number" }, { status: 400 });
  }

  // ✅ Batch 4: buyer freeze enforcement (blocks payments until resolved)
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
}