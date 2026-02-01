// FILE: src/app/api/orders/[orderId]/route.ts
import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireMe } from "@/lib/auth/server";

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

function lowerEmail(v: any) {
  return String(v || "").trim().toLowerCase();
}

// ✅ Next.js 16 route handler typing: params is a Promise
export async function GET(req: NextRequest, ctx: { params: Promise<{ orderId: string }> }) {
  try {
    const me = await requireMe(req);

    const { orderId } = await ctx.params;
    const orderIdClean = String(orderId || "").trim();
    if (!orderIdClean) return NextResponse.json({ ok: false, error: "Missing orderId" }, { status: 400 });

    const snap = await adminDb.collection("orders").doc(orderIdClean).get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });

    const o = { id: snap.id, ...(snap.data() as any) };

    if (me.role === "customer") {
      const myEmail = lowerEmail(me.email);
      const orderEmail = lowerEmail(o?.customer?.email);
      if (!myEmail || !orderEmail || myEmail !== orderEmail) {
        return NextResponse.json({ ok: false, error: "Not allowed" }, { status: 403 });
      }
    }

    if (me.role === "owner" || me.role === "staff") {
      if (!me.businessId || String(o.businessId || "") !== String(me.businessId || "")) {
        return NextResponse.json({ ok: false, error: "Not allowed" }, { status: 403 });
      }
    }

    return NextResponse.json({
      ok: true,
      order: {
        id: o.id,
        createdAt: o.createdAt ?? null,
        updatedAt: o.updatedAt ?? null,

        businessId: o.businessId ?? null,
        businessSlug: o.businessSlug ?? null,

        orderSource: o.orderSource ?? null,

        paymentType: o.paymentType ?? null,
        payment: o.payment ?? null,

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
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 401 });
  }
}