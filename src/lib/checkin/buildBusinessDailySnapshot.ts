import { adminDb } from "@/lib/firebase/admin";
import { Timestamp } from "firebase-admin/firestore";
import { dayKeysBetween, fetchBusinessDailyMetrics } from "@/lib/metrics/daily";

function toMs(v: any) {
  try {
    if (!v) return 0;
    if (typeof v?.toDate === "function") return v.toDate().getTime();
    if (typeof v?.seconds === "number") return v.seconds * 1000;
    if (typeof v === "number") return v;
    return 0;
  } catch {
    return 0;
  }
}

function lagosDayKey(now = new Date()) {
  return now.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" }); // YYYY-MM-DD
}

function startOfTodayMsLagos(now = new Date()) {
  const dk = lagosDayKey(now);
  const [y, m, d] = dk.split("-").map((x) => Number(x));
  return new Date(y, (m || 1) - 1, d || 1).getTime();
}

function amountNgn(o: any) {
  const a = Number(o?.amount || 0);
  if (Number.isFinite(a) && a > 0) return a;
  const k = Number(o?.amountKobo || 0);
  if (Number.isFinite(k) && k > 0) return k / 100;
  return 0;
}

function isDisputed(o: any) {
  return String(o?.orderStatus || "") === "disputed" || String(o?.escrowStatus || "") === "disputed";
}

function isAwaitingVendorConfirm(o: any) {
  return o?.paymentType === "direct_transfer" && String(o?.orderStatus || "").includes("awaiting");
}

export async function buildBusinessDailySnapshot(args: { businessId: string }) {
  const businessId = String(args.businessId || "").trim();
  if (!businessId) throw new Error("Missing businessId");

  const nowMs = Date.now();
  const now = new Date(nowMs);

  const todayStartMs = startOfTodayMsLagos(now);
  const weekStartMs = nowMs - 7 * 86400000;
  const monthStartMs = nowMs - 30 * 86400000;

  // Business basics
  const bizSnap = await adminDb.collection("businesses").doc(businessId).get();
  const biz = bizSnap.exists ? (bizSnap.data() as any) : {};
  const slug = String(biz?.slug || "");
  const name = String(biz?.name || slug || "Store");

  // Orders: last 30 days (cap)
  const startTs = Timestamp.fromMillis(monthStartMs);
  const endTs = Timestamp.fromMillis(nowMs);

  const oSnap = await adminDb
    .collection("orders")
    .where("businessId", "==", businessId)
    .where("createdAt", ">=", startTs)
    .where("createdAt", "<=", endTs)
    .limit(2500)
    .get();

  const orders = oSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

  let todayOrders = 0;
  let todayRevenue = 0;

  let weekOrders = 0;
  let weekRevenue = 0;

  let pendingConfirmCount = 0;
  let disputedCount = 0;

  const customerCounts = new Map<string, number>();

  for (const o of orders) {
    const ms = toMs(o.createdAt);
    if (!ms) continue;

    const amt = amountNgn(o);

    if (ms >= todayStartMs) {
      todayOrders += 1;
      todayRevenue += amt;
    }

    if (ms >= weekStartMs) {
      weekOrders += 1;
      weekRevenue += amt;

      const phone = String(o?.customer?.phone || "").trim();
      const email = String(o?.customer?.email || "").trim().toLowerCase();
      const key = phone || email;
      if (key) customerCounts.set(key, (customerCounts.get(key) || 0) + 1);
    }

    if (isAwaitingVendorConfirm(o)) pendingConfirmCount += 1;
    if (isDisputed(o)) disputedCount += 1;
  }

  const repeatBuyers7d = Array.from(customerCounts.values()).filter((n) => n >= 2).length;

  // Products (stock signals)
  const pSnap = await adminDb.collection("products").where("businessId", "==", businessId).limit(1200).get();
  const products = pSnap.docs.map((d) => d.data() as any);

  const productCount = products.length;
  const outOfStockCount = products.filter((p) => Number(p.stock ?? 0) <= 0).length;
  const lowStockCount = products.filter((p) => {
    const s = Number(p.stock ?? 0);
    return s > 0 && s <= 3;
  }).length;

  // Traffic metrics (last 7 days)
  const dayKeys = dayKeysBetween(weekStartMs, nowMs);
  const metricDocs = await fetchBusinessDailyMetrics({ businessId, dayKeys });

  let visits7d = 0;
  let leads7d = 0;
  let views7d = 0;

  for (const m of metricDocs) {
    visits7d += Number((m as any).visits || 0);
    leads7d += Number((m as any).leads || 0);
    views7d += Number((m as any).views || 0);
  }

  // Last re-engagement campaign time (best-effort)
  let lastReengagementMs = 0;
  try {
    const cSnap = await adminDb
      .collection("reengagementCampaigns")
      .where("businessId", "==", businessId)
      .limit(50)
      .get();

    for (const d of cSnap.docs) {
      const x = d.data() as any;
      const ms = Number(x?.createdAtMs || 0) || 0;
      if (ms > lastReengagementMs) lastReengagementMs = ms;
    }
  } catch {
    // ignore
  }

  return {
    business: {
      businessId,
      slug: slug || null,
      name: name || null,
    },
    nowMs,
    today: { orders: todayOrders, revenue: todayRevenue },
    week: { orders: weekOrders, revenue: weekRevenue },
    attention: {
      pendingConfirmCount,
      disputedCount,
    },
    products: {
      productCount,
      outOfStockCount,
      lowStockCount,
    },
    traffic7d: {
      visits: visits7d,
      leads: leads7d,
      views: views7d,
    },
    customers7d: {
      repeatBuyers: repeatBuyers7d,
    },
    reengagement: {
      lastCampaignMs: lastReengagementMs || 0,
      followedUpThisWeek: !!(lastReengagementMs && nowMs - lastReengagementMs < 7 * 86400000),
    },
  };
}