import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { dayKeysBetween, fetchPlatformDailyMetrics, monthRangeFromYYYYMM } from "@/lib/metrics/daily";
import { Timestamp } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function rangeWindow(range: string, month?: string | null) {
  const now = Date.now();

  // Historical month view: /api/admin/analytics/platform?range=month&month=2026-01
  if (month) {
    const mr = monthRangeFromYYYYMM(month);
    if (mr) return { startMs: mr.startMs, endMs: mr.endMs };
  }

  if (range === "today") {
    const d = new Date();
    const startMs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    return { startMs, endMs: now };
  }

  if (range === "month") {
    return { startMs: now - 30 * 24 * 60 * 60 * 1000, endMs: now };
  }

  // week default
  return { startMs: now - 7 * 24 * 60 * 60 * 1000, endMs: now };
}

export async function GET(req: Request) {
  try {
    await requireRole(req, "admin");

    const url = new URL(req.url);
    const range = url.searchParams.get("range") || "week";
    const month = url.searchParams.get("month"); // optional YYYY-MM
    const { startMs, endMs } = rangeWindow(range, month);

    const dayKeys = dayKeysBetween(startMs, endMs);
    const metricDocs = await fetchPlatformDailyMetrics(dayKeys);

    // Sum totals + create day series
    let visits = 0, leads = 0, views = 0;

    const byDay = new Map<string, any>();
    for (const dk of dayKeys) byDay.set(dk, { dayKey: dk, visits: 0, leads: 0, views: 0 });

    for (const m of metricDocs) {
      const dk = String(m.dayKey || m.id || "");
      const row = byDay.get(dk);
      if (!row) continue;

      const v = Number(m.visits || 0);
      const l = Number(m.leads || 0);
      const w = Number(m.views || 0);

      visits += v;
      leads += l;
      views += w;

      row.visits += v;
      row.leads += l;
      row.views += w;
    }

    const series = Array.from(byDay.values());

    // Revenue/orders for same window (MVP: limit 5000)
    const startTs = Timestamp.fromMillis(startMs);
    const endTs = Timestamp.fromMillis(endMs);

    const oSnap = await adminDb
      .collection("orders")
      .where("createdAt", ">=", startTs)
      .where("createdAt", "<=", endTs)
      .limit(5000)
      .get();

    const orders = oSnap.docs.map((d) => d.data() as any);
    const orderCount = orders.length;

    let revenue = 0;
    for (const o of orders) {
      revenue += Number(o.amount || (o.amountKobo ? o.amountKobo / 100 : 0) || 0);
    }

    // Daily change (today vs yesterday) from platformMetricsDaily
    const todayKey = dayKeys[dayKeys.length - 1];
    const yKey = dayKeys.length >= 2 ? dayKeys[dayKeys.length - 2] : null;

    const todayRow = todayKey ? byDay.get(todayKey) : null;
    const yRow = yKey ? byDay.get(yKey) : null;

    function delta(cur: number, prev: number) {
      const d = cur - prev;
      const pct = prev > 0 ? (d / prev) * 100 : null;
      return { diff: d, pct };
    }

    const deltas = todayRow && yRow ? {
      visits: delta(Number(todayRow.visits || 0), Number(yRow.visits || 0)),
      leads: delta(Number(todayRow.leads || 0), Number(yRow.leads || 0)),
      views: delta(Number(todayRow.views || 0), Number(yRow.views || 0)),
    } : null;

    return NextResponse.json({
      ok: true,
      window: { range, month: month || null, startMs, endMs },
      totals: {
        visits,
        leads,
        views,
        orders: orderCount,
        revenue,
      },
      deltas,
      series, // per-day chart data
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}