
import { adminDb } from "@/lib/firebase/admin";
import { requireMe } from "@/lib/auth/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPS_KEYS = new Set(["new", "contacted", "paid", "in_transit", "delivered", "cancelled"]);

function lowerEmail(v: any) {
  return String(v || "").trim().toLowerCase();
}

function computeOpsEffective(o: any) {
  const plan = o?.paymentPlan;
  if (plan?.enabled) {
    // If installments enabled, only show paid when completed
    return plan?.completed ? "paid" : "new";
  }

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

function sanitizePaymentPlanForCustomer(plan: any) {
  if (!plan || typeof plan !== "object") return null;
  const installments = Array.isArray(plan.installments) ? plan.installments : [];

  return {
    enabled: !!plan.enabled,
    type: String(plan.type || "installments"),
    totalKobo: Number(plan.totalKobo || 0),
    currency: String(plan.currency || "NGN"),
    paidKobo: Number(plan.paidKobo || 0),
    completed: !!plan.completed,
    completedAtMs: Number(plan.completedAtMs || 0) || null,
    createdAtMs: Number(plan.createdAtMs || 0) || null,
    updatedAtMs: Number(plan.updatedAtMs || 0) || null,
    installments: installments.map((x: any) => ({
      idx: Number(x?.idx ?? 0),
      label: String(x?.label || ""),
      amountKobo: Number(x?.amountKobo || 0),
      dueAtMs: Number(x?.dueAtMs || 0),

      status: String(x?.status || "pending"),
      submittedAtMs: x?.submittedAtMs ? Number(x.submittedAtMs) : null,
      reviewedAtMs: x?.reviewedAtMs ? Number(x.reviewedAtMs) : null,
      rejectReason: x?.rejectReason ? String(x.rejectReason) : null,

      // customer can see their own proof link
      proofUrl: x?.proof?.cloudinary?.secureUrl ? String(x.proof.cloudinary.secureUrl) : null,

      // customer can see reference if they used paystack
      paystackReference: x?.paystack?.reference ? String(x.paystack.reference) : null,
    })),
  };
}

// ✅ Next.js 16 route handler typing: params is a Promise
export async function GET(req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  try {
    const me = await requireMe(req);

    const { orderId } = await ctx.params;
    const orderIdClean = String(orderId || "").trim();
    if (!orderIdClean) return Response.json({ ok: false, error: "Missing orderId" }, { status: 400 });

    const snap = await adminDb.collection("orders").doc(orderIdClean).get();
    if (!snap.exists) return Response.json({ ok: false, error: "Order not found" }, { status: 404 });

    const o = { id: snap.id, ...(snap.data() as any) };

    if (me.role === "customer") {
      const myEmail = lowerEmail(me.email);
      const orderEmail = lowerEmail(o?.customer?.email);
      if (!myEmail || !orderEmail || myEmail !== orderEmail) {
        return Response.json({ ok: false, error: "Not allowed" }, { status: 403 });
      }
    }

    if (me.role === "owner" || me.role === "staff") {
      if (!me.businessId || String(o.businessId || "") !== String(me.businessId || "")) {
        return Response.json({ ok: false, error: "Not allowed" }, { status: 403 });
      }
    }

    return Response.json({
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

        paymentPlan: sanitizePaymentPlanForCustomer(o.paymentPlan),
      },
    });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 401 });
  }
}