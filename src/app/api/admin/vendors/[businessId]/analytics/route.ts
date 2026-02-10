// FILE: src/app/api/admin/vendors/[businessId]/analytics/route.ts

import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { dayKeysBetween, fetchBusinessDailyMetrics, monthRangeFromYYYYMM } from "@/lib/metrics/daily";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rangeWindow(range: string, month?: string | null) {
  const now = Date.now();

  if (month) {
    const mr = monthRangeFromYYYYMM(month);
    if (mr) return { startMs: mr.startMs, endMs: mr.endMs };
  }

  if (range === "today") {
    const d = new Date();
    const startMs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return { startMs, endMs: now };
  }

  if (range === "month") return { startMs: now - 30 * 24 * 60 * 60 * 1000, endMs: now };
  return { startMs: now - 7 * 24 * 60 * 60 * 1000, endMs: now };
}

function toMs(v: any) {
  try {
    if (!v) return 0;
    if (typeof v?.toDate === "function") return v.toDate().getTime();
    if (typeof v?.seconds === "number") return v.seconds * 1000;
    return 0;
  } catch {
    return 0;
  }
}

function dayKeyFromMs(ms: number) {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// ✅ Next.js 16 route handler typing: params is a Promise
export async function GET(req: Request, ctx: { params: Promise<{ businessId: string }> }) {
  try {
    await requireRole(req, "admin");

    const { businessId } = await ctx.params;
    const businessIdClean = String(businessId || "").trim();
    if (!businessIdClean) return Response.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    const url = new URL(req.url);
    const range = url.searchParams.get("range") || "week";
    const month = url.searchParams.get("month"); // optional YYYY-MM
    const { startMs, endMs } = rangeWindow(range, month);

    // Business details
    const bizSnap = await adminDb.collection("businesses").doc(businessIdClean).get();
    if (!bizSnap.exists) return Response.json({ ok: false, error: "Business not found" }, { status: 404 });
    const biz = { id: bizSnap.id, ...(bizSnap.data() as any) };

    // Orders for window
    const startTs = Timestamp.fromMillis(startMs);
    const endTs = Timestamp.fromMillis(endMs);

    const oSnap = await adminDb
      .collection("orders")
      .where("businessId", "==", businessIdClean)
      .where("createdAt", ">=", startTs)
      .where("createdAt", "<=", endTs)
      .limit(2000)
      .get();

    const orders = oSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    // Compute sales metrics
    let revenue = 0;
    let productsSold = 0;
    const customerSet = new Set<string>();

    for (const o of orders) {
      revenue += Number(o.amount || (o.amountKobo ? o.amountKobo / 100 : 0) || 0);
      const items = Array.isArray(o.items) ? o.items : [];
      for (const it of items) productsSold += Number(it.qty || 1);

      const phone = String(o?.customer?.phone || "").trim();
      const email = String(o?.customer?.email || "").trim().toLowerCase();
      const key = phone || email;
      if (key) customerSet.add(key);
    }

    // Tracking metrics for window
    const dayKeys = dayKeysBetween(startMs, endMs);
    const metricDocs = await fetchBusinessDailyMetrics({ businessId: businessIdClean, dayKeys });

    // sum totals + create daily series map (traffic)
    let visits = 0,
      leads = 0,
      views = 0;

    const trafficMap = new Map(dayKeys.map((dk) => [dk, { dayKey: dk, visits: 0, leads: 0, views: 0 }]));
    for (const m of metricDocs) {
      const dk = String((m as any).dayKey || "");
      const row = trafficMap.get(dk);
      if (!row) continue;

      const v = Number((m as any).visits || 0);
      const l = Number((m as any).leads || 0);
      const w = Number((m as any).views || 0);

      visits += v;
      leads += l;
      views += w;

      row.visits += v;
      row.leads += l;
      row.views += w;
    }

    // Daily revenue series (same dayKeys window)
    const revenueMap = new Map(dayKeys.map((dk) => [dk, { dayKey: dk, revenue: 0, orders: 0 }]));
    for (const o of orders) {
      const ms = toMs(o.createdAt);
      if (!ms) continue;
      const dk = dayKeyFromMs(ms);
      const row = revenueMap.get(dk);
      if (!row) continue;
      row.orders += 1;
      row.revenue += Number(o.amount || (o.amountKobo ? o.amountKobo / 100 : 0) || 0);
    }

    const revenueSeries = Array.from(revenueMap.values());
    const trafficSeries = Array.from(trafficMap.values());

    // Recent orders (latest 10 within window)
    const recentOrders = [...orders]
      .sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))
      .slice(0, 10)
      .map((o) => ({
        id: o.id,
        amount: Number(o.amount || (o.amountKobo ? o.amountKobo / 100 : 0) || 0),
        paymentType: o.paymentType || null,
        orderStatus: o.orderStatus || null,
        escrowStatus: o.escrowStatus || null,
        createdAt: o.createdAt || null,
      }));

    return Response.json({
      ok: true,
      window: { range, month: month || null, startMs, endMs },
      business: {
        id: biz.id,
        name: biz.name ?? null,
        slug: biz.slug ?? null,
        trial: biz.trial ?? null,
        subscription: biz.subscription ?? null,
      },
      overview: {
        revenue,
        orders: orders.length,
        productsSold,
        customers: customerSet.size,
        visits,
        leads,
        views,
      },
      charts: {
        revenueSeries,
        trafficSeries,
      },
      recentOrders,
    });
  } catch (e: any) {
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}