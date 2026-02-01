// FILE: src/app/api/vendor/orders/route.ts
import { NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";
import { getVendorLimitsResolved } from "@/lib/vendor/limitsServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toMs(v: any) {
  try {
    if (!v) return 0;
    if (typeof v?.toDate === "function") return v.toDate().getTime();
    if (typeof v?.seconds === "number") return v.seconds * 1000;
    return 0;
  } catch {
    return 0;
  }
}

const OPS_KEYS = new Set(["new", "contacted", "paid", "in_transit", "delivered", "cancelled"]);

function computeOpsEffective(o: any) {
  const ops = String(o?.opsStatus || "").trim();
  if (OPS_KEYS.has(ops)) return ops;

  const orderStatus = String(o?.orderStatus || "").trim();
  if (OPS_KEYS.has(orderStatus)) return orderStatus;

  const pt = String(o?.paymentType || "");
  if (pt === "paystack_escrow") return "paid";
  if (pt === "direct_transfer") return "new";
  if (pt === "chat_whatsapp") return "new";
  return null;
}

export async function GET(req: Request) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const access = await getVendorLimitsResolved(me.businessId);

    const snap = await adminDb
      .collection("orders")
      .where("businessId", "==", me.businessId)
      .limit(500)
      .get();

    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    list.sort((a: any, b: any) => toMs(b.createdAt) - toMs(a.createdAt));

    const capped = list.slice(0, access.limits.ordersVisible);

    const orders = capped.map((o: any) => ({
      id: o.id,
      createdAt: o.createdAt ?? null,
      paymentType: o.paymentType ?? null,
      escrowStatus: o.escrowStatus ?? null,
      orderStatus: o.orderStatus ?? null,
      opsStatus: o.opsStatus ?? null,
      opsStatusEffective: computeOpsEffective(o),
      amount: o.amount ?? null,
      amountKobo: o.amountKobo ?? null,
      items: Array.isArray(o.items) ? o.items : [],
      customer: o.customer ?? null,
      orderSource: o.orderSource ?? null,
    }));

    return NextResponse.json({
      ok: true,
      meta: {
        planKey: access.planKey,
        hasActiveSubscription: access.hasActiveSubscription,
        limits: access.limits,
      },
      orders,
    });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json(
        { ok: false, code: "VENDOR_LOCKED", error: "Your free access has ended. Subscribe to continue." },
        { status: 403 }
      );
    }
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}