// FILE: src/app/api/vendor/best-sellers/route.ts
import { NextResponse } from "next/server";
import { requireAnyRole } from "@/lib/auth/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireVendorUnlocked } from "@/lib/vendor/lockServer";
import { getVendorLimitsResolved } from "@/lib/vendor/limitsServer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

function dayKeyFromMs(ms: number) {
  try {
    const d = new Date(ms);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  } catch {
    return String(ms || "");
  }
}

function isCancelled(o: any) {
  const s = String(o?.orderStatus || "").toLowerCase();
  return s === "cancelled";
}

function isCountablePaidOrder(o: any) {
  const pt = String(o?.paymentType || "");
  const orderStatus = String(o?.orderStatus || "");
  const opsStatus = String(o?.opsStatus || "");
  const paymentStatus = String(o?.paymentStatus || "");
  const escrowStatus = String(o?.escrowStatus || "");
  const payStatus = String(o?.payment?.status || "");

  if (isCancelled(o)) return false;

  if (o?.paymentPlan?.enabled) return !!o?.paymentPlan?.completed;

  if (pt === "direct_transfer") {
    return orderStatus === "paid" || paymentStatus === "confirmed" || opsStatus === "paid";
  }

  if (pt === "paystack_escrow") {
    return (
      orderStatus === "paid" ||
      opsStatus === "paid" ||
      payStatus === "success" ||
      escrowStatus === "held" ||
      escrowStatus === "released"
    );
  }

  return false;
}

function unitPriceKobo(it: any) {
  const k = Number(it?.pricing?.finalUnitPriceKobo || 0);
  if (Number.isFinite(k) && k > 0) return Math.floor(k);

  const priceNgn = Number(it?.price || 0);
  if (Number.isFinite(priceNgn) && priceNgn > 0) return Math.round(priceNgn * 100);

  return 0;
}

function clampInt(n: any, min: number, max: number) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function allowedDayOptions(maxDays: number) {
  const md = Math.max(1, Math.floor(Number(maxDays || 0)));
  const common = [7, 30, 90];
  const out = common.filter((d) => d <= md);
  if (!out.includes(md)) out.push(md);
  out.sort((a, b) => a - b);
  return out;
}

function orderScanCapForPlan(planKey: string) {
  const k = String(planKey || "FREE").toUpperCase();
  if (k === "APEX") return 10000;
  if (k === "MOMENTUM") return 6000;
  if (k === "LAUNCH") return 2000;
  return 800;
}

function bestSellersExpansionSuggestion(planKey: string, maxRows: number, maxDays: number) {
  const pk = String(planKey || "FREE").toUpperCase();

  if (pk === "LAUNCH" && (maxRows < 10 || maxDays < 14)) {
    return {
      action: "buy_addon",
      sku: "addon_bestsellers_10_14",
      title: "Buy Best sellers expansion (10 rows, 14 days)",
      url: "/vendor/purchases",
      target: { rows: 10, days: 14 },
    };
  }

  if (pk === "MOMENTUM" && (maxRows < 50 || maxDays < 90)) {
    return {
      action: "buy_addon",
      sku: "addon_bestsellers_50_90",
      title: "Buy Best sellers expansion (50 rows, 90 days)",
      url: "/vendor/purchases",
      target: { rows: 50, days: 90 },
    };
  }

  return null;
}

type ProdAgg = {
  productId: string;
  name: string;
  unitsSold: number;
  revenueKobo: number;
  lastSoldAtMs: number;
};

type InsightAgg = {
  productId: string;
  name: string;
  recentRevenueKobo: number;
  prevRevenueKobo: number;
  recentUnits: number;
  prevUnits: number;
};

