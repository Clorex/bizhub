
import { adminDb } from "@/lib/firebase/admin";
import { requireAnyRole } from "@/lib/auth/server";
import { FieldValue } from "firebase-admin/firestore";
import { computeExpiryMs, type BizhubPlanKey, type BizhubBillingCycle } from "@/lib/bizhubPlans";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function cleanPlanKey(v: any): BizhubPlanKey {
  const k = String(v || "").toUpperCase();
  if (k === "FREE" || k === "LAUNCH" || k === "MOMENTUM" || k === "APEX") return k;
  return "FREE";
}

function cleanCycle(v: any): BizhubBillingCycle {
  const c = String(v || "").toLowerCase();
  if (c === "monthly" || c === "quarterly" || c === "biannually" || c === "yearly") return c as BizhubBillingCycle;
  return "monthly";
}

export async function POST(req: Request, ctx: { params: Promise<{ businessId: string }> }) {
  try {
    // Admin only
    const me = await requireAnyRole(req, ["admin"]);

    const { businessId } = await ctx.params;
    const businessIdClean = String(businessId || "").trim();
    if (!businessIdClean) return Response.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    const body = (await req.json().catch(() => ({}))) as any;
    const action = String(body?.action || "set").toLowerCase(); // set | clear
    const now = Date.now();

    const ref = adminDb.collection("businesses").doc(businessIdClean);
    const snap = await ref.get();
    if (!snap.exists) return Response.json({ ok: false, error: "Business not found" }, { status: 404 });

    if (action === "clear") {
      await ref.set(
        {
          updatedAt: FieldValue.serverTimestamp(),
          subscription: null,
          subscriptionAdmin: {
            lastAction: "clear",
            updatedAtMs: now,
            updatedByUid: me.uid || null,
            manual: true,
          },
        },
        { merge: true }
      );

      // ✅ notify admin log
      await adminDb.collection("adminNotifications").doc().set({
        type: "subscription_cleared",
        businessId: businessIdClean,
        createdAtMs: now,
        createdAt: FieldValue.serverTimestamp(),
        byUid: me.uid || null,
      });

      return Response.json({ ok: true });
    }

    const planKey = cleanPlanKey(body?.planKey);
    const cycle = cleanCycle(body?.cycle);

    if (planKey === "FREE") {
      return Response.json(
        { ok: false, error: "Use action=clear to remove subscription, or set LAUNCH/MOMENTUM/APEX." },
        { status: 400 }
      );
    }

    const startedAtMs = now;
    const expiresAtMs = computeExpiryMs(cycle, startedAtMs);

    await ref.set(
      {
        updatedAt: FieldValue.serverTimestamp(),
        subscription: {
          planKey,
          cycle,
          status: "active",
          startedAtMs,
          expiresAtMs,
          lastPaymentReference: body?.lastPaymentReference ? String(body.lastPaymentReference).slice(0, 80) : undefined,
        },
        subscriptionAdmin: {
          lastAction: "set",
          updatedAtMs: now,
          updatedByUid: me.uid || null,
          manual: true,
        },
      },
      { merge: true }
    );

    // ✅ notify admin log
    await adminDb.collection("adminNotifications").doc().set({
      type: "subscription_set",
      businessId: businessIdClean,
      planKey,
      cycle,
      expiresAtMs,
      createdAtMs: now,
      createdAt: FieldValue.serverTimestamp(),
      byUid: me.uid || null,
    });

    return Response.json({ ok: true, planKey, cycle, startedAtMs, expiresAtMs });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}