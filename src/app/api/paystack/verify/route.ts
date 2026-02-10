// FILE: src/app/api/paystack/verify/route.ts

import { paymentsProvider } from "@/lib/payments/provider";
import { flwVerifyTransaction } from "@/lib/payments/flutterwaveServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function verifyPaystack(reference: string) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error("Missing PAYSTACK_SECRET_KEY");

  const res = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });

  const data = await res.json().catch(() => ({} as any));
  if (!data?.status) throw new Error(data?.message || "Verify failed");
  return data.data;
}

function normalizeMetadata(raw: any) {
  if (!raw) return {};
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw;
}

export async function POST(req: Request) {
  try {
    const provider = paymentsProvider();
    const body = await req.json().catch(() => ({} as any));

    const reference = String(body.reference || "").trim(); // paystack ref OR flutterwave tx_ref
    const transactionId = body.transactionId != null ? String(body.transactionId).trim() : "";

    // -------------------------
    // Flutterwave (default)
    // -------------------------
    if (provider === "flutterwave") {
      if (!transactionId) {
        return Response.json({ error: "transactionId is required for Flutterwave verify" }, { status: 400 });
      }

      const flwTx = await flwVerifyTransaction(transactionId);

      // If reference was provided, ensure it matches tx_ref
      if (reference && String((flwTx as any)?.tx_ref || "") !== reference) {
        return Response.json({ error: "Reference mismatch (tx_ref does not match reference)" }, { status: 400 });
      }

      const currency = String((flwTx as any)?.currency || "NGN").toUpperCase();
      const amountMajor = Number((flwTx as any)?.amount || 0);
      const amountMinor = Math.round(amountMajor * 100);

      return Response.json({
        provider: "flutterwave",
        status: String((flwTx as any)?.status || ""), // "successful"
        reference: String((flwTx as any)?.tx_ref || reference || ""),
        transactionId: Number((flwTx as any)?.id || 0) || null,

        // keep "amount" as minor-units for compatibility with old Paystack verify consumers
        amount: amountMinor,
        amountMinor,
        amountMajor,

        currency,
        paidAt: (flwTx as any)?.created_at || null,
        customer: (flwTx as any)?.customer || null,
        metadata: normalizeMetadata((flwTx as any)?.meta),
        raw: flwTx,
      });
    }

    // -------------------------
    // Paystack (kept, hidden)
    // -------------------------
    if (!reference) {
      return Response.json({ error: "reference is required" }, { status: 400 });
    }

    const ps = await verifyPaystack(reference);

    return Response.json({
      provider: "paystack",
      status: ps.status,
      reference: ps.reference,
      amount: ps.amount, // kobo (minor)
      amountMinor: ps.amount,
      amountMajor: Number(ps.amount || 0) / 100,
      paidAt: ps.paid_at,
      currency: ps.currency,
      customer: ps.customer,
      metadata: normalizeMetadata(ps.metadata),
      raw: ps,
    });
  } catch (e: any) {
    return Response.json({ error: e?.message || "Verify failed" }, { status: 500 });
  }
}