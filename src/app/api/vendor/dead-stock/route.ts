
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

function clampInt(n: any, min: number, max: number) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function dayOptions(maxDays: number) {
  // Allow common windows up to maxDays (packages can restrict by setting maxDays)
  const md = Math.max(1, Math.floor(Number(maxDays || 0)));
  const common = [7, 14, 30, 60, 90];
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

function productScanCapForPlan(planKey: string) {
  const k = String(planKey || "FREE").toUpperCase();
  if (k === "APEX") return 5000;
  if (k === "MOMENTUM") return 3000;
  if (k === "LAUNCH") return 1500;
  return 800;
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

  // If installments exist, count only when fully completed
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

function unitPriceKoboFromOrderItem(it: any) {
  const k = Number(it?.pricing?.finalUnitPriceKobo || 0);
  if (Number.isFinite(k) && k > 0) return Math.floor(k);

  const priceNgn = Number(it?.price || 0);
  if (Number.isFinite(priceNgn) && priceNgn > 0) return Math.round(priceNgn * 100);

  return 0;
}

function productPriceKobo(p: any) {
  const n = Number(p?.price || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

function daysBetween(nowMs: number, pastMs: number) {
  if (!pastMs) return 999999;
  const d = Math.floor((nowMs - pastMs) / (24 * 60 * 60 * 1000));
  return Math.max(0, d);
}

export async function GET(req: Request) {
  try {
    const me = await requireAnyRole(req, ["owner", "staff"]);
    if (!me.businessId) {
      return Response.json({ ok: false, error: "Missing businessId" }, { status: 400 });
    }

    await requireVendorUnlocked(me.businessId);

    const access = await getVendorLimitsResolved(me.businessId);
    const planKey = String(access.planKey || "FREE").toUpperCase();

    // ✅ Packages-controlled security
    if (!access?.features?.deadStock) {
      return Response.json(
        { ok: false, code: "FEATURE_LOCKED", error: "Dead stock detection is locked on your plan. Upgrade to unlock it." },
        { status: 403 }
      );
    }

    const maxDays = clampInt(access?.limits?.deadStockMaxDays, 1, 365);
    const maxRows = clampInt(access?.limits?.deadStockMaxRows, 1, 5000);
    const ignoreNewerThanDays = clampInt(access?.limits?.deadStockIgnoreNewerThanDays, 0, 60);

    const url = new URL(req.url);
    const reqDays = Math.floor(Number(url.searchParams.get("days") || maxDays));
    const days = clampInt(reqDays, 1, maxDays);

    const allowedDays = dayOptions(maxDays);

    const now = Date.now();
    const startMs = now - days * 24 * 60 * 60 * 1000;
    const ignoreNewerThanMs = now - ignoreNewerThanDays * 24 * 60 * 60 * 1000;

    // 1) Scan recent orders (paid-only) and compute:
    // - lastSoldAtMs (across scanned orders)
    // - windowUnitsSold/revenue (within selected window)
    const orderScanCap = orderScanCapForPlan(planKey);

    const oSnap = await adminDb
      .collection("orders")
      .where("businessId", "==", me.businessId)
      .limit(orderScanCap)
      .get();

    const orders = oSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    orders.sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));

    const lastSoldMap = new Map<string, number>(); // productId -> lastSoldAtMs
    const windowUnitsMap = new Map<string, number>(); // productId -> units within window
    const windowRevenueKoboMap = new Map<string, number>(); // productId -> revenue within window

    for (const o of orders) {
      const createdAtMs = toMs(o.createdAt);
      if (!createdAtMs) continue;
      if (!isCountablePaidOrder(o)) continue;

      const inWindow = createdAtMs >= startMs;

      const items = Array.isArray(o.items) ? o.items : [];
      for (const it of items) {
        const productId = String(it?.productId || "").trim();
        if (!productId) continue;

        // lastSold (across scanned orders)
        const prev = Number(lastSoldMap.get(productId) || 0);
        if (!prev || createdAtMs > prev) lastSoldMap.set(productId, createdAtMs);

        // window metrics (only inside selected window)
        if (inWindow) {
          const qty = Math.max(1, Math.floor(Number(it?.qty || 1)));
          windowUnitsMap.set(productId, Number(windowUnitsMap.get(productId) || 0) + qty);

          const uKobo = unitPriceKoboFromOrderItem(it);
          windowRevenueKoboMap.set(productId, Number(windowRevenueKoboMap.get(productId) || 0) + qty * Math.max(0, uKobo));
        }
      }
    }

    // 2) Load products for business
    const productScanCap = productScanCapForPlan(planKey);
    let productsDocs: any[] = [];

    const pByBusinessId = await adminDb
      .collection("products")
      .where("businessId", "==", me.businessId)
      .limit(productScanCap)
      .get();

    productsDocs = pByBusinessId.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));

    if (productsDocs.length === 0 && me.businessSlug) {
      const pBySlug = await adminDb
        .collection("products")
        .where("businessSlug", "==", String(me.businessSlug))
        .limit(productScanCap)
        .get();

      productsDocs = pBySlug.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
    }

    // 3) Dead stock = in-stock product not sold within the window
    const dead: any[] = [];

    for (const p of productsDocs) {
      const listingType = String(p?.listingType || "product");
      if (listingType === "service") continue;

      // ignore hidden/archived products (best-effort)
      if (p?.hidden === true || p?.isHidden === true || String(p?.status || "").toLowerCase() === "hidden") continue;

      const stock = Math.floor(Number(p?.stock ?? 0));
      if (!Number.isFinite(stock) || stock <= 0) continue;

      const createdAtMs = toMs(p?.createdAt);
      if (createdAtMs && createdAtMs > ignoreNewerThanMs) continue;

      const productId = String(p?.id || "").trim(); // mapped doc id above
      if (!productId) continue;

      const lastSoldAtMs = Number(lastSoldMap.get(productId) || 0);
      const isDead = !lastSoldAtMs || lastSoldAtMs < startMs;
      if (!isDead) continue;

      const priceKobo = productPriceKobo(p);
      const deadValueKobo = stock * Math.max(0, priceKobo);

      dead.push({
        productId,
        name: String(p?.name || "Product"),

        stock,
        priceKobo,
        priceNgn: priceKobo / 100,

        deadValueKobo,
        deadValueNgn: deadValueKobo / 100,

        lastSoldAtMs: lastSoldAtMs || 0,
        daysSinceLastSale: lastSoldAtMs ? daysBetween(now, lastSoldAtMs) : null,

        windowUnitsSold: Number(windowUnitsMap.get(productId) || 0),
        windowRevenueKobo: Number(windowRevenueKoboMap.get(productId) || 0),
      });
    }

    dead.sort((a, b) => (b.deadValueKobo - a.deadValueKobo) || (b.stock - a.stock));
    const out = dead.slice(0, maxRows);

    const totalDeadValueKobo = out.reduce((s, x) => s + Number(x.deadValueKobo || 0), 0);

    return Response.json({
      ok: true,
      meta: {
        planKey,
        days,
        allowedDays,
        maxRows,
        maxDays,
        ignoreNewerThanDays,
        totals: {
          deadCount: out.length,
          deadValueKobo: totalDeadValueKobo,
          deadValueNgn: totalDeadValueKobo / 100,
        },
      },
      products: out,
    });
  } catch (e: any) {
    if (e?.code === "VENDOR_LOCKED") {
      return Response.json({ ok: false, code: "VENDOR_LOCKED", error: "Subscribe to continue." }, { status: 403 });
    }
    return Response.json({ ok: false, error: e?.message || "Failed" }, { status: 500 });
  }
}