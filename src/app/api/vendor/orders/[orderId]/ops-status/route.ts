// FILE: src/app/api/vendor/orders/[orderId]/ops-status/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { requireAnyRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";
import { getVendorLimitsResolved } from "@/lib/vendor/limitsServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPS: Record<string, true> = {
  new: true,
  contacted: true,
  paid: true,
  in_transit: true,
  delivered: true,
  cancelled: true,
};

function cleanOps(v: any) {
  const s = String(v || "").trim();
  return OPS[s] ? s : "";
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ orderId: string }> }) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const access = await getVendorLimitsResolved(me.businessId);
    if (!access.limits.canUpdateStatus) {
      return NextResponse.json({ ok: false, code: "FEATURE_LOCKED", error: "Upgrade to update order progress." }, { status: 403 });
    }

    const { orderId } = await ctx.params;
    const orderIdClean = String(orderId || "");
    if (!orderIdClean) return NextResponse.json({ ok: false, error: "Missing orderId" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const opsStatus = cleanOps(body.opsStatus);
    if (!opsStatus) return NextResponse.json({ ok: false, error: "Invalid opsStatus" }, { status: 400 });

    const ref = adminDb.collection("orders").doc(orderIdClean);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });

    const o = snap.data() as any;
    if (String(o.businessId || "") !== String(me.businessId || "")) {
      return NextResponse.json({ ok: false, error: "Not allowed" }, { status: 403 });
    }

    await ref.set(
      {
        opsStatus,
        opsUpdatedAtMs: Date.now(),
        opsUpdatedByUid: me.uid,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    return NextResponse.json({ ok: true, opsStatus });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json({ ok: false, code: "VENDOR_LOCKED", error: "Your free access has ended. Subscribe to continue." }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}