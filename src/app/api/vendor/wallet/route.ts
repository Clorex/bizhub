
import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) {
      return Response.json({ ok: false, error: "Missing businessId" }, { status: 400 });
    }

    await requireVendorUnlocked(me.businessId);

    const snap = await adminDb.collection("wallets").doc(me.businessId).get();
    return Response.json({ ok: true, wallet: snap.exists ? snap.data() : null });
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