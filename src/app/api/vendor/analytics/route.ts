// FILE: src/app/api/vendor/analytics/route.ts
import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { dayKeysBetween, fetchBusinessDailyMetrics, monthRangeFromYYYYMM } from "@/lib/metrics/daily";
import { getBusinessEntitlementById } from "@/lib/entitlements/server";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function dayKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function rangeWindow(range: string, month?: string | null) {
  const now = Date.now();

  if (month) {
    const mr = monthRangeFromYYYYMM(month);
    if (mr) return { startMs: mr.startMs, endMs: mr.endMs };
  }

  const nowDate = new Date();
  if (range === "today") {
    const startMs = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate()).getTime();
    return { startMs, endMs: now };
  }

  if (range === "month") return { startMs: now - 30 * 24 * 60 * 60 * 1000, endMs: now };
  return { startMs: now - 7 * 24 * 60 * 60 * 1000, endMs: now };
}

export async function GET(req: Request) {
  try {
    const me = await requireRole(req, "owner");
    if (!me.businessId) return NextResponse.json({ error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    const url = new URL(req.url);
    const requestedRange = url.searchParams.get("range") || "week";
    const requestedMonth = url.searchParams.get("month");

    const { business, entitlement } = await getBusinessEntitlementById(me.businessId);

    const planKey = String(entitlement.planKey || "FREE");
    const source = String(entitlement.source || "free");

    const hasActiveSubscription =
      !!business?.subscription?.planKey && Number(business?.subscription?.expiresAtMs || 0) > Date.now();

    const monthUnlocked = hasActiveSubscription;

    let usedRange = requestedRange;
    let usedMonth = requestedMonth || null;
    let notice: string | null = null;

    if (!monthUnlocked) {
      if (requestedRange === "month") {
        usedRange = "week";
        notice = "Month analytics is locked. Subscribe to unlock month reports.";
      }
      if (requestedMonth) {
        usedMonth = null;
        usedRange = "week";
        notice = "Month history is locked. Subscribe to unlock history.";
      }
    }

    const { startMs, endMs } = rangeWindow(usedRange, usedMonth);
    const dayKeys = dayKeysBetween(startMs, endMs);

    const oSnap = await adminDb.collection("orders").where("businessId", "==", me.businessId).limit(800).get();
    const ordersAll = oSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
    const orders = ordersAll.filter((o) => {
      const ms = toMs(o.createdAt);
      return ms >= startMs && ms <= endMs;
    });

    // payment breakdown (window)
    const paystackOrders = orders.filter((o) => o.paymentType === "paystack_escrow").length;
    const directOrders = orders.filter((o) => o.paymentType === "direct_transfer").length;
    const chatOrders = orders.filter((o) => o.paymentType === "chat_whatsapp").length;

    const disputedOrders = orders.filter((o) => String(o.orderStatus || "") === "disputed" || String(o.escrowStatus || "") === "disputed").length;

    const awaitingConfirmOrders = orders.filter(
      (o) => o.paymentType === "direct_transfer" && String(o.orderStatus || "").includes("awaiting")
    ).length;

    let revenueHeld = 0;
    let revenueReleased = 0;
    let revenueDirect = 0;
    let productsSold = 0;
    const customerSet = new Set<string>();

    for (const o of orders) {
      const amt = Number(o.amount || (o.amountKobo ? o.amountKobo / 100 : 0) || 0);

      if (o.paymentType === "paystack_escrow") {
        if (o.escrowStatus === "released") revenueReleased += amt;
        else revenueHeld += amt;
      } else if (o.paymentType === "direct_transfer") {
        revenueDirect += amt;
      }

      const items = Array.isArray(o.items) ? o.items : [];
      for (const it of items) productsSold += Number(it.qty || 1);

      const phone = String(o?.customer?.phone || "").trim();
      const email = String(o?.customer?.email || "").trim().toLowerCase();
      const key = phone || email;
      if (key) customerSet.add(key);
    }

    const totalRevenue = revenueHeld + revenueReleased + revenueDirect;

    // Chart (last 7 days from all orders)
    const days: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      const k = dayKey(d);
      days.push({ dayKey: k, label: k, revenue: 0 });
    }
    const dayMap = new Map(days.map((d) => [d.dayKey, d]));
    for (const o of ordersAll) {
      const ms = toMs(o.createdAt);
      if (!ms) continue;
      const k = dayKey(new Date(ms));
      const row = dayMap.get(k);
      if (!row) continue;
      const amt = Number(o.amount || (o.amountKobo ? o.amountKobo / 100 : 0) || 0);
      row.revenue += amt;
    }

    // Product stock signals (server-side; no client Firestore reads)
    const pSnap = await adminDb.collection("products").where("businessId", "==", me.businessId).limit(800).get();
    const products = pSnap.docs.map((d) => d.data() as any);

    const outOfStockCount = products.filter((p) => Number(p.stock ?? 0) <= 0).length;
    const lowStockCount = products.filter((p) => {
      const s = Number(p.stock ?? 0);
      return s > 0 && s <= 3;
    }).length;

    const disputedCountAll = ordersAll.filter((o) => o.escrowStatus === "disputed").length;
    const awaitingConfirmCountAll = ordersAll.filter(
      (o) => o.paymentType === "direct_transfer" && String(o.orderStatus || "").includes("awaiting")
    ).length;

    const metricDocs = await fetchBusinessDailyMetrics({ businessId: me.businessId, dayKeys });

    let visits = 0;
    let leads = 0;
    let views = 0;

    for (const m of metricDocs) {
      visits += Number(m.visits || 0);
      leads += Number(m.leads || 0);
      views += Number(m.views || 0);
    }

    const recentOrders = [...ordersAll].sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt)).slice(0, 10);

    return NextResponse.json({
      ok: true,
      meta: {
        requestedRange,
        usedRange,
        requestedMonth: requestedMonth || null,
        usedMonth,
        notice,
        access: {
          planKey,
          source,
          monthAnalyticsUnlocked: monthUnlocked,
          entitlementExpiresAtMs: Number(entitlement.expiresAtMs || 0) || null,
        },
      },
      overview: {
        totalRevenue,
        revenueHeld,
        revenueReleased,
        revenueDirect,

        orders: orders.length,
        paystackOrders,
        directOrders,
        chatOrders,
        disputedOrders,
        awaitingConfirmOrders,

        productsSold,
        customers: customerSet.size,
        visits,
        leads,
        views,
      },
      chartDays: days,
      todo: {
        outOfStockCount,
        lowStockCount,
        awaitingConfirmCount: awaitingConfirmCountAll,
        disputedCount: disputedCountAll,
      },
      recentOrders,
    });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json({ ok: false, code: "VENDOR_LOCKED", error: "Subscribe to continue." }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}