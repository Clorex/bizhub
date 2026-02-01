import { NextResponse } from "next/server";
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

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const type = String(body.type || "");
    const businessId = String(body.businessId || "");
    const businessSlug = String(body.businessSlug || "");
    const productId = body.productId ? String(body.productId) : "";
    const count = clampCount(body.count);

    if (!businessId || !type) {
      return NextResponse.json({ ok: false, error: "businessId and type required" }, { status: 400 });
    }

    const dk = dayKey();

    // ===== Business daily metrics =====
    const bizDocId = `${businessId}_${dk}`;
    const bizRef = adminDb.collection("businessMetricsDaily").doc(bizDocId);

    const inc: any = {
      updatedAt: FieldValue.serverTimestamp(),
      businessId,
      businessSlug: businessSlug || null,
      dayKey: dk,
    };

    // Definitions:
    // visits = store_visit + product_view
    // leads = market_click + store_product_click
    // views = market_impression
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
      return NextResponse.json({ ok: false, error: "Unknown type" }, { status: 400 });
    }

    await bizRef.set(inc, { merge: true });

    // ===== Product daily metrics (optional) =====
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

    // ===== Platform daily metrics (NEW) =====
    // Doc ID = dayKey (easy month history lookup without indexes)
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

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}