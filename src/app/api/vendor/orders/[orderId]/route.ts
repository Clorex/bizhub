// FILE: src/app/api/vendor/orders/[orderId]/route.ts
import { NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";
import { getVendorLimitsResolved } from "@/lib/vendor/limitsServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET(req: Request, ctx: { params: { orderId: string } }) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const orderId = String(ctx.params.orderId || "");
    if (!orderId) return NextResponse.json({ ok: false, error: "Missing orderId" }, { status: 400 });

    const access = await getVendorLimitsResolved(me.businessId);

    const ref = adminDb.collection("orders").doc(orderId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });

    const o = { id: snap.id, ...(snap.data() as any) };

    if (String(o.businessId || "") !== String(me.businessId || "")) {
      return NextResponse.json({ ok: false, error: "Not allowed" }, { status: 403 });
    }

    return NextResponse.json({
      ok: true,
      meta: {
        planKey: access.planKey,
        hasActiveSubscription: access.hasActiveSubscription,
        limits: access.limits,
      },
      order: {
        id: o.id,
        createdAt: o.createdAt ?? null,
        updatedAt: o.updatedAt ?? null,

        businessId: o.businessId ?? null,
        businessSlug: o.businessSlug ?? null,

        orderSource: o.orderSource ?? null,

        paymentType: o.paymentType ?? null,
        escrowStatus: o.escrowStatus ?? null,
        orderStatus: o.orderStatus ?? null,

        opsStatus: o.opsStatus ?? null,
        opsStatusEffective: computeOpsEffective(o),

        amount: o.amount ?? null,
        amountKobo: o.amountKobo ?? null,
        currency: o.currency ?? "NGN",

        customer: o.customer ?? null,
        items: Array.isArray(o.items) ? o.items : [],

        shipping: o.shipping ?? null,
        coupon: o.coupon ?? null,
      },
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