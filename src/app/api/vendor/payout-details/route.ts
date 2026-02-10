
import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) return Response.json({ error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const snap = await adminDb.collection("businesses").doc(me.businessId).get();
    const data = snap.exists ? (snap.data() as any) : null;
    return Response.json({ ok: true, payoutDetails: data?.payoutDetails ?? null });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return Response.json(
        { ok: false, code: "VENDOR_LOCKED", error: "Your free access has ended. Subscribe to continue." },
        { status: 403 }
      );
    }
    return Response.json({ ok: false, error: e?.message || "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) return Response.json({ error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const body = await req.json().catch(() => ({}));
    const bankName = String(body.bankName || "");
    const accountNumber = String(body.accountNumber || "");
    const accountName = String(body.accountName || "");

    await adminDb.collection("businesses").doc(me.businessId).set(
      {
        payoutDetails: { bankName, accountNumber, accountName },
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return Response.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return Response.json(
        { ok: false, code: "VENDOR_LOCKED", error: "Your free access has ended. Subscribe to continue." },
        { status: 403 }
      );
    }
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}