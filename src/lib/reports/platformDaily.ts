import { adminDb } from "@/lib/firebase/admin";

function dayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number) {
  const x = new Date(d.getTime());
  x.setDate(x.getDate() + n);
  return x;
}

function pct(cur: number, prev: number) {
  if (!prev) return null;
  return ((cur - prev) / prev) * 100;
}

function fmtNaira(n: number) {
  try {
    return `₦${Number(n || 0).toLocaleString()}`;
  } catch {
    return `₦${n}`;
  }
}

export async function buildDailyPlatformReport(params?: { date?: Date }) {
  const date = params?.date ?? new Date();

  const today = startOfDay(date);
  const yesterday = addDays(today, -1);

  const dkToday = dayKey(today);
  const dkYesterday = dayKey(yesterday);

  const [mTodaySnap, mYestSnap] = await Promise.all([
    adminDb.collection("platformMetricsDaily").doc(dkToday).get(),
    adminDb.collection("platformMetricsDaily").doc(dkYesterday).get(),
  ]);

  const mToday = mTodaySnap.exists ? (mTodaySnap.data() as any) : {};
  const mYest = mYestSnap.exists ? (mYestSnap.data() as any) : {};

  const tVisits = Number(mToday.visits || 0);
  const tLeads = Number(mToday.leads || 0);
  const tViews = Number(mToday.views || 0);

  const yVisits = Number(mYest.visits || 0);
  const yLeads = Number(mYest.leads || 0);
  const yViews = Number(mYest.views || 0);

  // Orders today
  const startMs = today.getTime();
  const endMs = addDays(today, 1).getTime() - 1;

  // Firestore Admin Timestamp query
  const { Timestamp } = await import("firebase-admin/firestore");
  const oSnap = await adminDb
    .collection("orders")
    .where("createdAt", ">=", Timestamp.fromMillis(startMs))
    .where("createdAt", "<=", Timestamp.fromMillis(endMs))
    .limit(5000)
    .get();

  const orders = oSnap.docs.map((d) => d.data() as any);
  const orderCount = orders.length;

  let revenue = 0;
  for (const o of orders) {
    revenue += Number(o.amount || (o.amountKobo ? o.amountKobo / 100 : 0) || 0);
  }

  const lines: string[] = [];
  lines.push(`BizHub Daily Report — ${dkToday}`);
  lines.push(``);
  lines.push(`Traffic`);
  lines.push(`- Views:  ${tViews.toLocaleString()} (${pct(tViews, yViews) == null ? "—" : pct(tViews, yViews)!.toFixed(1) + "%"})`);
  lines.push(`- Leads:  ${tLeads.toLocaleString()} (${pct(tLeads, yLeads) == null ? "—" : pct(tLeads, yLeads)!.toFixed(1) + "%"})`);
  lines.push(`- Visits: ${tVisits.toLocaleString()} (${pct(tVisits, yVisits) == null ? "—" : pct(tVisits, yVisits)!.toFixed(1) + "%"})`);
  lines.push(``);
  lines.push(`Sales`);
  lines.push(`- Orders: ${orderCount.toLocaleString()}`);
  lines.push(`- Revenue: ${fmtNaira(revenue)}`);
  lines.push(``);
  lines.push(`Notes`);
  lines.push(`- Views = market impressions`);
  lines.push(`- Leads = clicks (market/store)`);
  lines.push(`- Visits = store + product views`);
  lines.push(``);

  return {
    dayKey: dkToday,
    totals: { views: tViews, leads: tLeads, visits: tVisits, orders: orderCount, revenue },
    prev: { views: yViews, leads: yLeads, visits: yVisits },
    text: lines.join("\n"),
  };
}