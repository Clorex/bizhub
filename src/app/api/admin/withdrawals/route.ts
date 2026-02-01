import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clampAction(v: any) {
  const a = String(v || "");
  if (a === "reject" || a === "mark_paid") return a;
  return "";
}

export async function GET(req: Request) {
  try {
    await requireRole(req, "admin");

    const url = new URL(req.url);
    const status = String(url.searchParams.get("status") || "").trim();

    // Keep it simple: load latest 200 and filter in memory (no index stress)
    const snap = await adminDb.collection("withdrawals").orderBy("createdAt", "desc").limit(200).get();
    let list = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    if (status) list = list.filter((x) => String(x.status || "") === status);

    return NextResponse.json({ ok: true, withdrawals: list.slice(0, 100) });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireRole(req, "admin");

    const body = await req.json().catch(() => ({}));
    const withdrawalId = String(body.withdrawalId || "");
    const action = clampAction(body.action);
    const note = String(body.note || "").slice(0, 500);

    if (!withdrawalId || !action) {
      return NextResponse.json({ ok: false, error: "withdrawalId and action required" }, { status: 400 });
    }

    const wdRef = adminDb.collection("withdrawals").doc(withdrawalId);

    const result = await adminDb.runTransaction(async (t) => {
      const wdSnap = await t.get(wdRef);
      if (!wdSnap.exists) return { ok: false, status: 404, error: "Withdrawal not found" as const };

      const wd = wdSnap.data() as any;
      const businessId = String(wd.businessId || "");
      const amountKobo = Number(wd.amountKobo || 0);

      if (!businessId || !Number.isFinite(amountKobo) || amountKobo <= 0) {
        return { ok: false, status: 400, error: "Invalid withdrawal data" as const };
      }

      const walletRef = adminDb.collection("wallets").doc(businessId);
      const financeRef = adminDb.collection("platform").doc("finance");
      const ledgerRef = adminDb.collection("platformLedger").doc();

      const nowMs = Date.now();

      // Load wallet to validate hold exists
      const wSnap = await t.get(walletRef);
      const w = wSnap.exists ? (wSnap.data() as any) : null;
      const hold = Number(w?.withdrawHoldKobo || 0);

      if (action === "reject") {
        if (String(wd.status || "") !== "pending") {
          return { ok: false, status: 400, error: "Only pending withdrawals can be rejected" as const };
        }

        // return funds hold -> available
        t.set(
          walletRef,
          {
            withdrawHoldKobo: FieldValue.increment(-amountKobo),
            availableBalanceKobo: FieldValue.increment(amountKobo),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        t.set(
          wdRef,
          {
            status: "rejected",
            adminNote: note || null,
            rejectedBy: me.uid,
            rejectedAtMs: nowMs,
            updatedAtMs: nowMs,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        return { ok: true, status: "rejected" as const };
      }

      if (action === "mark_paid") {
        // allow marking pending or approved as paid
        const curStatus = String(wd.status || "");
        if (curStatus !== "pending" && curStatus !== "approved") {
          return { ok: false, status: 400, error: "Only pending/approved withdrawals can be marked paid" as const };
        }

        if (hold < amountKobo) {
          return { ok: false, status: 400, error: "Insufficient hold balance for this payout" as const };
        }

        // reduce hold and update totals
        t.set(
          walletRef,
          {
            withdrawHoldKobo: FieldValue.increment(-amountKobo),
            totalWithdrawnKobo: FieldValue.increment(amountKobo),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        // platform outflow + ledger
        t.set(
          financeRef,
          {
            balanceKobo: FieldValue.increment(-amountKobo),
            payoutOutflowKobo: FieldValue.increment(amountKobo),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        t.set(ledgerRef, {
          type: "payout_outflow",
          withdrawalId,
          businessId,
          amountKobo,
          createdAt: FieldValue.serverTimestamp(),
        });

        // mark paid
        t.set(
          wdRef,
          {
            status: "paid",
            adminNote: note || null,
            paidBy: me.uid,
            paidAtMs: nowMs,
            updatedAtMs: nowMs,
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true }
        );

        return { ok: true, status: "paid" as const };
      }

      return { ok: false, status: 400, error: "Unknown action" as const };
    });

    if ((result as any).ok === false) {
      const r: any = result;
      return NextResponse.json({ ok: false, error: r.error }, { status: r.status || 500 });
    }

    return NextResponse.json(result);
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}