import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { findAddonBySku } from "@/lib/vendor/addons/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function paystackSecret() {
  return process.env.PAYSTACK_SECRET_KEY || "";
}

async function paystackVerify(reference: string) {
  const sk = paystackSecret();
  if (!sk) throw new Error("Missing PAYSTACK_SECRET_KEY");

  const r = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: { Authorization: `Bearer ${sk}` },
  });

  const j = await r.json().catch(() => ({}));
  if (!j?.status) throw new Error(j?.message || "Paystack verify failed");
  return j?.data;
}

function durationMs(cycle: "monthly" | "yearly") {
  return cycle === "monthly" ? 30 * 86400000 : 365 * 86400000;
}

function mergeEntitlement(existing: any, addMs: number, nowMs: number) {
  const status = String(existing?.status || "inactive");
  const expiresAtMs = Number(existing?.expiresAtMs || 0);
  const remainingMs = Number(existing?.remainingMs || 0);

  if (status === "active" && expiresAtMs > nowMs) {
    return { status: "active", expiresAtMs: expiresAtMs + addMs, remainingMs: 0 };
  }

  if (status === "paused" && remainingMs > 0) {
    return { status: "paused", expiresAtMs: 0, remainingMs: remainingMs + addMs };
  }

  return { status: "active", expiresAtMs: nowMs + addMs, remainingMs: 0 };
}

export async function POST(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    const body = await req.json().catch(() => ({}));
    const reference = String(body.reference || "").trim();
    if (!reference) return NextResponse.json({ ok: false, error: "reference is required" }, { status: 400 });

    // Idempotency
    const purchaseRef = adminDb.collection("addonPurchases").doc(reference);
    const purchaseSnap = await purchaseRef.get();
    if (purchaseSnap.exists) {
      return NextResponse.json({ ok: true, alreadyConfirmed: true, purchase: purchaseSnap.data() });
    }

    // Load intent (guard)
    const intentRef = adminDb.collection("addonPurchaseIntents").doc(reference);
    const intentSnap = await intentRef.get();
    const intent = intentSnap.exists ? (intentSnap.data() as any) : null;

    if (!intent || String(intent.businessId || "") !== me.businessId) {
      return NextResponse.json({ ok: false, error: "Purchase intent not found" }, { status: 404 });
    }

    // Verify Paystack
    const tx = await paystackVerify(reference);
    if (String(tx?.status || "") !== "success") {
      return NextResponse.json({ ok: false, error: `Payment not successful: ${tx?.status || "unknown"}` }, { status: 400 });
    }

    const md = (tx?.metadata || {}) as any;
    if (String(md?.type || "") !== "addon") {
      return NextResponse.json({ ok: false, error: "Invalid purchase type" }, { status: 400 });
    }

    const sku = String(md?.sku || intent.sku || "").trim();
    const cycle = String(md?.cycle || intent.cycle || "yearly").toLowerCase() === "monthly" ? "monthly" : "yearly";

    const addon = findAddonBySku(sku);
    if (!addon) return NextResponse.json({ ok: false, error: "Unknown add-on sku" }, { status: 400 });

    // Amount validation
    const paidKobo = Number(tx?.amount || 0);
    const expectedKobo = Math.round(Number(addon.priceNgn?.[cycle] || 0) * 100);
    if (!expectedKobo || paidKobo !== expectedKobo) {
      return NextResponse.json({ ok: false, error: "Amount mismatch" }, { status: 400 });
    }

    const nowMs = Date.now();
    const addMs = durationMs(cycle);

    const bizRef = adminDb.collection("businesses").doc(me.businessId);

    let grantedExpiresAtMs: number | null = null;

    await adminDb.runTransaction(async (t) => {
      const bizSnap = await t.get(bizRef);
      const biz = bizSnap.exists ? (bizSnap.data() as any) : {};

      const entMap =
        biz?.addonEntitlements && typeof biz.addonEntitlements === "object" ? biz.addonEntitlements : {};

      const existing = entMap[sku] || {};
      const merged = mergeEntitlement(existing, addMs, nowMs);

      grantedExpiresAtMs = merged.status === "active" ? Number(merged.expiresAtMs || 0) : null;

      entMap[sku] = {
        sku,
        kind: addon.kind,
        plan: addon.plan,
        cycle,
        status: merged.status,
        expiresAtMs: merged.expiresAtMs || null,
        remainingMs: merged.remainingMs || null,
        updatedAtMs: nowMs,
        purchaseCount: FieldValue.increment(1),
      };

      // Bundle: grant included items too
      if (addon.kind === "bundle" && Array.isArray(addon.includesSkus)) {
        for (const childSku of addon.includesSkus) {
          const child = findAddonBySku(childSku);
          if (!child) continue;

          const ex = entMap[childSku] || {};
          const m2 = mergeEntitlement(ex, addMs, nowMs);

          entMap[childSku] = {
            sku: childSku,
            kind: "item",
            plan: addon.plan,
            cycle,
            status: m2.status,
            expiresAtMs: m2.expiresAtMs || null,
            remainingMs: m2.remainingMs || null,
            updatedAtMs: nowMs,
            viaBundleSku: sku,
            purchaseCount: FieldValue.increment(1),
          };
        }
      }

      t.set(
        bizRef,
        { addonEntitlements: entMap, updatedAt: FieldValue.serverTimestamp() },
        { merge: true }
      );

      t.set(purchaseRef, {
        reference,
        businessId: me.businessId,
        uid: me.uid,
        sku,
        cycle,
        kind: addon.kind,
        amountKobo: paidKobo,
        amount: paidKobo / 100,
        currency: tx?.currency || "NGN",
        provider: "paystack",
        paidAt: tx?.paid_at || null,
        paidAtMs: nowMs,
        createdAt: FieldValue.serverTimestamp(),
        createdAtMs: nowMs,
        status: "paid",
      });
    });

    // ✅ Admin notification (match your subscription style)
    try {
      const bizSnap = await adminDb.collection("businesses").doc(me.businessId).get();
      const biz = bizSnap.exists ? (bizSnap.data() as any) : {};
      const businessSlug = biz?.slug ?? null;

      await adminDb.collection("adminNotifications").doc().set({
        type: "addon_paid",
        reference: String(reference),
        businessId: me.businessId,
        businessSlug,
        planKey: addon.plan, // plan that this add-on belongs to
        cycle, // monthly/yearly for add-on
        sku,
        amountKobo: paidKobo,
        currency: tx?.currency || "NGN",
        paidAt: tx?.paid_at || null,
        expiresAtMs: grantedExpiresAtMs,
        createdAt: FieldValue.serverTimestamp(),
        createdAtMs: nowMs,
        read: false,
      });
    } catch {
      // ignore
    }

    return NextResponse.json({ ok: true, reference });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}