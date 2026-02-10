
import { requireAnyRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";
import { getVendorLimitsResolved } from "@/lib/vendor/limitsServer";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

function cleanPlanKey(v: any) {
  const k = String(v || "FREE").toUpperCase();
  return k === "LAUNCH" || k === "MOMENTUM" || k === "APEX" ? k : "FREE";
}

function installmentRulesForPlan(planKey: string) {
  const k = cleanPlanKey(planKey);

  if (k === "LAUNCH") {
    return { tier: "basic" as const, maxInstallments: 2, maxPlanDays: 30 };
  }
  if (k === "MOMENTUM") {
    return { tier: "advanced" as const, maxInstallments: 4, maxPlanDays: 90 };
  }
  if (k === "APEX") {
    return { tier: "apex" as const, maxInstallments: 36, maxPlanDays: 3650 };
  }
  return { tier: "none" as const, maxInstallments: 0, maxPlanDays: 0 };
}

function cleanInstallments(list: any[], maxInstallments: number) {
  const arr = Array.isArray(list) ? list : [];

  const tmp = arr
    .map((x, idx) => {
      const amountKobo = Math.floor(Number(x?.amountKobo || 0));
      const dueAtMs = Math.floor(Number(x?.dueAtMs || 0));
      const label = String(x?.label || `Installment ${idx + 1}`).slice(0, 40);

      return {
        label,
        amountKobo: Number.isFinite(amountKobo) ? Math.max(0, amountKobo) : 0,
        dueAtMs: Number.isFinite(dueAtMs) ? Math.max(0, dueAtMs) : 0,

        status: "pending",
        submittedAtMs: null,
        reviewedAtMs: null,
        rejectReason: null,

        paystack: null,
        proof: null,
      };
    })
    .filter((x) => x.amountKobo > 0);

  const sliced = tmp.slice(0, Math.max(0, Math.floor(Number(maxInstallments || 0))));

  return sliced.map((x, idx) => ({
    idx,
    label: String(x.label || `Installment ${idx + 1}`).slice(0, 40) || `Installment ${idx + 1}`,
    amountKobo: x.amountKobo,
    dueAtMs: x.dueAtMs,
    status: "pending",
    submittedAtMs: null,
    reviewedAtMs: null,
    rejectReason: null,
    paystack: null,
    proof: null,
  }));
}

function canUseInstallmentsForPaymentType(paymentType: string, orderSource: string) {
  const pt = String(paymentType || "");
  const src = String(orderSource || "").toLowerCase();

  if (src === "market" || src === "marketplace") return pt === "paystack_escrow";
  return pt === "paystack_escrow" || pt === "direct_transfer";
}

function validateInstallmentDates(installments: any[], nowMs: number, maxPlanDays: number) {
  const arr = Array.isArray(installments) ? installments : [];
  if (!arr.length) return { ok: false, error: "No installments" as const };

  for (const it of arr) {
    const dueAtMs = Number(it?.dueAtMs || 0);
    if (!Number.isFinite(dueAtMs) || dueAtMs <= 0) {
      return { ok: false, error: "All installments must have a due date." as const };
    }
  }

  for (let i = 1; i < arr.length; i++) {
    const prev = Number(arr[i - 1]?.dueAtMs || 0);
    const cur = Number(arr[i]?.dueAtMs || 0);
    if (cur < prev) {
      return { ok: false, error: "Due dates must be in increasing order." as const };
    }
  }

  const lastDueAtMs = Number(arr[arr.length - 1]?.dueAtMs || 0);
  const maxAllowedMs = nowMs + Math.max(1, Math.floor(Number(maxPlanDays || 0))) * DAY_MS;

  if (lastDueAtMs > maxAllowedMs) {
    return { ok: false, error: `Installment plan is too long for your plan (max ${maxPlanDays} days).` as const };
  }

  return { ok: true as const };
}

export async function POST(req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) return Response.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const access = await getVendorLimitsResolved(me.businessId);

    if (!access?.features?.installmentPlans) {
      return Response.json(
        { ok: false, code: "FEATURE_LOCKED", error: "Installment plans are locked on your plan." },
        { status: 403 }
      );
    }

    const planKey = cleanPlanKey(access?.planKey || "FREE");
    const rules = installmentRulesForPlan(planKey);
    if (rules.maxInstallments <= 0) {
      return Response.json(
        { ok: false, code: "FEATURE_LOCKED", error: "Installment plans are locked on your plan." },
        { status: 403 }
      );
    }

    const { orderId } = await ctx.params;
    const orderIdClean = String(orderId || "").trim();
    if (!orderIdClean) return Response.json({ ok: false, error: "Missing orderId" }, { status: 400 });

    const body = (await req.json().catch(() => ({}))) as any;

    const ref = adminDb.collection("orders").doc(orderIdClean);
    const snap = await ref.get();
    if (!snap.exists) return Response.json({ ok: false, error: "Order not found" }, { status: 404 });

    const o = snap.data() as any;
    if (String(o?.businessId || "") !== String(me.businessId || "")) {
      return Response.json({ ok: false, error: "Not allowed" }, { status: 403 });
    }

    const paymentType = String(o?.paymentType || "");
    const orderSource = String(o?.orderSource || "");
    if (!canUseInstallmentsForPaymentType(paymentType, orderSource)) {
      return Response.json({ ok: false, error: "Installments are not allowed for this order type." }, { status: 400 });
    }

    if (String(body?.action || "") === "clear") {
      await ref.set({ paymentPlan: null, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      return Response.json({ ok: true });
    }

    const existingPlan = o?.paymentPlan || null;
    if (existingPlan?.enabled) {
      const existingInstallments = Array.isArray(existingPlan?.installments) ? existingPlan.installments : [];
      const hasActivity = existingInstallments.some((x: any) => String(x?.status || "") !== "pending");
      if (hasActivity) {
        return Response.json(
          { ok: false, error: "This plan already has payments. Clear the plan before changing it." },
          { status: 400 }
        );
      }
    }

    const installments = cleanInstallments(body?.installments || [], rules.maxInstallments);

    if (installments.length < 2) {
      return Response.json(
        { ok: false, error: `Add at least 2 installments. (Your plan allows up to ${rules.maxInstallments}.)` },
        { status: 400 }
      );
    }

    if (installments.length > rules.maxInstallments) {
      return Response.json(
        { ok: false, error: `Too many installments for your plan (max ${rules.maxInstallments}).` },
        { status: 400 }
      );
    }

    const totalKobo = Math.floor(Number(o?.amountKobo || 0));
    if (!Number.isFinite(totalKobo) || totalKobo <= 0) {
      return Response.json({ ok: false, error: "Invalid order total." }, { status: 400 });
    }

    const sum = installments.reduce((s, x) => s + Number(x.amountKobo || 0), 0);
    if (sum !== totalKobo) {
      return Response.json(
        { ok: false, error: "Installment amounts must add up exactly to the order total." },
        { status: 400 }
      );
    }

    const now = Date.now();
    const dateCheck = validateInstallmentDates(installments, now, rules.maxPlanDays);
    if (!dateCheck.ok) {
      return Response.json({ ok: false, error: dateCheck.error }, { status: 400 });
    }

    const plan = {
      enabled: true,
      type: "installments",
      tier: rules.tier,
      totalKobo,
      currency: String(o?.currency || "NGN"),
      installments,
      paidKobo: 0,
      completed: false,
      completedAtMs: null,
      createdAtMs: now,
      updatedAtMs: now,
      createdByUid: me.uid || null,
    };

    await ref.set(
      {
        updatedAt: FieldValue.serverTimestamp(),
        paymentPlan: plan,
        opsStatus: String(o?.opsStatus || "") ? o.opsStatus : "new",
        opsUpdatedAtMs: Number(o?.opsUpdatedAtMs || Date.now()),
      },
      { merge: true }
    );

    return Response.json({
      ok: true,
      plan: { tier: rules.tier, maxInstallments: rules.maxInstallments, maxPlanDays: rules.maxPlanDays },
    });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return Response.json({ ok: false, code: "VENDOR_LOCKED", error: "Subscribe to continue." }, { status: 403 });
    }
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}