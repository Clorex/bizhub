import { NextResponse, type NextRequest } from "next/server";
import { requireAnyRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";
import { getVendorLimitsResolved } from "@/lib/vendor/limitsServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const OPS_KEYS = new Set(["new", "contacted", "paid", "in_transit", "delivered", "cancelled"]);
const WINDOW_MS = 72 * 60 * 60 * 1000;

function computeOpsEffective(o: any) {
  const plan = o?.paymentPlan;
  if (plan?.enabled) return plan?.completed ? "paid" : "new";

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

function clampInt(n: any, min: number, max: number) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function cleanPlanKey(v: any) {
  const k = String(v || "FREE").toUpperCase();
  return k === "LAUNCH" || k === "MOMENTUM" || k === "APEX" ? k : "FREE";
}

function followUpsBoostSuggestion(planKey: string, cap: number) {
  const pk = cleanPlanKey(planKey);
  const c = Math.max(0, Math.floor(Number(cap || 0)));

  if (pk === "LAUNCH" && c < 20) {
    return {
      action: "buy_addon",
      sku: "addon_followups_boost_20",
      title: "Buy Follow‑ups boost (10 → 20 / 72h)",
      url: "/vendor/purchases",
      targetCap72h: 20,
    };
  }

  if (pk === "MOMENTUM" && c < 50) {
    return {
      action: "buy_addon",
      sku: "addon_followups_boost_50",
      title: "Buy Follow‑ups boost (25 → 50 / 72h)",
      url: "/vendor/purchases",
      targetCap72h: 50,
    };
  }

  return null;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ orderId: string }> }) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const { orderId } = await ctx.params;
    const orderIdClean = String(orderId || "");
    if (!orderIdClean) return NextResponse.json({ ok: false, error: "Missing orderId" }, { status: 400 });

    const access = await getVendorLimitsResolved(me.businessId);

    const ref = adminDb.collection("orders").doc(orderIdClean);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: "Order not found" }, { status: 404 });

    const o = { id: snap.id, ...(snap.data() as any) };

    if (String(o.businessId || "") !== String(me.businessId || "")) {
      return NextResponse.json({ ok: false, error: "Not allowed" }, { status: 403 });
    }

    // ✅ Packages-controlled feature flags
    const transferProofUnlocked = !!access?.features?.proofOfPayment;
    const installmentPlansUnlocked = !!access?.features?.installmentPlans;

    const followUpsUnlocked = !!access?.features?.followUps;
    const followUpsCap72h = clampInt(access?.limits?.followUpsCap72h, 0, 500);

    const tp = o?.transferProof || null;
    const viewUrlRaw = String(tp?.cloudinary?.secureUrl || tp?.viewUrl || "");
    const viewUrl = transferProofUnlocked ? (viewUrlRaw || null) : null;

    // follow-up usage
    let used = 0;
    let windowStartMs = 0;
    let resetAtMs = 0;

    if (followUpsUnlocked && followUpsCap72h > 0) {
      const usageSnap = await adminDb.collection("vendorUsage").doc(String(me.businessId)).get();
      const usage = usageSnap.exists ? (usageSnap.data() as any) : {};

      const now = Date.now();
      windowStartMs = Number(usage.followUpsWindowStartMs || 0);
      used = Number(usage.followUpsCount72h || 0);
      resetAtMs = Number(usage.followUpsResetAtMs || 0);

      if (!windowStartMs || now - windowStartMs >= WINDOW_MS) {
        windowStartMs = 0;
        used = 0;
        resetAtMs = 0;
      } else {
        resetAtMs = windowStartMs + WINDOW_MS;
      }
    }

    const planKey = String(access.planKey || "FREE").toUpperCase();
    const boostSuggestion = followUpsBoostSuggestion(planKey, followUpsCap72h);

    return NextResponse.json({
      ok: true,
      meta: {
        planKey: access.planKey,
        hasActiveSubscription: access.hasActiveSubscription,

        limits: {
          ...(access.limits || {}),

          // old keys your UI already expects
          transferProofUnlocked,
          installmentPlansUnlocked,

          followUpsUnlocked: followUpsUnlocked && followUpsCap72h > 0,
          followUpsCap72h,
          followUpsUsed72h: used,
          followUpsResetAtMs: resetAtMs,
          followUpsWindowStartMs: windowStartMs,

          // ✅ new helper for UI
          followUpsBoostSuggestion: boostSuggestion,
        },
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

        transferProof: tp
          ? {
              status: tp.status || "submitted",
              originalName: tp.originalName || null,
              contentType: tp.contentType || null,
              size: typeof tp.size === "number" ? tp.size : null,
              uploadedAtMs: typeof tp.uploadedAtMs === "number" ? tp.uploadedAtMs : null,
              reviewedAtMs: typeof tp.reviewedAtMs === "number" ? tp.reviewedAtMs : null,
              rejectReason: tp.rejectReason || null,
              viewUrl,
            }
          : null,

        paymentPlan: o.paymentPlan ?? null,
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