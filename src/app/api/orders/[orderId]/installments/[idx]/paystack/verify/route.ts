// FILE: src/app/api/orders/[orderId]/installments/[idx]/paystack/verify/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireMe } from "@/lib/auth/server";
import { FieldValue } from "firebase-admin/firestore";
import { paymentsProvider } from "@/lib/payments/provider";
import { flwVerifyTransaction } from "@/lib/payments/flutterwaveServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function lowerEmail(v: any) {
  return String(v || "").trim().toLowerCase();
}

function isSettled(status: string) {
  const s = String(status || "");
  return s === "paid" || s === "accepted";
}

function computePaidKobo(installments: any[]) {
  return (Array.isArray(installments) ? installments : []).reduce((sum, x) => {
    return sum + (isSettled(String(x?.status || "")) ? Number(x?.amountKobo || 0) : 0);
  }, 0);
}

function allSettled(installments: any[]) {
  const arr = Array.isArray(installments) ? installments : [];
  return arr.length > 0 && arr.every((x) => isSettled(String(x?.status || "")));
}

async function paystackVerify(reference: string) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error("Missing PAYSTACK_SECRET_KEY");

  const r = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });

  const data = await r.json().catch(() => ({} as any));
  if (!r.ok || data?.status !== true) throw new Error(data?.message || "Failed to verify payment");
  return data?.data;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ orderId: string; idx: string }> }) {
  try {
    const me = await requireMe(req);

    const { orderId, idx } = await ctx.params;
    const orderIdClean = String(orderId || "").trim();
    const i = Math.floor(Number(idx));

    if (!orderIdClean) return NextResponse.json({ ok: false, error: "Missing orderId" }, { status: 400 });
    if (!Number.isFinite(i) || i < 0) {
      return NextResponse.json({ ok: false, error: "Invalid installment index" }, { status: 400 });
    }

    const url = new URL(req.url);

    // reference == Paystack reference OR Flutterwave tx_ref
    const reference = String(url.searchParams.get("reference") || url.searchParams.get("tx_ref") || "").trim();

    // Flutterwave transaction id (required when provider=flutterwave)
    const transactionId = String(
      url.searchParams.get("transactionId") || url.searchParams.get("transaction_id") || ""
    ).trim();

    if (!reference) return NextResponse.json({ ok: false, error: "Missing reference" }, { status: 400 });

    const ref = adminDb.collection("orders").doc(orderIdClean);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });

    const o = snap.data() as any;

    // ownership (email based)
    if (me.role === "customer") {
      const myEmail = lowerEmail(me.email);
      const orderEmail = lowerEmail(o?.customer?.email);
      if (!myEmail || !orderEmail || myEmail !== orderEmail) {
        return NextResponse.json({ ok: false, error: "Not allowed" }, { status: 403 });
      }
    }

    if (String(o?.paymentType || "") !== "paystack_escrow") {
      return NextResponse.json({ ok: false, error: "This is not a card/escrow order." }, { status: 400 });
    }

    const plan = o?.paymentPlan;
    const list = Array.isArray(plan?.installments) ? plan.installments : [];
    if (!plan?.enabled || list.length === 0) {
      return NextResponse.json({ ok: false, error: "No installment plan on this order." }, { status: 400 });
    }

    if (i >= list.length) return NextResponse.json({ ok: false, error: "Installment not found." }, { status: 404 });

    const inst = list[i] || {};
    if (isSettled(String(inst?.status || ""))) {
      return NextResponse.json({ ok: true, alreadyPaid: true });
    }

    const provider = paymentsProvider();

    // -------------------------
    // Flutterwave (default)
    // -------------------------
    if (provider === "flutterwave") {
      if (!transactionId) {
        return NextResponse.json({ ok: false, error: "Missing transactionId (required for Flutterwave verify)" }, { status: 400 });
      }

      const flwTx = await flwVerifyTransaction(transactionId);

      const st = String((flwTx as any)?.status || "").toLowerCase();
      if (st !== "successful") {
        return NextResponse.json({ ok: false, error: "Payment is not successful." }, { status: 400 });
      }

      if (String((flwTx as any)?.tx_ref || "") !== reference) {
        return NextResponse.json({ ok: false, error: "Reference mismatch (tx_ref does not match reference)." }, { status: 400 });
      }

      const currency = String((flwTx as any)?.currency || "NGN").toUpperCase();
      if (currency !== "NGN") {
        return NextResponse.json({ ok: false, error: "Invalid currency." }, { status: 400 });
      }

      const paidAmountKobo = Math.round(Number((flwTx as any)?.amount || 0) * 100);
      const expectedKobo = Number(inst?.amountKobo || 0);

      if (!Number.isFinite(paidAmountKobo) || paidAmountKobo <= 0) {
        return NextResponse.json({ ok: false, error: "Invalid amount from Flutterwave." }, { status: 400 });
      }

      if (paidAmountKobo !== expectedKobo) {
        return NextResponse.json({ ok: false, error: "Amount does not match this installment." }, { status: 400 });
      }

      // email best-effort check
      const orderEmail = lowerEmail(o?.customer?.email);
      const flwEmail = lowerEmail((flwTx as any)?.customer?.email || "");
      if (orderEmail && flwEmail && orderEmail !== flwEmail) {
        return NextResponse.json({ ok: false, error: "Customer email does not match this order." }, { status: 400 });
      }

      // meta best-effort check
      const metaOrderId = String((flwTx as any)?.meta?.orderId || "");
      const metaIdx = Number((flwTx as any)?.meta?.installmentIdx);
      if (metaOrderId && metaOrderId !== orderIdClean) {
        return NextResponse.json({ ok: false, error: "Payment reference does not belong to this order." }, { status: 400 });
      }
      if (Number.isFinite(metaIdx) && metaIdx !== i) {
        return NextResponse.json({ ok: false, error: "Payment reference does not belong to this installment." }, { status: 400 });
      }

      const now = Date.now();
      const next = [...list];
      next[i] = {
        ...inst,
        status: "paid",
        submittedAtMs: now,
        reviewedAtMs: now,
        rejectReason: null,
        paystack: null,
        flutterwave: {
          tx_ref: reference,
          transactionId: Number((flwTx as any)?.id || 0) || null,
          amountKobo: paidAmountKobo,
          verifiedAtMs: now,
          paidAtMs: (flwTx as any)?.created_at ? new Date(String((flwTx as any).created_at)).getTime() : null,
        },
      };

      const paidKobo = computePaidKobo(next);
      const totalKobo = Number(plan?.totalKobo || o?.amountKobo || 0);
      const completed = allSettled(next) && paidKobo === Number(totalKobo || 0);

      const patch: any = {
        updatedAt: FieldValue.serverTimestamp(),
        paymentPlan: {
          ...plan,
          installments: next,
          paidKobo,
          completed,
          completedAtMs: completed ? now : null,
          updatedAtMs: now,
        },
      };

      if (completed) {
        patch.paymentStatus = "confirmed";
        patch.orderStatus = "paid";
        patch.opsStatus = "paid";
        patch.opsUpdatedAtMs = now;
      }

      await ref.set(patch, { merge: true });
      return NextResponse.json({ ok: true, completed });
    }

    // -------------------------
    // Paystack (kept, hidden)
    // -------------------------
    const verified = await paystackVerify(reference);

    const status = String(verified?.status || "").toLowerCase();
    if (status !== "success") {
      return NextResponse.json({ ok: false, error: "Payment is not successful." }, { status: 400 });
    }

    const currency = String(verified?.currency || "NGN").toUpperCase();
    if (currency !== "NGN") {
      return NextResponse.json({ ok: false, error: "Invalid currency." }, { status: 400 });
    }

    const paidAmountKobo = Number(verified?.amount || 0);
    const expectedKobo = Number(inst?.amountKobo || 0);

    if (!Number.isFinite(paidAmountKobo) || paidAmountKobo <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid amount from Paystack." }, { status: 400 });
    }

    if (paidAmountKobo !== expectedKobo) {
      return NextResponse.json({ ok: false, error: "Amount does not match this installment." }, { status: 400 });
    }

    const orderEmail = lowerEmail(o?.customer?.email);
    const psEmail = lowerEmail(verified?.customer?.email || "");
    if (orderEmail && psEmail && orderEmail !== psEmail) {
      return NextResponse.json({ ok: false, error: "Paystack email does not match this order." }, { status: 400 });
    }

    const metaOrderId = String(verified?.metadata?.orderId || verified?.metadata?.order_id || "");
    if (metaOrderId && metaOrderId !== orderIdClean) {
      return NextResponse.json({ ok: false, error: "Payment reference does not belong to this order." }, { status: 400 });
    }

    const now = Date.now();
    const next = [...list];
    next[i] = {
      ...inst,
      status: "paid",
      submittedAtMs: now,
      reviewedAtMs: now,
      rejectReason: null,
      paystack: {
        reference,
        amountKobo: paidAmountKobo,
        verifiedAtMs: now,
        paidAtMs: verified?.paid_at ? new Date(String(verified.paid_at)).getTime() : null,
        channel: verified?.channel || null,
      },
      flutterwave: null,
    };

    const paidKobo = computePaidKobo(next);
    const totalKobo = Number(plan?.totalKobo || o?.amountKobo || 0);
    const completed = allSettled(next) && paidKobo === Number(totalKobo || 0);

    const patch: any = {
      updatedAt: FieldValue.serverTimestamp(),
      paymentPlan: {
        ...plan,
        installments: next,
        paidKobo,
        completed,
        completedAtMs: completed ? now : null,
        updatedAtMs: now,
      },
    };

    if (completed) {
      patch.paymentStatus = "confirmed";
      patch.orderStatus = "paid";
      patch.opsStatus = "paid";
      patch.opsUpdatedAtMs = now;
    }

    await ref.set(patch, { merge: true });

    return NextResponse.json({ ok: true, completed });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}