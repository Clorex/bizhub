// FILE: src/app/api/admin/platform/payout-details/route.ts

import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireAdminSessionVerified } from "@/lib/admin/securityServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanText(v: any, max = 80) {
  return String(v || "").trim().slice(0, max);
}

export async function GET(req: Request) {
  try {
    await requireAdminSessionVerified(req);

    const snap = await adminDb.collection("platform").doc("payoutDetails").get();
    const d = snap.exists ? (snap.data() as any) : null;

    return Response.json({ ok: true, payoutDetails: d || null });
  } catch (e: any) {
    return Response.json({ ok: false, code: e?.code || null, error: e?.message || "Failed" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireAdminSessionVerified(req);

    const body = await req.json().catch(() => ({}));
    const bankName = cleanText(body.bankName, 80);
    const accountNumber = cleanText(body.accountNumber, 40);
    const accountName = cleanText(body.accountName, 80);

    if (!bankName || !accountNumber || !accountName) {
      return Response.json({ ok: false, error: "bankName, accountNumber, accountName are required" }, { status: 400 });
    }

    await adminDb.collection("platform").doc("payoutDetails").set(
      {
        bankName,
        accountNumber,
        accountName,
        updatedAtMs: Date.now(),
        updatedAt: FieldValue.serverTimestamp(),
        updatedByUid: me.uid,
        updatedByEmail: me.email ?? null,
      },
      { merge: true }
    );

    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ ok: false, code: e?.code || null, error: e?.message || "Failed" }, { status: 401 });
  }
}