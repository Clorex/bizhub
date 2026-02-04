import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import {
  computeExpiryMs,
  priceKoboFor,
  type BizhubBillingCycle,
  type BizhubPlanKey,
} from "@/lib/bizhubPlans";
import { syncBusinessSignalsToProducts } from "@/lib/vendor/syncBusinessSignals";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function verifyPaystack(reference: string) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error("Missing PAYSTACK_SECRET_KEY");

  const res = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secret}` } }
  );

  const data = await res.json().catch(() => ({}));
  if (!data?.status) throw new Error(data?.message || "Paystack verify failed");
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
    const { reference } = await req.json().catch(() => ({}));
    if (!reference) return NextResponse.json({ error: "reference is required" }, { status: 400 });

    const paystackTx = await verifyPaystack(String(reference));
    if (paystackTx.status !== "success") {
      return NextResponse.json({ error: `Payment not successful: ${paystackTx.status}` }, { status: 400 });
    }

    const md = normalizeMetadata(paystackTx.metadata);
    if (md?.purpose !== "subscription") {
      return NextResponse.json({ error: "Invalid purpose for this endpoint" }, { status: 400 });
    }

    const businessId = String(md.businessId || "");
    const businessSlug = md.businessSlug ?? null;
    const planKey = String(md.planKey || "") as BizhubPlanKey;
    const cycle = String(md.cycle || "") as BizhubBillingCycle;

    if (!businessId) return NextResponse.json({ error: "Missing businessId in metadata" }, { status: 400 });

    const allowedPlans: BizhubPlanKey[] = ["LAUNCH", "MOMENTUM", "APEX"];
    const allowedCycles: BizhubBillingCycle[] = ["monthly", "quarterly", "biannually", "yearly"];

    if (!allowedPlans.includes(planKey)) return NextResponse.json({ error: "Invalid planKey" }, { status: 400 });
    if (!allowedCycles.includes(cycle)) return NextResponse.json({ error: "Invalid cycle" }, { status: 400 });

    const expectedKobo = priceKoboFor(planKey, cycle);
    const paidKobo = Number(paystackTx.amount || 0);

    if (!Number.isFinite(paidKobo) || paidKobo <= 0) {
      return NextResponse.json({ error: "Invalid Paystack amount" }, { status: 400 });
    }
    if (paidKobo !== expectedKobo) {
      return NextResponse.json({ error: "Amount mismatch", expectedKobo, paidKobo }, { status: 400 });
    }

    const now = Date.now();
    const expiresAtMs = computeExpiryMs(cycle, now);

    const subRef = adminDb.collection("subscriptions").doc(String(reference));
    const platformRef = adminDb.collection("platform").doc("finance");
    const ledgerRef = adminDb.collection("platformLedger").doc();
    const businessRef = adminDb.collection("businesses").doc(businessId);
    const txRef = adminDb.collection("transactions").doc(String(reference));

    // ✅ NEW: admin notification log
    const adminNotifRef = adminDb.collection("adminNotifications").doc();

    const result = await adminDb.runTransaction(async (t) => {
      const existing = await t.get(subRef);
      if (existing.exists) {
        const d = existing.data() as any;
        return {
          ok: true,
          alreadyProcessed: true,
          businessId: d.businessId,
          planKey: d.planKey,
          expiresAtMs: d.expiresAtMs,
        };
      }

      const bizSnap = await t.get(businessRef);
      if (!bizSnap.exists) throw new Error("Business not found");

      t.set(subRef, {
        reference: String(reference),
        businessId,
        businessSlug,

        planKey,
        cycle,

        amountKobo: paidKobo,
        amount: paidKobo / 100,
        currency: paystackTx.currency || "NGN",
        provider: "paystack",
        paidAt: paystackTx.paid_at || null,

        status: "active",
        startedAtMs: now,
        expiresAtMs,

        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdAtMs: now,
        updatedAtMs: now,
      });

      t.set(
        businessRef,
        {
          subscription: {
            planKey,
            cycle,
            status: "active",
            startedAtMs: now,
            expiresAtMs,
            lastPaymentReference: String(reference),
          },
          // no trials anymore, clean if old data exists
          trial: FieldValue.delete(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      t.set(
        platformRef,
        {
          balanceKobo: FieldValue.increment(paidKobo),
          subscriptionRevenueKobo: FieldValue.increment(paidKobo),
          boostRevenueKobo: FieldValue.increment(0),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      t.set(ledgerRef, {
        type: "subscription",
        reference: String(reference),
        businessId,
        businessSlug,
        planKey,
        cycle,
        amountKobo: paidKobo,
        currency: paystackTx.currency || "NGN",
        createdAt: FieldValue.serverTimestamp(),
        createdAtMs: now,
      });

      t.set(txRef, {
        purpose: "subscription",
        reference: String(reference),
        businessId,
        businessSlug,
        planKey,
        cycle,
        amountKobo: paidKobo,
        amount: paidKobo / 100,
        status: "paid",
        createdAt: FieldValue.serverTimestamp(),
        createdAtMs: now,
      });

      // ✅ NEW: Admin notification (used for “Admin must be notified when people upgrade”)
      t.set(adminNotifRef, {
        type: "subscription_paid",
        reference: String(reference),
        businessId,
        businessSlug,
        planKey,
        cycle,
        amountKobo: paidKobo,
        currency: paystackTx.currency || "NGN",
        paidAt: paystackTx.paid_at || null,
        expiresAtMs,
        createdAt: FieldValue.serverTimestamp(),
        createdAtMs: now,
        read: false,
      });

      return { ok: true, alreadyProcessed: false, businessId, planKey, expiresAtMs };
    });

    // Important: after subscription activates, refresh product market flags
    // so Market can start showing this vendor immediately.
    await syncBusinessSignalsToProducts({ businessId });

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Confirm failed" }, { status: 500 });
  }
}