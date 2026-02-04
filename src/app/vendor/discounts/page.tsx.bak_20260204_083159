import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";
import { getVendorLimitsResolved } from "@/lib/vendor/limitsServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clampInt(n: any, min: number, max: number) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function clampNumber(n: any, min: number, max: number) {
  const v = Number(n);
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function cleanStr(v: any, max = 80) {
  return String(v || "").trim().slice(0, max);
}

function cleanType(v: any): "percent" | "fixed" {
  return String(v || "percent") === "fixed" ? "fixed" : "percent";
}

function cleanProductIds(v: any): string[] {
  if (!Array.isArray(v)) return [];
  const out = v
    .map((x) => String(x || "").trim())
    .filter(Boolean)
    .slice(0, 5000);
  return Array.from(new Set(out));
}

function parseMs(v: any): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.floor(n);
}

// caps you requested
function productCapForPlan(planKey: string): number {
  const k = String(planKey || "FREE").toUpperCase();
  if (k === "APEX") return 5000; // "unlimited" safe cap
  if (k === "MOMENTUM") return 50;
  if (k === "LAUNCH") return 30;
  return 5;
}

async function commitBatches(writes: Array<{ ref: any; data: any }>) {
  const CHUNK = 400;
  for (let i = 0; i < writes.length; i += CHUNK) {
    const chunk = writes.slice(i, i + CHUNK);
    const b = adminDb.batch();
    for (const w of chunk) b.set(w.ref, w.data, { merge: true });
    await b.commit();
  }
}

function saleBoostAllowed(planKey: string) {
  const k = String(planKey || "FREE").toUpperCase();
  return k === "MOMENTUM" || k === "APEX";
}

