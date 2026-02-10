
import crypto from "node:crypto";
import { requireAnyRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";
import { getBusinessPlanResolved } from "@/lib/vendor/planConfigServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 24 * 60 * 60 * 1000;

function cleanPlanKey(v: any) {
  const k = String(v || "FREE").toUpperCase();
  return k === "LAUNCH" || k === "MOMENTUM" || k === "APEX" ? k : "FREE";
}

function capForPlan(planKey: string) {
  const k = cleanPlanKey(planKey);
  if (k === "LAUNCH") return 5;
  if (k === "MOMENTUM") return 25;
  if (k === "APEX") return Infinity; // unlimited
  return 0;
}

function suggestionForRemixLocked(planKey: string) {
  const k = cleanPlanKey(planKey);

  if (k === "LAUNCH") {
    return {
      action: "buy_addon",
      sku: "addon_reengage_remix_lite",
      title: "Buy Re‑engagement AI remix (lite)",
      url: "/vendor/purchases",
    };
  }

  if (k === "MOMENTUM") {
    return {
      action: "buy_addon",
      sku: "addon_reengage_remix_apex_capped",
      title: "Buy Re‑engagement AI remix (Apex engine, capped)",
      url: "/vendor/purchases",
    };
  }

  return {
    action: "upgrade",
    title: "Upgrade plan",
    url: "/vendor/subscription",
  };
}

function suggestionForRemixCapHit() {
  return {
    action: "upgrade",
    title: "Upgrade to Apex for unlimited AI remix",
    url: "/vendor/subscription",
  };
}

function newRotationKey() {
  return `rot_${Date.now().toString(36)}_${crypto.randomBytes(4).toString("hex")}`;
}

/**
 * Remix = "Regenerate" prompt
 * - counts per BUSINESS (not per staff)
 * - rolling 24h window (not midnight reset)
 * - soft-block when cap hit (HTTP 200 with ok:false)
 */
export async function POST(req: Request) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) return Response.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const plan = await getBusinessPlanResolved(me.businessId);
    const planKey = cleanPlanKey(plan.planKey);

    // Must be purchased on Launch/Momentum; core on Apex
    const remixEnabled = !!plan?.features?.reengagementAiRemix;

    if (!remixEnabled) {
      return Response.json({
        ok: false,
        code: "FEATURE_LOCKED",
        error: "Re‑engagement AI remix is not available on your account. Buy the add‑on to unlock it.",
        suggestion: suggestionForRemixLocked(planKey),
      });
    }

    // If Apex: unlimited (still can return usage = null)
    const cap = capForPlan(planKey);
    if (!Number.isFinite(cap) || cap <= 0) {
      // If somehow enabled but cap invalid, treat as unlimited
      return Response.json({ ok: true, rotationKey: newRotationKey(), usage: null });
    }

    if (cap === Infinity) {
      return Response.json({ ok: true, rotationKey: newRotationKey(), usage: null });
    }

    const usageRef = adminDb.collection("vendorUsage").doc(String(me.businessId));
    const now = Date.now();

    let usedOut = 0;
    let windowStartOut = 0;
    let resetAtOut = 0;

    const allowed = await adminDb.runTransaction(async (tx) => {
      const snap = await tx.get(usageRef);
      const usage = snap.exists ? (snap.data() as any) : {};

      let windowStartMs = Number(usage.reengagementRemixWindowStartMs || 0);
      let used = Number(usage.reengagementRemixCount24h || 0);

      if (!windowStartMs || now - windowStartMs >= WINDOW_MS) {
        windowStartMs = now;
        used = 0;
      }

      const resetAtMs = windowStartMs + WINDOW_MS;

      if (used >= cap) {
        usedOut = used;
        windowStartOut = windowStartMs;
        resetAtOut = resetAtMs;
        return { ok: false as const, resetAtMs, used, windowStartMs };
      }

      used += 1;

      tx.set(
        usageRef,
        {
          businessId: String(me.businessId),
          reengagementRemixWindowStartMs: windowStartMs,
          reengagementRemixCount24h: used,
          reengagementRemixResetAtMs: resetAtMs,
          updatedAtMs: now,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      usedOut = used;
      windowStartOut = windowStartMs;
      resetAtOut = resetAtMs;

      return { ok: true as const, resetAtMs, used, windowStartMs };
    });

    if (!allowed.ok) {
      return Response.json({
        ok: false,
        code: "REMIX_CAP_REACHED",
        error: "AI remix cap reached. Please wait for the timer to reset.",
        resetAtMs: Number(allowed.resetAtMs || 0),
        usage: { cap, used: Number(allowed.used || 0), windowStartMs: Number(allowed.windowStartMs || 0) },
        suggestion: suggestionForRemixCapHit(),
      });
    }

    return Response.json({
      ok: true,
      rotationKey: newRotationKey(),
      usage: { cap, used: usedOut, windowStartMs: windowStartOut, resetAtMs: resetAtOut },
    });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return Response.json({ ok: false, code: "VENDOR_LOCKED", error: "Subscribe to continue." }, { status: 403 });
    }
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}