export async function GET(req: Request) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) {
      return NextResponse.json({ ok: false, error: "Missing businessId" }, { status: 400 });
    }

    await requireVendorUnlocked(me.businessId);

    const access = await getVendorLimitsResolved(me.businessId);
    const planKey = String(access.planKey || "FREE").toUpperCase();

    const unlocked = !!access?.features?.bestSellers;
    if (!unlocked) {
      return NextResponse.json(
        { ok: false, code: "FEATURE_LOCKED", error: "Best-selling products is locked on your plan. Upgrade to unlock it." },
        { status: 403 }
      );
    }

    const maxDays = clampInt(access?.limits?.bestSellersMaxDays, 1, 365);
    const maxRows = clampInt(access?.limits?.bestSellersMaxRows, 1, 1000);

    const url = new URL(req.url);
    const reqDays = Math.floor(Number(url.searchParams.get("days") || maxDays));
    const days = clampInt(reqDays, 1, maxDays);

    const wantInsights = url.searchParams.get("insights") === "1";
    const insightsAllowed = wantInsights && planKey === "APEX";

    const allowedDays = allowedDayOptions(maxDays);

    const now = Date.now();
    const startMs = now - days * 24 * 60 * 60 * 1000;

    const dailyMap = new Map<string, { dayKey: string; revenueKobo: number; unitsSold: number; ordersCount: number }>();
    for (let t = startMs; t <= now; t += 24 * 60 * 60 * 1000) {
      const dk = dayKeyFromMs(t);
      if (!dailyMap.has(dk)) dailyMap.set(dk, { dayKey: dk, revenueKobo: 0, unitsSold: 0, ordersCount: 0 });
    }

    const orderScanCap = orderScanCapForPlan(planKey);
    const snap = await adminDb
      .collection("orders")
      .where("businessId", "==", me.businessId)
      .limit(orderScanCap)
      .get();

    const orders = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    orders.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));

    const productsMap = new Map<string, ProdAgg>();

    const INS_DAYS = 7;
    const recentStartMs = now - INS_DAYS * 24 * 60 * 60 * 1000;
    const prevStartMs = now - 2 * INS_DAYS * 24 * 60 * 60 * 1000;
    const prevEndMs = recentStartMs;

    const insMap = new Map<string, InsightAgg>();

    for (const o of orders) {
      const createdAtMs = toMs(o.createdAt);
      if (!createdAtMs) continue;
      if (!isCountablePaidOrder(o)) continue;

      const inMainWindow = createdAtMs >= startMs;

      const inRecent = insightsAllowed && createdAtMs >= recentStartMs;
      const inPrev = insightsAllowed && createdAtMs >= prevStartMs && createdAtMs < prevEndMs;

      if (!inMainWindow && !inRecent && !inPrev) continue;

      const items = Array.isArray(o.items) ? o.items : [];

      if (inMainWindow) {
        const dk = dayKeyFromMs(createdAtMs);
        const dayRow = dailyMap.get(dk) || { dayKey: dk, revenueKobo: 0, unitsSold: 0, ordersCount: 0 };

        let orderUnits = 0;
        let orderRevenueKobo = 0;

        for (const it of items) {
          const productId = String(it?.productId || "").trim();
          if (!productId) continue;

          const qty = Math.max(1, Math.floor(Number(it?.qty || 1)));
          const uKobo = unitPriceKobo(it);
          const rev = qty * Math.max(0, uKobo);

          orderUnits += qty;
          orderRevenueKobo += rev;

          const cur =
            productsMap.get(productId) ||
            ({
              productId,
              name: String(it?.name || "Product"),
              unitsSold: 0,
              revenueKobo: 0,
              lastSoldAtMs: createdAtMs,
            } as ProdAgg);

          cur.unitsSold += qty;
          cur.revenueKobo += rev;
          if (createdAtMs > (cur.lastSoldAtMs || 0)) cur.lastSoldAtMs = createdAtMs;
          if (!cur.name && it?.name) cur.name = String(it.name);

          productsMap.set(productId, cur);
        }

        dayRow.ordersCount += 1;
        dayRow.unitsSold += orderUnits;
        dayRow.revenueKobo += orderRevenueKobo;
        dailyMap.set(dk, dayRow);
      }

      if (insightsAllowed && (inRecent || inPrev)) {
        for (const it of items) {
          const productId = String(it?.productId || "").trim();
          if (!productId) continue;

          const qty = Math.max(1, Math.floor(Number(it?.qty || 1)));
          const uKobo = unitPriceKobo(it);
          const rev = qty * Math.max(0, uKobo);

          const cur =
            insMap.get(productId) ||
            ({
              productId,
              name: String(it?.name || "Product"),
              recentRevenueKobo: 0,
              prevRevenueKobo: 0,
              recentUnits: 0,
              prevUnits: 0,
            } as InsightAgg);

          if (inRecent) {
            cur.recentRevenueKobo += rev;
            cur.recentUnits += qty;
          } else if (inPrev) {
            cur.prevRevenueKobo += rev;
            cur.prevUnits += qty;
          }

          if (!cur.name && it?.name) cur.name = String(it.name);

          insMap.set(productId, cur);
        }
      }
    }

    const products = Array.from(productsMap.values())
      .sort((a, b) => b.unitsSold - a.unitsSold || b.revenueKobo - a.revenueKobo)
      .slice(0, maxRows)
      .map((x) => ({
        productId: x.productId,
        name: x.name,
        unitsSold: x.unitsSold,
        revenueKobo: x.revenueKobo,
        revenueNgn: x.revenueKobo / 100,
        lastSoldAtMs: x.lastSoldAtMs,
      }));

    const dailySeries = Array.from(dailyMap.values())
      .sort((a, b) => (a.dayKey < b.dayKey ? -1 : 1))
      .map((d) => ({
        dayKey: d.dayKey,
        revenueKobo: d.revenueKobo,
        revenueNgn: d.revenueKobo / 100,
        unitsSold: d.unitsSold,
        ordersCount: d.ordersCount,
      }));

    let apexInsights: any = null;

    if (insightsAllowed) {
      const rows = Array.from(insMap.values());

      const risers = rows
        .filter((x) => x.recentRevenueKobo > x.prevRevenueKobo)
        .sort((a, b) => b.recentRevenueKobo - b.prevRevenueKobo - (a.recentRevenueKobo - a.prevRevenueKobo))
        .slice(0, 10)
        .map((x) => ({
          productId: x.productId,
          name: x.name,
          recentRevenueNgn: x.recentRevenueKobo / 100,
          prevRevenueNgn: x.prevRevenueKobo / 100,
          changeNgn: (x.recentRevenueKobo - x.prevRevenueKobo) / 100,
          isNew: x.prevRevenueKobo === 0 && x.recentRevenueKobo > 0,
        }));

      const droppers = rows
        .filter((x) => x.prevRevenueKobo > 0 && x.recentRevenueKobo < x.prevRevenueKobo)
        .sort((a, b) => b.prevRevenueKobo - b.recentRevenueKobo - (a.prevRevenueKobo - a.recentRevenueKobo))
        .slice(0, 10)
        .map((x) => ({
          productId: x.productId,
          name: x.name,
          recentRevenueNgn: x.recentRevenueKobo / 100,
          prevRevenueNgn: x.prevRevenueKobo / 100,
          changeNgn: (x.recentRevenueKobo - x.prevRevenueKobo) / 100,
        }));

      const newHot = rows
        .filter((x) => x.prevRevenueKobo === 0 && x.recentRevenueKobo > 0)
        .sort((a, b) => b.recentRevenueKobo - a.recentRevenueKobo)
        .slice(0, 10)
        .map((x) => ({
          productId: x.productId,
          name: x.name,
          revenueNgn: x.recentRevenueKobo / 100,
          units: x.recentUnits,
        }));

      apexInsights = {
        compareWindowDays: INS_DAYS,
        recentLabel: `Last ${INS_DAYS} days`,
        prevLabel: `Previous ${INS_DAYS} days`,
        risers,
        droppers,
        newHot,
      };
    }

    return NextResponse.json({
      ok: true,
      meta: {
        planKey,
        days,
        allowedDays,
        maxRows,
        maxDays,
        bestSellersExpansionSuggestion: bestSellersExpansionSuggestion(planKey, maxRows, maxDays),
      },
      products,
      dailySeries,
      apexInsights,
    });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return NextResponse.json({ ok: false, code: "VENDOR_LOCKED", error: "Subscribe to continue." }, { status: 403 });
    }
    return NextResponse.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}