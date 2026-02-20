// FILE: src/app/api/track/route.ts

import { unlockAchievement } from "@/lib/achievements/server";
import { adminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function clampCount(n: any) {
  const c = Number(n || 1);
  if (!Number.isFinite(c) || c <= 0) return 1;
  return Math.min(500, Math.floor(c));
}

// Hash a user identifier for privacy-safe intent tracking
function anonymize(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return `anon_${Math.abs(hash).toString(36)}`;
}

// Intent event types that we track for Buyer Intent Radar
const INTENT_EVENT_TYPES = new Set([
  "intent_product_view",
  "intent_repeat_view",
  "intent_time_spent",
  "intent_add_to_cart",
  "intent_save",
  "intent_contact_click",
  "intent_checkout_start",
  "intent_compare",
  "intent_store_revisit",
]);

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const type = String(body.type || "");
    const businessId = String(body.businessId || "");
    const businessSlug = String(body.businessSlug || "");
    const productId = body.productId ? String(body.productId) : "";
    const count = clampCount(body.count);

    if (!businessId || !type) {
      return Response.json({ ok: false, error: "businessId and type required" }, { status: 400 });
    }

    // ===== BUYER INTENT EVENTS =====
    if (INTENT_EVENT_TYPES.has(type)) {
      if (!productId) {
        return Response.json({ ok: false, error: "productId required for intent events" }, { status: 400 });
      }

      const userId = String(body.userId || body.sessionId || "unknown");
      const anonId = anonymize(userId + businessId);
      const durationSeconds = Math.max(0, Math.min(3600, Number(body.durationSeconds || 0)));
      const eventType = type.replace("intent_", "");

      await adminDb.collection("buyerIntentEvents").add({
        product_id: productId,
        business_id: businessId,
        anonymous_id: anonId,
        event_type: eventType,
        duration_seconds: durationSeconds || null,
        created_at: Date.now(),
        createdAt: FieldValue.serverTimestamp(),
      });

      return Response.json({ ok: true });
    }

    // ===== EXISTING TRACKING LOGIC =====
    const dk = dayKey();

    // Business daily metrics
    const bizDocId = `${businessId}_${dk}`;
    const bizRef = adminDb.collection("businessMetricsDaily").doc(bizDocId);

    const inc: any = {
      updatedAt: FieldValue.serverTimestamp(),
      businessId,
      businessSlug: businessSlug || null,
      dayKey: dk,
    };

    if (type === "store_visit") {
      inc.visits = FieldValue.increment(count);
      inc.storeVisits = FieldValue.increment(count);
    } else if (type === "product_view") {
      inc.visits = FieldValue.increment(count);
      inc.productViews = FieldValue.increment(count);
    } else if (type === "market_click") {
      inc.leads = FieldValue.increment(count);
      inc.marketClicks = FieldValue.increment(count);
    } else if (type === "store_product_click") {
      inc.leads = FieldValue.increment(count);
      inc.storeProductClicks = FieldValue.increment(count);
    } else if (type === "market_impression") {
      inc.views = FieldValue.increment(count);
      inc.marketImpressions = FieldValue.increment(count);
    } else {
      return Response.json({ ok: false, error: "Unknown type" }, { status: 400 });
    }

    await bizRef.set(inc, { merge: true });

    // Achievement: first store visit
    if (type === "store_visit" && businessId) {
      unlockAchievement({
        actorType: "vendor",
        actorId: businessId,
        key: "vendor_first_visit",
      }).catch(() => {});
    }

    // Product daily metrics (optional)
    if (productId) {
      const prodDocId = `${productId}_${dk}`;
      const prodRef = adminDb.collection("productMetricsDaily").doc(prodDocId);

      const pinc: any = {
        updatedAt: FieldValue.serverTimestamp(),
        productId,
        businessId,
        businessSlug: businessSlug || null,
        dayKey: dk,
      };

      if (type === "product_view") pinc.visits = FieldValue.increment(count);
      if (type === "market_click" || type === "store_product_click") pinc.leads = FieldValue.increment(count);
      if (type === "market_impression") pinc.views = FieldValue.increment(count);

      await prodRef.set(pinc, { merge: true });
    }

    // Platform daily metrics
    const platRef = adminDb.collection("platformMetricsDaily").doc(dk);

    const plinc: any = {
      updatedAt: FieldValue.serverTimestamp(),
      dayKey: dk,
    };

    if (type === "store_visit") {
      plinc.visits = FieldValue.increment(count);
      plinc.storeVisits = FieldValue.increment(count);
    } else if (type === "product_view") {
      plinc.visits = FieldValue.increment(count);
      plinc.productViews = FieldValue.increment(count);
    } else if (type === "market_click") {
      plinc.leads = FieldValue.increment(count);
      plinc.marketClicks = FieldValue.increment(count);
    } else if (type === "store_product_click") {
      plinc.leads = FieldValue.increment(count);
      plinc.storeProductClicks = FieldValue.increment(count);
    } else if (type === "market_impression") {
      plinc.views = FieldValue.increment(count);
      plinc.marketImpressions = FieldValue.increment(count);
    }

    await platRef.set(plinc, { merge: true });

    return Response.json({ ok: true });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}
