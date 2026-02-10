// FILE: src/app/api/promotions/confirm/route.ts

import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { computeVendorAccessState } from "@/lib/vendor/access";
import { paymentsProvider } from "@/lib/payments/provider";
import { flwVerifyTransaction } from "@/lib/payments/flutterwaveServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function verifyPaystack(reference: string) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error("Missing PAYSTACK_SECRET_KEY");

  const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });

  const data = await res.json().catch(() => ({} as any));
  if (!data.status) throw new Error(data.message || "Paystack verify failed");
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
    const body = await req.json().catch(() => ({} as any));
    const reference = String(body.reference || "").trim();
    const transactionId = body.transactionId != null ? String(body.transactionId).trim() : "";

    if (!reference) return Response.json({ ok: false, error: "reference is required" }, { status: 400 });

    const provider = paymentsProvider();

    // -------------------------
    // Flutterwave (default)
    // -------------------------
    if (provider === "flutterwave") {
      if (!transactionId) {
        return Response.json({ ok: false, error: "transactionId is required for Flutterwave confirmation" }, { status: 400 });
      }

      const flwTx = await flwVerifyTransaction(transactionId);

      const st = String(flwTx?.status || "").toLowerCase();
      if (st !== "successful") {
        return Response.json({ ok: false, error: `Payment not successful: ${flwTx?.status || "unknown"}` }, { status: 400 });
      }

      if (String(flwTx?.tx_ref || "") !== reference) {
        return Response.json({ ok: false, error: "Reference mismatch (tx_ref does not match reference)" }, { status: 400 });
      }

      const md = normalizeMetadata((flwTx as any)?.meta);
      if (md?.purpose !== "promotion") {
        return Response.json({ ok: false, error: "Invalid purpose for this endpoint" }, { status: 400 });
      }

      const businessId = String(md.businessId || "");
      const businessSlug = String(md.businessSlug || "");
      const productIds: string[] = Array.isArray(md.productIds) ? md.productIds.map(String).slice(0, 5) : [];

      const days = Number(md.days || 0);
      const dailyBudgetKobo = Number(md.dailyBudgetKobo || 0);
      const totalBudgetKobo = Number(md.totalBudgetKobo || 0);

      if (!businessId || productIds.length < 1) {
        return Response.json({ ok: false, error: "Missing businessId/productIds" }, { status: 400 });
      }

      // HARD LOCK enforcement at confirm-time too:
      const bizSnap = await adminDb.collection("businesses").doc(businessId).get();
      if (!bizSnap.exists) return Response.json({ ok: false, error: "Business not found" }, { status: 404 });
      const biz = { id: bizSnap.id, ...(bizSnap.data() as any) };

      const state = computeVendorAccessState(biz);
      if (state.locked) {
        return Response.json(
          { ok: false, code: "VENDOR_LOCKED", error: "Vendor is locked. Promotion activation blocked." },
          { status: 403 }
        );
      }

      const currency = String(flwTx?.currency || "NGN").toUpperCase();
      if (currency !== "NGN") {
        return Response.json({ ok: false, error: "Invalid currency (expected NGN)" }, { status: 400 });
      }

      const paidKobo = Math.round(Number((flwTx as any)?.amount || 0) * 100);
      if (!Number.isFinite(paidKobo) || paidKobo <= 0) {
        return Response.json({ ok: false, error: "Invalid amount from Flutterwave" }, { status: 400 });
      }

      if (totalBudgetKobo && paidKobo !== totalBudgetKobo) {
        return Response.json(
          { ok: false, error: "Amount mismatch", expected: totalBudgetKobo, paid: paidKobo },
          { status: 400 }
        );
      }

      const now = Date.now();
      const endsAtMs = now + Math.max(1, Number(days || 1)) * 24 * 60 * 60 * 1000;

      const campaignRef = adminDb.collection("promotionCampaigns").doc(reference);
      const platformRef = adminDb.collection("platform").doc("finance");
      const ledgerRef = adminDb.collection("platformLedger").doc();
      const txRef = adminDb.collection("transactions").doc(reference);

      const result = await adminDb.runTransaction(async (t) => {
        const existing = await t.get(campaignRef);
        if (existing.exists) {
          const d = existing.data() as any;
          return { ok: true, alreadyProcessed: true, reference, endsAtMs: d.endsAtMs ?? null };
        }

        t.set(campaignRef, {
          reference,
          businessId,
          businessSlug: businessSlug || null,
          productIds,
          days: Number(days || 0),
          dailyBudgetKobo: Number(dailyBudgetKobo || 0),
          totalBudgetKobo: paidKobo,
          status: "active",
          startedAtMs: now,
          endsAtMs,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        const perProductDailyKobo =
          productIds.length > 0 ? Math.floor(Number(dailyBudgetKobo || 0) / productIds.length) : 0;

        const perProductWeight = Math.max(1, Math.round((perProductDailyKobo || 0) / 100));

        for (const pid of productIds) {
          const pRef = adminDb.collection("products").doc(pid);
          t.set(
            pRef,
            {
              boostUntilMs: endsAtMs,
              boostCampaignRef: reference,
              boostDailyBudgetKobo: perProductDailyKobo,
              boostWeight: perProductWeight,
              updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
          );
        }

        t.set(
          platformRef,
          {
            balanceKobo: FieldValue.increment(paidKobo),
            boostRevenueKobo: FieldValue.increment(paidKobo),
            subscriptionRevenueKobo: FieldValue.increment(0),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        t.set(ledgerRef, {
          type: "promotion",
          reference,
          businessId,
          amountKobo: paidKobo,
          currency,
          createdAt: FieldValue.serverTimestamp(),
        });

        t.set(txRef, {
          purpose: "promotion",
          reference,
          businessId,
          amountKobo: paidKobo,
          amount: paidKobo / 100,
          status: "paid",
          provider: "flutterwave",
          flutterwave: { transactionId: Number((flwTx as any)?.id || 0) || null },
          createdAt: FieldValue.serverTimestamp(),
        });

        return { ok: true, alreadyProcessed: false, reference, endsAtMs };
      });

      return Response.json(result);
    }

    // -------------------------
    // Paystack (kept, hidden)
    // -------------------------
    const tx = await verifyPaystack(reference);
    if (tx.status !== "success") {
      return Response.json({ ok: false, error: `Payment not successful: ${tx.status}` }, { status: 400 });
    }

    const md = normalizeMetadata(tx.metadata);
    if (md?.purpose !== "promotion") {
      return Response.json({ ok: false, error: "Invalid purpose for this endpoint" }, { status: 400 });
    }

    const businessId = String(md.businessId || "");
    const businessSlug = String(md.businessSlug || "");
    const productIds: string[] = Array.isArray(md.productIds) ? md.productIds.map(String).slice(0, 5) : [];

    const days = Number(md.days || 0);
    const dailyBudgetKobo = Number(md.dailyBudgetKobo || 0);
    const totalBudgetKobo = Number(md.totalBudgetKobo || 0);

    if (!businessId || productIds.length < 1) {
      return Response.json({ ok: false, error: "Missing businessId/productIds" }, { status: 400 });
    }

    const bizSnap = await adminDb.collection("businesses").doc(businessId).get();
    if (!bizSnap.exists) return Response.json({ ok: false, error: "Business not found" }, { status: 404 });
    const biz = { id: bizSnap.id, ...(bizSnap.data() as any) };

    const state = computeVendorAccessState(biz);
    if (state.locked) {
      return Response.json(
        { ok: false, code: "VENDOR_LOCKED", error: "Vendor is locked. Promotion activation blocked." },
        { status: 403 }
      );
    }

    const paidKobo = Number(tx.amount || 0);
    if (!Number.isFinite(paidKobo) || paidKobo <= 0) {
      return Response.json({ ok: false, error: "Invalid amount from Paystack" }, { status: 400 });
    }

    if (totalBudgetKobo && paidKobo !== totalBudgetKobo) {
      return Response.json(
        { ok: false, error: "Amount mismatch", expected: totalBudgetKobo, paid: paidKobo },
        { status: 400 }
      );
    }

    const now = Date.now();
    const endsAtMs = now + Math.max(1, Number(days || 1)) * 24 * 60 * 60 * 1000;

    const campaignRef = adminDb.collection("promotionCampaigns").doc(reference);
    const platformRef = adminDb.collection("platform").doc("finance");
    const ledgerRef = adminDb.collection("platformLedger").doc();
    const txRef = adminDb.collection("transactions").doc(reference);

    const result = await adminDb.runTransaction(async (t) => {
      const existing = await t.get(campaignRef);
      if (existing.exists) {
        const d = existing.data() as any;
        return { ok: true, alreadyProcessed: true, reference, endsAtMs: d.endsAtMs ?? null };
      }

      t.set(campaignRef, {
        reference,
        businessId,
        businessSlug: businessSlug || null,
        productIds,
        days: Number(days || 0),
        dailyBudgetKobo: Number(dailyBudgetKobo || 0),
        totalBudgetKobo: paidKobo,
        status: "active",
        startedAtMs: now,
        endsAtMs,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      const perProductDailyKobo =
        productIds.length > 0 ? Math.floor(Number(dailyBudgetKobo || 0) / productIds.length) : 0;

      const perProductWeight = Math.max(1, Math.round((perProductDailyKobo || 0) / 100));

      for (const pid of productIds) {
        const pRef = adminDb.collection("products").doc(pid);
        t.set(
          pRef,
          {
            boostUntilMs: endsAtMs,
            boostCampaignRef: reference,
            boostDailyBudgetKobo: perProductDailyKobo,
            boostWeight: perProductWeight,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );
      }

      t.set(
        platformRef,
        {
          balanceKobo: FieldValue.increment(paidKobo),
          boostRevenueKobo: FieldValue.increment(paidKobo),
          subscriptionRevenueKobo: FieldValue.increment(0),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      t.set(ledgerRef, {
        type: "promotion",
        reference,
        businessId,
        amountKobo: paidKobo,
        currency: tx.currency || "NGN",
        createdAt: FieldValue.serverTimestamp(),
      });

      t.set(txRef, {
        purpose: "promotion",
        reference,
        businessId,
        amountKobo: paidKobo,
        amount: paidKobo / 100,
        status: "paid",
        createdAt: FieldValue.serverTimestamp(),
      });

      return { ok: true, alreadyProcessed: false, reference, endsAtMs };
    });

    return Response.json(result);
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "Confirm failed" }, { status: 500 });
  }
}