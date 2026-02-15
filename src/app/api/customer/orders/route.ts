// FILE: src/app/api/customer/orders/route.ts
import { requireMe } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toMs(v: any) {
  try {
    if (!v) return 0;
    if (typeof v?.toDate === "function") return v.toDate().getTime();
    if (typeof v?.seconds === "number") return v.seconds * 1000;
    if (typeof v?._seconds === "number") return v._seconds * 1000;
    if (typeof v === "number") return v;
    if (typeof v === "string") { const d = new Date(v); return isNaN(d.getTime()) ? 0 : d.getTime(); }
    return 0;
  } catch { return 0; }
}

/**
 * Safe query helper: tries the indexed query first, falls back to
 * unordered query if the composite index does not exist yet.
 */
async function safeQuery(
  col: FirebaseFirestore.CollectionReference,
  field: string,
  value: string,
  maxResults = 100
) {
  try {
    // Try ordered query (requires composite index)
    const snap = await col
      .where(field, "==", value)
      .orderBy("createdAt", "desc")
      .limit(maxResults)
      .get();
    return snap.docs;
  } catch (e: any) {
    const msg = String(e?.message || e?.code || "");
    if (msg.includes("FAILED_PRECONDITION") || msg.includes("requires an index") || msg.includes("index")) {
      console.warn(`[customer/orders] Index missing for ${field}, falling back to unordered query. Create the composite index to fix this.`);
      // Fallback: query without orderBy (no composite index needed)
      try {
        const snap = await col
          .where(field, "==", value)
          .limit(maxResults)
          .get();
        return snap.docs;
      } catch (e2: any) {
        console.error(`[customer/orders] Fallback query also failed for ${field}:`, e2?.message);
        return [];
      }
    }
    console.error(`[customer/orders] Query failed for ${field}:`, e?.message);
    return [];
  }
}

export async function GET(req: Request) {
  try {
    const me = await requireMe(req);
    const ordersCol = adminDb.collection("orders");

    // Query 1: by customerId
    const byCustomerIdDocs = await safeQuery(ordersCol, "customerId", me.uid);

    // Query 2: by customer.email (fallback for older orders)
    let byEmailDocs: any[] = [];
    if (me.email) {
      byEmailDocs = await safeQuery(ordersCol, "customer.email", me.email.toLowerCase());
    }

    // Query 3: localStorage-based recent order IDs
    const url = new URL(req.url);
    const recentIdsParam = url.searchParams.get("recentIds") || "";
    const recentIds = recentIdsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50);

    let recentDocs: any[] = [];
    if (recentIds.length > 0) {
      try {
        const refs = recentIds.map((id) => ordersCol.doc(id));
        const snaps = await (adminDb as any).getAll(...refs);
        recentDocs = snaps.filter((s: any) => s && s.exists);
      } catch (e: any) {
        console.error("[customer/orders] Recent IDs fetch failed:", e?.message);
      }
    }

    // Merge and deduplicate
    const seen = new Set<string>();
    const allDocs: any[] = [];

    for (const doc of [...byCustomerIdDocs, ...byEmailDocs, ...recentDocs]) {
      if (doc && !seen.has(doc.id)) {
        seen.add(doc.id);
        allDocs.push(doc);
      }
    }

    const orders = allDocs.map((d) => {
      const o = { id: d.id, ...(d.data ? d.data() : d) };
      return {
        id: o.id,
        orderNumber: (o as any).orderNumber ?? null,
        displayOrderRef: (o as any).displayOrderRef ?? null,
        createdAt: (o as any).createdAt ?? null,
        createdAtMs: (o as any).createdAtMs ?? toMs((o as any).createdAt),
        paymentType: (o as any).paymentType ?? null,
        escrowStatus: (o as any).escrowStatus ?? null,
        orderStatus: (o as any).orderStatus ?? null,
        opsStatus: (o as any).opsStatus ?? null,
        opsStatusEffective: (o as any).opsStatus || (o as any).orderStatus || "new",
        amount: (o as any).amount ?? null,
        amountKobo: (o as any).amountKobo ?? null,
        items: Array.isArray((o as any).items) ? (o as any).items : [],
        customer: (o as any).customer ?? null,
        businessSlug: (o as any).businessSlug ?? (o as any).storeSlug ?? null,
        orderSource: (o as any).orderSource ?? null,
      };
    });

    // Sort client-side (always works, no index needed)
    orders.sort((a, b) => {
      const aMs = a.createdAtMs || toMs(a.createdAt);
      const bMs = b.createdAtMs || toMs(b.createdAt);
      return bMs - aMs;
    });

    return Response.json({ ok: true, orders, count: orders.length });
  } catch (e: any) {
    // Never expose raw Firestore errors to the user
    const raw = String(e?.message || "");
    console.error("[customer/orders] Error:", raw);

    const friendly = raw.includes("Missing Authorization")
      ? "Please sign in to view your orders."
      : "Could not load orders. Please try again.";

    return Response.json({ ok: false, error: friendly }, { status: 500 });
  }
}
