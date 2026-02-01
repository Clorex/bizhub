import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) {
    return NextResponse.json(
      { error: "Missing PAYSTACK_SECRET_KEY" },
      { status: 500 }
    );
  }

  const { reference } = await req.json();
  if (!reference) {
    return NextResponse.json({ error: "reference is required" }, { status: 400 });
  }

  const res = await fetch(
    `https://api.paystack.co/transaction/verify/${reference}`,
    {
      headers: { Authorization: `Bearer ${secret}` },
    }
  );

  const data = await res.json();

  if (!data.status) {
    return NextResponse.json(
      { error: data.message || "Verify failed", raw: data },
      { status: 400 }
    );
  }

  return NextResponse.json({
    status: data.data.status, // "success" | etc
    reference: data.data.reference,
    amount: data.data.amount,
    paidAt: data.data.paid_at,
    currency: data.data.currency,
    customer: data.data.customer,
    metadata: data.data.metadata,
  });
}