import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clampKobo(v: any) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

export async function GET(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const snap = await adminDb
      .collection("withdrawals")
      .where("businessId", "==", me.businessId)
      .limit(50)
      .get();

    const list = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0))
      .slice(0, 20);

    // Wallet summary for UI
    const wSnap = await adminDb.collection("wallets").doc(me.businessId).get();
    const wallet = wSnap.exists ? (wSnap.data() as any) : null;

    return NextResponse.json({ ok: true, withdrawals: list, wallet });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json({ ok: false, code: "VENDOR_LOCKED", error: "Your free access has ended. Subscribe to continue." }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    // hard lock enforcement
    await requireVendorUnlocked(me.businessId);

    const body = await req.json().catch(() => ({}));
    const amountKobo = clampKobo(body.amountKobo);

    // Minimum ₦1000
    if (amountKobo < 1000 * 100) {
      return NextResponse.json({ ok: false, error: "Minimum withdrawal is ₦1,000" }, { status: 400 });
    }

    const bizSnap = await adminDb.collection("businesses").doc(me.businessId).get();
    if (!bizSnap.exists) return NextResponse.json({ ok: false, error: "Business not found" }, { status: 404 });
    const biz = bizSnap.data() as any;

    const payout = biz?.payoutDetails || null;
    const bankName = String(payout?.bankName || "").trim();
    const accountNumber = String(payout?.accountNumber || "").trim();
    const accountName = String(payout?.accountName || "").trim();

    if (!bankName || !accountNumber || !accountName) {
      return NextResponse.json(
        { ok: false, code: "MISSING_PAYOUT_DETAILS", error: "Add payout details before requesting withdrawal." },
        { status: 400 }
      );
    }

    const walletRef = adminDb.collection("wallets").doc(me.businessId);
    const wdRef = adminDb.collection("withdrawals").doc();

    const result = await adminDb.runTransaction(async (t) => {
      const wSnap = await t.get(walletRef);
      const w = wSnap.exists ? (wSnap.data() as any) : null;

      const available = Number(w?.availableBalanceKobo || 0);
      const hold = Number(w?.withdrawHoldKobo || 0);

      if (!Number.isFinite(available) || available <= 0) {
        return { ok: false, status: 400, error: "No available balance" as const };
      }
      if (amountKobo > available) {
        return { ok: false, status: 400, error: "Amount exceeds available balance" as const };
      }

      const nowMs = Date.now();

      // Create withdrawal request (status pending)
      t.set(wdRef, {
        businessId: me.businessId,
        businessSlug: biz?.slug ?? me.businessSlug ?? null,
        requestedByUid: me.uid,

        amountKobo,
        amount: amountKobo / 100,
        currency: "NGN",

        payoutDetails: {
          bankName,
          accountNumber,
          accountName,
        },

        status: "pending", // pending | approved | rejected | paid
        createdAtMs: nowMs,
        updatedAtMs: nowMs,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      // Move funds: available -> hold
      t.set(
        walletRef,
        {
          businessId: me.businessId,
          availableBalanceKobo: FieldValue.increment(-amountKobo),
          withdrawHoldKobo: FieldValue.increment(amountKobo),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      return { ok: true, withdrawalId: wdRef.id, amountKobo, holdAfter: hold + amountKobo, availableAfter: available - amountKobo };
    });

    if ((result as any).ok === false) {
      const r: any = result;
      return NextResponse.json({ ok: false, error: r.error }, { status: r.status || 400 });
    }

    return NextResponse.json(result);
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json({ ok: false, code: "VENDOR_LOCKED", error: "Your free access has ended. Subscribe to continue." }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}