export async function GET(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });
    await requireVendorUnlocked(me.businessId);

    const access = await getVendorLimitsResolved(me.businessId);
    const planKey = String(access.planKey || "FREE").toUpperCase();
    const cap = productCapForPlan(planKey);

    const snap = await adminDb.collection("businesses").doc(me.businessId).collection("discounts").limit(200).get();

    const discounts = snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as any) }))
      .sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));

    return NextResponse.json({
      ok: true,
      meta: {
        planKey,
        hasActiveSubscription: access.hasActiveSubscription,
        productSelectCap: cap,
        productSelectCapLabel: planKey === "APEX" ? "Unlimited" : String(cap),
        salesBoostOnMarket: saleBoostAllowed(planKey),
      },
      discounts,
    });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json({ ok: false, code: "VENDOR_LOCKED", error: "Subscribe to continue." }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });
    await requireVendorUnlocked(me.businessId);

    const access = await getVendorLimitsResolved(me.businessId);
    const planKey = String(access.planKey || "FREE").toUpperCase();
    const cap = productCapForPlan(planKey);
    const boostAllowed = saleBoostAllowed(planKey);

    const body = await req.json().catch(() => ({}));

    const discountId = cleanStr(body.discountId, 80) || "";
    const name = cleanStr(body.name, 60) || null;

    const type = cleanType(body.type);
    const percent = type === "percent" ? clampInt(body.percent, 1, 90) : null;
    const amountOffNgn = type === "fixed" ? clampNumber(body.amountOffNgn, 1, 1_000_000) : null;

    const startsAtMs = parseMs(body.startsAtMs);
    const endsAtMs = parseMs(body.endsAtMs);
    const active = body.active === false ? false : true;

    const productIds = cleanProductIds(body.productIds);

    if (productIds.length < 1) return NextResponse.json({ ok: false, error: "Select at least 1 product" }, { status: 400 });
    if (productIds.length > cap) {
      return NextResponse.json(
        { ok: false, code: "PLAN_LIMIT", error: `Your plan allows sales on up to ${cap} products.`, limit: cap },
        { status: 403 }
      );
    }

    if (startsAtMs && endsAtMs && endsAtMs <= startsAtMs) {
      return NextResponse.json({ ok: false, error: "End date must be after start date" }, { status: 400 });
    }
    if (type === "fixed" && (!amountOffNgn || amountOffNgn <= 0)) {
      return NextResponse.json({ ok: false, error: "Fixed amount must be greater than 0" }, { status: 400 });
    }

    const nowMs = Date.now();

    const discountRef = discountId
      ? adminDb.collection("businesses").doc(me.businessId).collection("discounts").doc(discountId)
      : adminDb.collection("businesses").doc(me.businessId).collection("discounts").doc();

    const existingSnap = await discountRef.get();
    const existing = existingSnap.exists ? (existingSnap.data() as any) : null;
    const oldProductIds: string[] = existing ? cleanProductIds(existing.productIds) : [];

    const nextDoc = {
      businessId: me.businessId,
      businessSlug: me.businessSlug ?? null,

      name,

      type,
      percent,
      amountOffNgn,

      productIds,

      active,

      startsAtMs: startsAtMs ?? null,
      endsAtMs: endsAtMs ?? null,

      createdAtMs: existing?.createdAtMs || nowMs,
      updatedAtMs: nowMs,

      createdAt: existing?.createdAt || FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),

      createdByUid: existing?.createdByUid || me.uid,
      updatedByUid: me.uid,
    };

    await discountRef.set(nextDoc, { merge: true });

    const discountIdFinal = discountRef.id;

    const nextSet = new Set(productIds);
    const toRemove = oldProductIds.filter((id) => !nextSet.has(id));
    const toAddOrUpdate = productIds;

    // saleMarketBoost should be true only for Momentum/Apex AND only if this sale is active
    const saleMarketBoost = boostAllowed === true && active === true;

    const writes: Array<{ ref: any; data: any }> = [];

    for (const pid of toRemove) {
      const pRef = adminDb.collection("products").doc(pid);
      writes.push({
        ref: pRef,
        data: {
          saleActive: false,
          saleId: FieldValue.delete(),
          saleType: FieldValue.delete(),
          salePercent: FieldValue.delete(),
          saleAmountOffNgn: FieldValue.delete(),
          saleStartsAtMs: FieldValue.delete(),
          saleEndsAtMs: FieldValue.delete(),
          saleName: FieldValue.delete(),
          saleUpdatedAtMs: nowMs,
          saleMarketBoost: FieldValue.delete(),
        },
      });
    }

    for (const pid of toAddOrUpdate) {
      const pRef = adminDb.collection("products").doc(pid);
      writes.push({
        ref: pRef,
        data: {
          saleActive: active,
          saleId: discountIdFinal,
          saleType: type,
          salePercent: percent,
          saleAmountOffNgn: amountOffNgn,
          saleStartsAtMs: startsAtMs ?? null,
          saleEndsAtMs: endsAtMs ?? null,
          saleName: name,
          saleUpdatedAtMs: nowMs,

          // ✅ only Momentum/Apex get boosted market deals
          saleMarketBoost,
        },
      });
    }

    await commitBatches(writes);

    return NextResponse.json({ ok: true, discountId: discountIdFinal });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json({ ok: false, code: "VENDOR_LOCKED", error: "Subscribe to continue." }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });
    await requireVendorUnlocked(me.businessId);

    const url = new URL(req.url);
    const discountId = cleanStr(url.searchParams.get("discountId"), 80);
    if (!discountId) return NextResponse.json({ ok: false, error: "discountId required" }, { status: 400 });

    const ref = adminDb.collection("businesses").doc(me.businessId).collection("discounts").doc(discountId);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

    const d = snap.data() as any;
    const productIds = cleanProductIds(d.productIds);

    const nowMs = Date.now();

    const writes: Array<{ ref: any; data: any }> = [];
    for (const pid of productIds) {
      const pRef = adminDb.collection("products").doc(pid);
      writes.push({
        ref: pRef,
        data: {
          saleActive: false,
          saleId: FieldValue.delete(),
          saleType: FieldValue.delete(),
          salePercent: FieldValue.delete(),
          saleAmountOffNgn: FieldValue.delete(),
          saleStartsAtMs: FieldValue.delete(),
          saleEndsAtMs: FieldValue.delete(),
          saleName: FieldValue.delete(),
          saleUpdatedAtMs: nowMs,
          saleMarketBoost: FieldValue.delete(),
        },
      });
    }

    await commitBatches(writes);
    await ref.delete();

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json({ ok: false, code: "VENDOR_LOCKED", error: "Subscribe to continue." }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}