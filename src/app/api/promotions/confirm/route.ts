import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { computeVendorAccessState } from "@/lib/vendor/access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function verifyPaystack(reference: string) {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) throw new Error("Missing PAYSTACK_SECRET_KEY");

  const res = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });

  const data = await res.json();
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
    const body = await req.json().catch(() => ({}));
    const reference = String(body.reference || "");
    if (!reference) return NextResponse.json({ ok: false, error: "reference is required" }, { status: 400 });

    const tx = await verifyPaystack(reference);
    if (tx.status !== "success") {
      return NextResponse.json({ ok: false, error: `Payment not successful: ${tx.status}` }, { status: 400 });
    }

    const md = normalizeMetadata(tx.metadata);
    if (md?.purpose !== "promotion") {
      return NextResponse.json({ ok: false, error: "Invalid purpose for this endpoint" }, { status: 400 });
    }

    const businessId = String(md.businessId || "");
    const businessSlug = String(md.businessSlug || "");
    const productIds: string[] = Array.isArray(md.productIds) ? md.productIds.map(String).slice(0, 5) : [];

    const days = Number(md.days || 0);
    const dailyBudgetKobo = Number(md.dailyBudgetKobo || 0);
    const totalBudgetKobo = Number(md.totalBudgetKobo || 0);

    if (!businessId || productIds.length < 1) {
      return NextResponse.json({ ok: false, error: "Missing businessId/productIds" }, { status: 400 });
    }

    // HARD LOCK enforcement at confirm-time too:
    const bizSnap = await adminDb.collection("businesses").doc(businessId).get();
    if (!bizSnap.exists) return NextResponse.json({ ok: false, error: "Business not found" }, { status: 404 });
    const biz = { id: bizSnap.id, ...(bizSnap.data() as any) };

    const state = computeVendorAccessState(biz);
    if (state.locked) {
      // IMPORTANT: we block activation to enforce "subscription-only"
      // If this happens, admin can manually refund externally if needed.
      return NextResponse.json(
        { ok: false, code: "VENDOR_LOCKED", error: "Vendor is locked. Promotion activation blocked." },
        { status: 403 }
      );
    }

    const paidKobo = Number(tx.amount || 0);
    if (!Number.isFinite(paidKobo) || paidKobo <= 0) {
      return NextResponse.json({ ok: false, error: "Invalid amount from Paystack" }, { status: 400 });
    }

    if (totalBudgetKobo && paidKobo !== totalBudgetKobo) {
      return NextResponse.json(
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

      // Write campaign
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

      // Update products: boost fields
      const perProductDailyKobo =
        productIds.length > 0 ? Math.floor(Number(dailyBudgetKobo || 0) / productIds.length) : 0;

      const perProductWeight =
        Math.max(1, Math.round((perProductDailyKobo || 0) / 100)); // NGN weight; used by market weighting if present

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

      // Platform balance updates
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

      // Ledger entry
      t.set(ledgerRef, {
        type: "promotion",
        reference,
        businessId,
        amountKobo: paidKobo,
        currency: tx.currency || "NGN",
        createdAt: FieldValue.serverTimestamp(),
      });

      // Transaction record
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

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Confirm failed" }, { status: 500 });
  }
}