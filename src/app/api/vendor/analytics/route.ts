import { NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { dayKeysBetween, fetchBusinessDailyMetrics, monthRangeFromYYYYMM } from "@/lib/metrics/daily";
import { getBusinessEntitlementById } from "@/lib/entitlements/server";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Nudge = {
  id: string;
  tone: "info" | "warn";
  title: string;
  body: string;
  cta?: { label: string; url: string };
};

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

function dayKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function tierFor(planKey: string) {
  const k = String(planKey || "FREE").toUpperCase();
  if (k === "APEX") return 3;
  if (k === "MOMENTUM") return 2;
  if (k === "LAUNCH") return 1;
  return 0; // FREE
}

function fetchCapsForTier(tier: number) {
  if (tier >= 3) return { ordersCap: 2500, productsCap: 1500, chartMaxDays: 30 };
  if (tier >= 2) return { ordersCap: 1500, productsCap: 1000, chartMaxDays: 14 };
  if (tier >= 1) return { ordersCap: 800, productsCap: 800, chartMaxDays: 7 };
  return { ordersCap: 250, productsCap: 300, chartMaxDays: 7 };
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

function safeDiv(a: number, b: number) {
  if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return 0;
  return a / b;
}

function fmtNaira(n: number) {
  try {
    return `₦${Number(n || 0).toLocaleString()}`;
  } catch {
    return `₦${n}`;
  }
}

function startOfTodayMs() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

function viewerRoleFromMe(me: any): "owner" | "staff" {
  const r = String(me?.role || me?.accountRole || "").toLowerCase();
  if (r === "staff") return "staff";
  return "owner";
}

export async function GET(req: Request) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });

    await requireVendorUnlocked(me.businessId);

    // ✅ Owner decides whether staff can see nudges
    const viewerRole = viewerRoleFromMe(me);

    const bizSnap = await adminDb.collection("businesses").doc(me.businessId).get();
    const biz = bizSnap.exists ? (bizSnap.data() as any) : {};
    const staffNudgesEnabled = !!biz?.settings?.notifications?.staffNudgesEnabled;

    const allowNudgesForViewer = viewerRole !== "staff" || staffNudgesEnabled;

    const url = new URL(req.url);
    const requestedRange = String(url.searchParams.get("range") || "week");
    const requestedMonth = url.searchParams.get("month"); // YYYY-MM

    const { entitlement } = await getBusinessEntitlementById(me.businessId);

    const planKey = String(entitlement.planKey || "FREE").toUpperCase();
    const source = String(entitlement.source || "free");

    const tier = tierFor(planKey);
    const caps = fetchCapsForTier(tier);

    // Tier feature flags
    const canUseMonthRange = tier >= 1; // LAUNCH+
    const canUseMonthHistory = tier >= 2; // MOMENTUM+
    const canUseDeepInsights = tier >= 2; // MOMENTUM+
    const canUseAdvanced = tier >= 3; // APEX

    let usedRange = requestedRange;
    let usedMonth: string | null = requestedMonth || null;
    let notice: string | null = null;

    // Hard restrictions per plan
    if (!canUseMonthRange && usedRange === "month") {
      usedRange = "week";
      notice = "Month analytics is locked on Free. Upgrade to unlock month reports.";
    }

    if (!canUseMonthHistory && usedMonth) {
      usedMonth = null;
      usedRange = usedRange === "month" ? "month" : "week";
      notice = "Month history is available on Momentum and above.";
    }

    // FREE gets only week/today at most
    if (tier === 0 && usedRange !== "week" && usedRange !== "today") {
      usedRange = "week";
      notice = "Free plan analytics is limited to weekly view.";
    }

    const { startMs, endMs } = rangeWindow(usedRange, usedMonth);
    const dayKeys = dayKeysBetween(startMs, endMs);

    // Orders (fetch capped set, filter in-memory)
    const oSnap = await adminDb.collection("orders").where("businessId", "==", me.businessId).limit(caps.ordersCap).get();
    const ordersAll = oSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

    const ordersWin = ordersAll.filter((o) => {
      const ms = toMs(o.createdAt);
      return ms >= startMs && ms <= endMs;
    });

    // payment breakdown (window)
    const paystackOrders = ordersWin.filter((o) => o.paymentType === "paystack_escrow").length;
    const directOrders = ordersWin.filter((o) => o.paymentType === "direct_transfer").length;
    const chatOrders = ordersWin.filter((o) => o.paymentType === "chat_whatsapp").length;

    const disputedOrders = ordersWin.filter(
      (o) => String(o.orderStatus || "") === "disputed" || String(o.escrowStatus || "") === "disputed"
    ).length;

    const awaitingConfirmOrders = ordersWin.filter(
      (o) => o.paymentType === "direct_transfer" && String(o.orderStatus || "").includes("awaiting")
    ).length;

    let revenueHeld = 0;
    let revenueReleased = 0;
    let revenueDirect = 0;
    let productsSold = 0;

    // Used for repeat-buyer nudge + deep insights
    const customerCounts = new Map<string, number>();
    const customerSet = new Set<string>();

    // Top products (insights)
    const productAgg = new Map<string, { productId: string; name: string; qty: number; revenue: number }>();

    for (const o of ordersWin) {
      const amt = Number(o.amount || (o.amountKobo ? o.amountKobo / 100 : 0) || 0);

      if (o.paymentType === "paystack_escrow") {
        if (o.escrowStatus === "released") revenueReleased += amt;
        else revenueHeld += amt;
      } else if (o.paymentType === "direct_transfer") {
        revenueDirect += amt;
      }

      const items = Array.isArray(o.items) ? o.items : [];
      for (const it of items) {
        const q = Number(it?.qty || 1);
        productsSold += q;

        if (canUseDeepInsights) {
          const pid = String(it?.productId || it?.id || "").trim();
          const name = String(it?.name || "Item").trim();
          const price = Number(it?.price || 0);
          const rev = Math.max(0, price) * Math.max(1, q);

          if (pid) {
            const cur = productAgg.get(pid) || { productId: pid, name, qty: 0, revenue: 0 };
            cur.qty += Math.max(1, q);
            cur.revenue += Math.max(0, rev);
            if (!cur.name && name) cur.name = name;
            productAgg.set(pid, cur);
          }
        }
      }

      const phone = String(o?.customer?.phone || "").trim();
      const email = String(o?.customer?.email || "").trim().toLowerCase();
      const key = phone || email;

      if (key) {
        customerSet.add(key);
        customerCounts.set(key, (customerCounts.get(key) || 0) + 1);
      }
    }

    const totalRevenue = revenueHeld + revenueReleased + revenueDirect;

    // Daily metrics (visits/leads/views)
    const metricDocs = await fetchBusinessDailyMetrics({ businessId: me.businessId, dayKeys });
    let visits = 0;
    let leads = 0;
    let views = 0;
    for (const m of metricDocs) {
      visits += Number((m as any).visits || 0);
      leads += Number((m as any).leads || 0);
      views += Number((m as any).views || 0);
    }

    // Chart: daily revenue bars
    const chartMap = new Map<string, { dayKey: string; label: string; revenue: number }>();
    for (const k of dayKeys) chartMap.set(k, { dayKey: k, label: k, revenue: 0 });

    for (const o of ordersWin) {
      const ms = toMs(o.createdAt);
      if (!ms) continue;
      const k = dayKey(new Date(ms));
      const row = chartMap.get(k);
      if (!row) continue;
      const amt = Number(o.amount || (o.amountKobo ? o.amountKobo / 100 : 0) || 0);
      row.revenue += amt;
    }

    let chartDays = Array.from(chartMap.values());
    if (chartDays.length > caps.chartMaxDays) chartDays = chartDays.slice(chartDays.length - caps.chartMaxDays);

    // Best day (Momentum+)
    let bestDay: any = null;
    if (canUseDeepInsights && chartDays.length) {
      bestDay = chartDays.reduce((a, b) => (Number(b.revenue || 0) > Number(a.revenue || 0) ? b : a), chartDays[0]);
    }

    // Product stock signals
    const pSnap = await adminDb
      .collection("products")
      .where("businessId", "==", me.businessId)
      .limit(caps.productsCap)
      .get();

    const products = pSnap.docs.map((d) => d.data() as any);
    const productCount = products.length;

    const outOfStockCount = products.filter((p) => Number(p.stock ?? 0) <= 0).length;
    const lowStockCount = products.filter((p) => {
      const s = Number(p.stock ?? 0);
      return s > 0 && s <= 3;
    }).length;

    // All-time signals (capped by ordersCap)
    const disputedCountAll = ordersAll.filter((o) => o.escrowStatus === "disputed").length;
    const awaitingConfirmCountAll = ordersAll.filter(
      (o) => o.paymentType === "direct_transfer" && String(o.orderStatus || "").includes("awaiting")
    ).length;

    const recentOrders = [...ordersAll]
      .sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt))
      .slice(0, tier === 0 ? 3 : tier === 1 ? 5 : 10)
      .map((o: any) => ({
        id: o.id,
        createdAt: o.createdAt ?? null,
        amount: o.amount ?? null,
        amountKobo: o.amountKobo ?? null,
        currency: o.currency ?? "NGN",
        paymentType: o.paymentType ?? null,
        escrowStatus: o.escrowStatus ?? null,
        orderStatus: o.orderStatus ?? null,
      }));

    // Deep insights (Momentum+)
    let insights: any = null;
    if (canUseDeepInsights) {
      const aov = safeDiv(totalRevenue, Math.max(1, ordersWin.length));
      const conversionOrders = safeDiv(ordersWin.length, Math.max(1, visits));
      const leadRate = safeDiv(leads, Math.max(1, visits));

      const repeatBuyers = Array.from(customerCounts.values()).filter((n) => n >= 2).length;

      const topProducts = Array.from(productAgg.values())
        .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
        .slice(0, canUseAdvanced ? 5 : 3);

      insights = {
        aov,
        conversionOrders, // orders/visits
        leadRate, // leads/visits
        bestDay,
        repeatBuyers,
        topProducts,
      };
    }

    // Advanced comparisons (Apex only)
    let comparisons: any = null;
    if (canUseAdvanced) {
      const win = Math.max(1, endMs - startMs);
      const prevStartMs = startMs - win;
      const prevEndMs = startMs - 1;

      const prevOrders = ordersAll.filter((o) => {
        const ms = toMs(o.createdAt);
        return ms >= prevStartMs && ms <= prevEndMs;
      });

      let prevRevenue = 0;
      for (const o of prevOrders) {
        const amt = Number(o.amount || (o.amountKobo ? o.amountKobo / 100 : 0) || 0);
        prevRevenue += amt;
      }

      const revenueDelta = totalRevenue - prevRevenue;
      const revenueDeltaPct = prevRevenue > 0 ? (revenueDelta / prevRevenue) * 100 : null;

      const ordersDelta = ordersWin.length - prevOrders.length;
      const ordersDeltaPct = prevOrders.length > 0 ? (ordersDelta / prevOrders.length) * 100 : null;

      comparisons = {
        previousWindow: {
          startMs: prevStartMs,
          endMs: prevEndMs,
          revenue: prevRevenue,
          orders: prevOrders.length,
        },
        deltas: {
          revenueDelta,
          revenueDeltaPct,
          ordersDelta,
          ordersDeltaPct,
        },
      };
    }

    // Response trimming for Free
    const overviewBase: any = {
      totalRevenue,
      orders: ordersWin.length,
      paystackOrders,
      directOrders,
      chatOrders,
      disputedOrders,
      awaitingConfirmOrders,
    };

    const overviewExtra: any = {
      revenueHeld,
      revenueReleased,
      revenueDirect,
      productsSold,
      customers: customerSet.size,
      visits,
      leads,
      views,
    };

    const overview = tier === 0 ? overviewBase : { ...overviewBase, ...overviewExtra };

    // ✅ Daily Business Check‑in
    const todayStart = startOfTodayMs();
    let todayOrders = 0;
    let todayRevenue = 0;

    for (const o of ordersAll) {
      const ms = toMs(o.createdAt);
      if (!ms || ms < todayStart) continue;
      todayOrders += 1;
      todayRevenue += Number(o.amount || (o.amountKobo ? o.amountKobo / 100 : 0) || 0);
    }

    const attentionCount = awaitingConfirmCountAll + disputedCountAll;

    let suggestion = "Share one product link today and follow up with one past buyer.";
    if (awaitingConfirmCountAll > 0) suggestion = "Confirm pending direct transfers so you can close sales faster.";
    else if (disputedCountAll > 0) suggestion = "Respond to disputes quickly with clear delivery proof to protect visibility.";
    else if (productCount === 0) suggestion = "Add your first product so customers can start ordering.";
    else if (outOfStockCount > 0) suggestion = "Restock your out‑of‑stock products so customers don’t bounce.";
    else if (lowStockCount > 0) suggestion = "Top up low stock items (especially your fast movers).";
    else if (visits > 0 && ordersWin.length === 0) suggestion = "You have visits but no orders—try clearer prices and a stronger product photo.";

    const checkin = {
      title: "Daily business check‑in",
      lines: [
        `Today: ${todayOrders} order(s) • ${fmtNaira(todayRevenue)}`,
        `This ${usedRange}: ${ordersWin.length} order(s) • ${fmtNaira(totalRevenue)}`,
        attentionCount ? `Needs attention: ${attentionCount} order(s)` : "Needs attention: none",
      ],
      suggestion,
    };

    // ✅ Smart Nudge Alerts
    const nudges: Nudge[] = [];

    if (disputedCountAll > 0) {
      nudges.push({
        id: "disputes_open",
        tone: "warn",
        title: "Disputes need attention",
        body: `You have ${disputedCountAll} disputed order(s). Reply quickly with clear proof to protect your visibility.`,
        cta: { label: "View orders", url: "/vendor/orders" },
      });
    }

    if (awaitingConfirmCountAll > 0) {
      nudges.push({
        id: "awaiting_confirm",
        tone: "warn",
        title: "Pending transfer confirmation",
        body: `You have ${awaitingConfirmCountAll} direct transfer(s) waiting for confirmation.`,
        cta: { label: "Open orders", url: "/vendor/orders" },
      });
    }

    if (productCount === 0) {
      nudges.push({
        id: "no_products",
        tone: "info",
        title: "Add your first product",
        body: "Your store is ready. Add one product so customers can start ordering.",
        cta: { label: "Create product", url: "/vendor/products/new" },
      });
    } else if (outOfStockCount > 0) {
      nudges.push({
        id: "out_of_stock",
        tone: "info",
        title: "Some items are out of stock",
        body: `${outOfStockCount} product(s) are out of stock. Restock to avoid losing ready buyers.`,
        cta: { label: "Manage products", url: "/vendor/products" },
      });
    } else if (lowStockCount > 0) {
      nudges.push({
        id: "low_stock",
        tone: "info",
        title: "Low stock reminder",
        body: `${lowStockCount} product(s) are low on stock. Top up your fast movers.`,
        cta: { label: "Manage products", url: "/vendor/products" },
      });
    }

    // Follow-up nudge (quiet)
    const repeatBuyersEstimate = Array.from(customerCounts.values()).filter((n) => n >= 2).length;

    let followedUpThisWeek = false;
    try {
      const cSnap = await adminDb
        .collection("reengagementCampaigns")
        .where("businessId", "==", me.businessId)
        .limit(50)
        .get();

      let lastMs = 0;
      for (const d of cSnap.docs) {
        const x = d.data() as any;
        const ms = Number(x?.createdAtMs || 0) || 0;
        if (ms > lastMs) lastMs = ms;
      }
      if (lastMs && Date.now() - lastMs < 7 * 86400000) followedUpThisWeek = true;
    } catch {
      // ignore
    }

    if (repeatBuyersEstimate > 0 && !followedUpThisWeek) {
      nudges.push({
        id: "followup_repeat_buyers",
        tone: "info",
        title: "Quick follow‑up idea",
        body: "You have repeat buyers. A short check‑in message can bring easy repeat sales this week.",
        cta: { label: "Open re‑engagement", url: "/vendor/reengagement?segment=buyers_repeat" },
      });
    }

    const nudgesOut = nudges.slice(0, 3);

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
          tier,
          features: {
            canUseMonthRange,
            canUseMonthHistory,
            canUseDeepInsights,
            canUseAdvanced,
          },
          entitlementExpiresAtMs: Number(entitlement.expiresAtMs || 0) || null,
        },
        viewer: {
          role: viewerRole,
          staffNudgesEnabled,
        },
      },
      overview,
      chartDays: tier === 0 ? chartDays.slice(-7) : chartDays,
      todo: {
        outOfStockCount,
        lowStockCount,
        awaitingConfirmCount: awaitingConfirmCountAll,
        disputedCount: disputedCountAll,
      },
      insights,
      comparisons,
      recentOrders,
      checkin,

      // ✅ If staff nudges are OFF, staff receives []
      nudges: allowNudgesForViewer ? nudgesOut : [],
    });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json({ ok: false, code: "VENDOR_LOCKED", error: "Subscribe to continue." }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}