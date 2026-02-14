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

export async function GET(req: Request) {
  try {
    const me = await requireMe(req);

    // Query orders where customerId matches the logged-in user
    const byCustomerId = await adminDb
      .collection("orders")
      .where("customerId", "==", me.uid)
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    // Also query by customer email as fallback (for orders created before customerId was stored)
    let byEmailDocs: any[] = [];
    if (me.email) {
      const byEmail = await adminDb
        .collection("orders")
        .where("customer.email", "==", me.email.toLowerCase())
        .orderBy("createdAt", "desc")
        .limit(100)
        .get();
      byEmailDocs = byEmail.docs;
    }

    // Also check localStorage-based recent order IDs sent as query param
    const url = new URL(req.url);
    const recentIdsParam = url.searchParams.get("recentIds") || "";
    const recentIds = recentIdsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 50);

    let recentDocs: any[] = [];
    if (recentIds.length > 0) {
      const refs = recentIds.map((id) => adminDb.collection("orders").doc(id));
      const snaps = await (adminDb as any).getAll(...refs);
      recentDocs = snaps.filter((s: any) => s && s.exists);
    }

    // Merge and deduplicate
    const seen = new Set<string>();
    const allDocs: any[] = [];

    for (const doc of [...byCustomerId.docs, ...byEmailDocs, ...recentDocs]) {
      if (!seen.has(doc.id)) {
        seen.add(doc.id);
        allDocs.push(doc);
      }
    }

    const orders = allDocs.map((d) => {
      const o = { id: d.id, ...(d.data ? d.data() : d) };
      return {
        id: o.id,
        orderNumber: (o as any).orderNumber ?? null,
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

    // Sort by createdAt descending
    orders.sort((a, b) => {
      const aMs = a.createdAtMs || toMs(a.createdAt);
      const bMs = b.createdAtMs || toMs(b.createdAt);
      return bMs - aMs;
    });

    return Response.json({ ok: true, orders, count: orders.length });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}
