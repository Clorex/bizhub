// FILE: src/app/api/admin/platform/withdraw/route.ts

import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { requireAdminSessionVerified, verifyAdminOtp } from "@/lib/admin/securityServer";
import { assertAdminWithdrawPin } from "@/lib/admin/withdrawPinServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clampKobo(v: any) {
  const n = Math.floor(Number(v));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, n);
}

function cleanText(v: any, max = 120) {
  return String(v || "").trim().slice(0, max);
}

export async function POST(req: Request) {
  try {
    const me = await requireAdminSessionVerified(req);

    const body = await req.json().catch(() => ({}));

    const amountKobo = clampKobo(body.amountKobo);
    const otp = String(body.otp || "").trim();
    const pin = String(body.pin || "");
    const note = cleanText(body.note, 200);

    if (amountKobo <= 0) {
      return Response.json({ ok: false, error: "amountKobo must be > 0" }, { status: 400 });
    }

    if (!otp) {
      return Response.json({ ok: false, error: "otp is required" }, { status: 400 });
    }

    // Verify OTP (withdrawal scope)
    await verifyAdminOtp({ uid: me.uid, code: otp, scope: "withdrawal" });

    // Verify 14-char PIN
    await assertAdminWithdrawPin({ uid: me.uid, pin });

    const financeRef = adminDb.collection("platform").doc("finance");
    const wdRef = adminDb.collection("platformWithdrawals").doc();
    const ledgerRef = adminDb.collection("platformLedger").doc();

    const nowMs = Date.now();

    const result = await adminDb.runTransaction(async (t) => {
      const finSnap = await t.get(financeRef);
      const fin = finSnap.exists ? (finSnap.data() as any) : {};
      const balanceKobo = Number(fin.balanceKobo || 0);

      if (!Number.isFinite(balanceKobo) || balanceKobo < amountKobo) {
        return { ok: false, status: 400, error: "Insufficient platform balance" as const, balanceKobo };
      }

      // Deduct from platform balance
      t.set(
        financeRef,
        {
          balanceKobo: FieldValue.increment(-amountKobo),
          platformWithdrawalOutflowKobo: FieldValue.increment(amountKobo),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Create withdrawal record (manual payout)
      t.set(wdRef, {
        id: wdRef.id,
        amountKobo,
        amount: amountKobo / 100,
        currency: "NGN",
        status: "recorded", // recorded (manual payout done outside app)
        note: note || null,
        createdAtMs: nowMs,
        createdAt: FieldValue.serverTimestamp(),
        createdByUid: me.uid,
        createdByEmail: me.email ?? null,
      });

      // Ledger entry
      t.set(ledgerRef, {
        type: "platform_withdrawal",
        withdrawalId: wdRef.id,
        amountKobo,
        currency: "NGN",
        createdAt: FieldValue.serverTimestamp(),
      });

      return { ok: true, withdrawalId: wdRef.id, balanceBeforeKobo: balanceKobo, balanceAfterKobo: balanceKobo - amountKobo };
    });

    if ((result as any).ok === false) {
      const r: any = result;
      return Response.json({ ok: false, error: r.error, balanceKobo: r.balanceKobo }, { status: r.status || 400 });
    }

    return Response.json(result);
  } catch (e: any) {
    const code = e?.code || null;
    const status =
      code === "ADMIN_SESSION_NOT_VERIFIED" ? 401 :
      code === "OTP_INVALID" || code === "OTP_EXPIRED" || code === "NO_OTP" ? 400 :
      code === "PIN_INVALID" || code === "PIN_NOT_SET" || code === "PIN_INVALID_LENGTH" ? 400 :
      500;

    return Response.json({ ok: false, code, error: e?.message || "Failed" }, { status });
  }
}

export async function GET(req: Request) {
  try {
    await requireAdminSessionVerified(req);

    const snap = await adminDb
      .collection("platformWithdrawals")
      .orderBy("createdAtMs", "desc")
      .limit(50)
      .get();

    const withdrawals = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    return Response.json({ ok: true, withdrawals });
  } catch (e: any) {
    return Response.json({ ok: false, code: e?.code || null, error: e?.message || "Failed" }, { status: 401 });
  }
}