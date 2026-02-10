
import { requireAnyRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";
import { getVendorLimitsResolved } from "@/lib/vendor/limitsServer";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_MS = 72 * 60 * 60 * 1000;

function digitsOnly(v: string) {
  return String(v || "").replace(/[^\d]/g, "");
}

function waLink(phone: string, text: string) {
  const digits = digitsOnly(phone);
  const t = encodeURIComponent(text);
  return `https://wa.me/${digits}?text=${t}`;
}

function buildDefaultText(o: any) {
  const name = String(o?.customer?.fullName || "there").trim();
  const shortId = String(o?.id || "").slice(0, 8);
  const store = String(o?.businessSlug || "our store");
  return `Hello ${name}, this is ${store}. Quick follow-up on your order #${shortId}. Please reply if you need any help.`;
}

function cleanPlanKey(v: any) {
  const k = String(v || "FREE").toUpperCase();
  return k === "LAUNCH" || k === "MOMENTUM" || k === "APEX" ? k : "FREE";
}

function suggestionForLimit(args: { planKey: string; cap: number }) {
  const planKey = cleanPlanKey(args.planKey);
  const cap = Math.max(0, Math.floor(Number(args.cap || 0)));

  if (planKey === "LAUNCH") {
    if (cap < 20) {
      return {
        action: "buy_addon",
        sku: "addon_followups_boost_20",
        title: "Buy Follow‑ups boost (10 → 20 / 72h)",
        url: "/vendor/purchases",
      };
    }
    return { action: "upgrade", title: "Upgrade to increase follow‑ups capacity", url: "/vendor/subscription" };
  }

  if (planKey === "MOMENTUM") {
    if (cap < 50) {
      return {
        action: "buy_addon",
        sku: "addon_followups_boost_50",
        title: "Buy Follow‑ups boost (25 → 50 / 72h)",
        url: "/vendor/purchases",
      };
    }
    return { action: "upgrade", title: "Upgrade for more power tools", url: "/vendor/subscription" };
  }

  if (planKey === "APEX") {
    return { action: "none", title: "No follow‑ups boost available on Apex", url: null };
  }

  return { action: "upgrade", title: "Upgrade to unlock follow‑ups", url: "/vendor/subscription" };
}

export async function POST(req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) {
      return Response.json({ ok: false, error: "Missing businessId" }, { status: 400 });
    }

    await requireVendorUnlocked(me.businessId);

    // ✅ includes add-on effects (boosted cap) via limitsServer -> planConfigServer
    const access = await getVendorLimitsResolved(me.businessId);
    const planKey = String(access.planKey || "FREE").toUpperCase();

    if (!access?.features?.followUps) {
      return Response.json(
        {
          ok: false,
          code: "FEATURE_LOCKED",
          error: "Follow-up messages are locked on your plan. Upgrade to use follow-ups.",
          suggestion: { action: "upgrade", url: "/vendor/subscription" },
        },
        { status: 403 }
      );
    }

    const cap = Math.max(0, Math.floor(Number(access?.limits?.followUpsCap72h || 0)));
    if (cap <= 0) {
      return Response.json(
        {
          ok: false,
          code: "FEATURE_LOCKED",
          error: "Follow-up limit is not set for your plan. Contact support.",
          suggestion: { action: "upgrade", url: "/vendor/subscription" },
        },
        { status: 403 }
      );
    }

    const { orderId } = await ctx.params;
    const orderIdClean = String(orderId || "").trim();
    if (!orderIdClean) {
      return Response.json({ ok: false, error: "Missing orderId" }, { status: 400 });
    }

    const orderRef = adminDb.collection("orders").doc(orderIdClean);
    const orderSnap = await orderRef.get();
    if (!orderSnap.exists) {
      return Response.json({ ok: false, error: "Order not found" }, { status: 404 });
    }

    const o = { id: orderSnap.id, ...(orderSnap.data() as any) };

    if (String(o?.businessId || "") !== String(me.businessId || "")) {
      return Response.json({ ok: false, error: "Not allowed" }, { status: 403 });
    }

    const phone = String(o?.customer?.phone || "").trim();
    if (!phone) {
      return Response.json({ ok: false, error: "This order has no customer phone number." }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as any;
    const textOverride = String(body?.text || "").trim();
    const text = (textOverride || buildDefaultText(o)).slice(0, 1000);

    const usageRef = adminDb.collection("vendorUsage").doc(String(me.businessId));
    const logRef = adminDb.collection("followUpLogs").doc();

    const now = Date.now();

    let usedOut = 0;
    let windowStartOut = 0;
    let resetAtOut = 0;

    await adminDb.runTransaction(async (tx) => {
      const usageSnap = await tx.get(usageRef);
      const usage = usageSnap.exists ? (usageSnap.data() as any) : {};

      let windowStartMs = Number(usage.followUpsWindowStartMs || 0);
      let used = Number(usage.followUpsCount72h || 0);

      // reset window if expired or not started
      if (!windowStartMs || now - windowStartMs >= WINDOW_MS) {
        windowStartMs = now;
        used = 0;
      }

      const resetAtMs = windowStartMs + WINDOW_MS;

      if (used >= cap) {
        const err: any = new Error("Follow-up limit reached. Please wait for the timer to reset.");
        err.code = "FOLLOWUP_LIMIT";
        err.resetAtMs = resetAtMs;
        err.used = used;
        err.cap = cap;
        err.windowStartMs = windowStartMs;
        err.planKey = planKey;
        throw err;
      }

      used += 1;

      tx.set(
        usageRef,
        {
          businessId: String(me.businessId),
          followUpsWindowStartMs: windowStartMs,
          followUpsCount72h: used,
          followUpsResetAtMs: resetAtMs,
          updatedAtMs: now,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      tx.set(logRef, {
        businessId: String(me.businessId),
        orderId: orderIdClean,
        toPhone: digitsOnly(phone),
        text,
        createdAtMs: now,
        createdAt: FieldValue.serverTimestamp(),
        createdByUid: me.uid || null,
        planKey,
      });

      usedOut = used;
      windowStartOut = windowStartMs;
      resetAtOut = resetAtMs;
    });

    return Response.json({
      ok: true,
      usage: { cap, used: usedOut, windowStartMs: windowStartOut, resetAtMs: resetAtOut },
      messageText: text,
      waUrl: waLink(phone, text),
    });
  } catch (e: any) {
    if (e?.code === "FOLLOWUP_LIMIT") {
      const cap = Math.max(0, Math.floor(Number(e?.cap || 0)));
      const used = Math.max(0, Math.floor(Number(e?.used || 0)));
      const resetAtMs = Number(e?.resetAtMs || 0);
      const planKey = String(e?.planKey || "FREE");

      return Response.json(
        {
          ok: false,
          code: "FOLLOWUP_LIMIT",
          error: "Follow-up limit reached. Please wait for the timer to reset.",
          resetAtMs,
          usage: { cap, used },
          suggestion: suggestionForLimit({ planKey, cap }),
        },
        { status: 429 }
      );
    }

    if (e?.code === "VENDOR_LOCKED") {
      return Response.json({ ok: false, code: "VENDOR_LOCKED", error: "Subscribe to continue." }, { status: 403 });
    }

    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}