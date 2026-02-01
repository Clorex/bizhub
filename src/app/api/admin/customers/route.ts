import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { dayKeysBetween, monthRangeFromYYYYMM } from "@/lib/metrics/daily";

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

function buyerKeyFromOrder(o: any) {
  const phone = String(o?.customer?.phone || "").trim().replace(/[^\d+]/g, "");
  const email = String(o?.customer?.email || "").trim().toLowerCase();
  return phone || email || "";
}

export async function GET(req: Request) {
  try {
    await requireRole(req, "admin");

    const url = new URL(req.url);
    const range = url.searchParams.get("range") || "week";
    const month = url.searchParams.get("month");
    const { startMs, endMs } = rangeWindow(range, month);

    const startTs = Timestamp.fromMillis(startMs);
    const endTs = Timestamp.fromMillis(endMs);

    const snap = await adminDb
      .collection("orders")
      .where("createdAt", ">=", startTs)
      .where("createdAt", "<=", endTs)
      .limit(5000)
      .get();

    const orders = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    const buyers = new Map<string, any>();

    let revenue = 0;
    for (const o of orders) {
      const amt = Number(o.amount || (o.amountKobo ? o.amountKobo / 100 : 0) || 0);
      revenue += amt;

      const key = buyerKeyFromOrder(o);
      if (!key) continue;

      const cur = buyers.get(key) || {
        key,
        phone: String(o?.customer?.phone || "").trim() || null,
        email: String(o?.customer?.email || "").trim().toLowerCase() || null,
        fullName: String(o?.customer?.fullName || "").trim() || null,
        orders: 0,
        spend: 0,
        lastOrderAtMs: 0,
      };

      cur.orders += 1;
      cur.spend += amt;

      const ms = toMs(o.createdAt);
      if (ms > cur.lastOrderAtMs) cur.lastOrderAtMs = ms;

      buyers.set(key, cur);
    }

    const list = Array.from(buyers.values());
    const uniqueBuyers = list.length;
    const repeatBuyers = list.filter((b) => b.orders >= 2).length;

    // Top buyers by spend
    list.sort((a, b) => Number(b.spend || 0) - Number(a.spend || 0));
    const topBuyers = list.slice(0, 25);

    // Daily series (orders + revenue)
    const dayKeys = dayKeysBetween(startMs, endMs);
    const seriesMap = new Map(dayKeys.map((dk) => [dk, { dayKey: dk, orders: 0, revenue: 0 }]));

    for (const o of orders) {
      const ms = toMs(o.createdAt);
      if (!ms) continue;
      const dk = dayKeyFromMs(ms);
      const row = seriesMap.get(dk);
      if (!row) continue;
      row.orders += 1;
      row.revenue += Number(o.amount || (o.amountKobo ? o.amountKobo / 100 : 0) || 0);
    }

    const series = Array.from(seriesMap.values());

    return NextResponse.json({
      ok: true,
      window: { range, month: month || null, startMs, endMs },
      totals: {
        orders: orders.length,
        revenue,
        uniqueBuyers,
        repeatBuyers,
      },
      topBuyers,
      series,
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}