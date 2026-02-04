import { adminDb } from "@/lib/firebase/admin";

export type QuoteItemIn = {
  productId: string;
  qty: number;
  selectedOptions?: Record<string, string> | null;
};

export type QuoteRequestIn = {
  storeSlug: string;
  items: QuoteItemIn[];
  couponCode?: string | null;
  shippingFeeKobo?: number | null; // passed from UI-selected option
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

function clampInt(n: any, min: number, max: number) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function cleanCode(v: any) {
  const raw = String(v || "").trim().toUpperCase();
  const ok = /^[A-Z0-9]{3,20}$/.test(raw);
  return ok ? raw : "";
}

function saleIsActive(p: any, now = Date.now()) {
  if (p?.saleActive !== true) return false;

  const start = Number(p?.saleStartsAtMs || 0);
  const end = Number(p?.saleEndsAtMs || 0);

  if (start && now < start) return false;
  if (end && now > end) return false;

  const t = String(p?.saleType || "");
  return t === "percent" || t === "fixed";
}

function computeSaleUnitPriceNgn(product: any) {
  const base = Number(product?.price || 0);
  if (!Number.isFinite(base) || base <= 0) return 0;

  if (!saleIsActive(product)) return Math.floor(base);

  const t = String(product?.saleType || "");
  if (t === "fixed") {
    const off = Number(product?.saleAmountOffNgn || 0);
    return Math.max(0, Math.floor(base - Math.max(0, off)));
  }

  const pct = Math.max(0, Math.min(90, Number(product?.salePercent || 0)));
  const off = Math.floor((base * pct) / 100);
  return Math.max(0, Math.floor(base - off));
}

function koboFromNgn(ngn: number) {
  const v = Number(ngn || 0);
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.floor(v * 100));
}

function computeCouponDiscount(params: {
  type: "percent" | "fixed";
  percent?: number | null;
  amountOffKobo?: number | null;
  subtotalKobo: number;
  maxDiscountKobo?: number | null;
}) {
  const subtotal = Math.max(0, Math.floor(params.subtotalKobo));
  let discount = 0;

  if (params.type === "percent") {
    const pct = Math.max(0, Math.min(90, Number(params.percent || 0)));
    discount = Math.floor((subtotal * pct) / 100);
  } else {
    discount = Math.floor(Number(params.amountOffKobo || 0));
  }

  if (params.maxDiscountKobo != null) {
    discount = Math.min(discount, Math.floor(Number(params.maxDiscountKobo || 0)));
  }

  discount = Math.max(0, Math.min(discount, subtotal));
  return discount;
}

export async function getBusinessBySlug(storeSlug: string) {
  const slug = String(storeSlug || "").trim().toLowerCase();
  if (!slug) throw new Error("storeSlug required");

  const bizSnap = await adminDb.collection("businesses").where("slug", "==", slug).limit(1).get();
  if (bizSnap.empty) throw new Error("Store not found");

  const bizDoc = bizSnap.docs[0];
  return { businessId: bizDoc.id, business: bizDoc.data() as any };
}

export async function buildQuote(input: QuoteRequestIn) {
  const storeSlug = String(input.storeSlug || "").trim().toLowerCase();
  if (!storeSlug) throw new Error("storeSlug required");

  const itemsIn = Array.isArray(input.items) ? input.items : [];
  if (itemsIn.length < 1) throw new Error("items required");

  const itemsClean = itemsIn
    .map((x) => ({
      productId: String(x?.productId || "").trim(),
      qty: clampInt(x?.qty ?? 1, 1, 999),
      selectedOptions: x?.selectedOptions && typeof x.selectedOptions === "object" ? (x.selectedOptions as any) : null,
    }))
    .filter((x) => !!x.productId)
    .slice(0, 50);

  if (itemsClean.length < 1) throw new Error("No valid items");

  const { businessId } = await getBusinessBySlug(storeSlug);

  // Fetch products by ids
  const refs = itemsClean.map((it) => adminDb.collection("products").doc(it.productId));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const snaps: any[] = await (adminDb as any).getAll(...refs);

  const productMap = new Map<string, any>();
  for (const s of snaps) {
    if (!s || !s.exists) continue;
    productMap.set(String(s.id), { id: s.id, ...(s.data() as any) });
  }

  const now = Date.now();

  let originalSubtotalKobo = 0;
  let saleSubtotalKobo = 0;

  const normalizedItems: any[] = [];

  for (const it of itemsClean) {
    const p = productMap.get(it.productId);
    if (!p) throw new Error(`Product not found: ${it.productId}`);

    // Ensure product belongs to store
    if (String(p.businessId || "") !== String(businessId || "")) {
      throw new Error("One or more items do not belong to this store.");
    }

    const listingType = String(p.listingType || "product");
    const serviceMode = String(p.serviceMode || "book");

    // book-only services must not be payable via checkout
    if (listingType === "service" && serviceMode === "book") {
      throw new Error(`This service is book-only and cannot be paid via checkout: ${p.name || p.id}`);
    }

    // Stock enforcement (soft): if stock is tracked and <=0, block checkout
    if (listingType === "product") {
      const stock = Number(p.stock ?? 0);
      if (Number.isFinite(stock) && stock <= 0) {
        throw new Error(`Out of stock: ${p.name || p.id}`);
      }
    }

    const baseUnitNgn = Math.floor(Number(p.price || 0));
    const baseUnitKobo = koboFromNgn(baseUnitNgn);

    const saleUnitNgn = computeSaleUnitPriceNgn(p);
    const saleUnitKobo = koboFromNgn(saleUnitNgn);

    const lineBase = baseUnitKobo * it.qty;
    const lineSale = saleUnitKobo * it.qty;

    originalSubtotalKobo += lineBase;
    saleSubtotalKobo += lineSale;

    normalizedItems.push({
      productId: it.productId,
      name: String(p.name || "Item"),
      qty: it.qty,
      selectedOptions: it.selectedOptions || null,
      baseUnitPriceKobo: baseUnitKobo,
      finalUnitPriceKobo: saleUnitKobo,
      saleApplied: saleIsActive(p, now),
      saleId: p.saleId ?? null,
      saleType: p.saleType ?? null,
      salePercent: p.salePercent ?? null,
      saleAmountOffNgn: p.saleAmountOffNgn ?? null,
    });
  }

  const saleDiscountKobo = Math.max(0, originalSubtotalKobo - saleSubtotalKobo);

  // Coupon (applies AFTER sale subtotal)
  const couponCode = input.couponCode ? cleanCode(input.couponCode) : "";
  let couponDiscountKobo = 0;
  let couponResult: any = null;

  if (couponCode) {
    const cSnap = await adminDb.collection("businesses").doc(businessId).collection("coupons").doc(couponCode).get();

    if (!cSnap.exists) {
      couponResult = { ok: false, code: "NOT_FOUND", error: "Invalid code" };
    } else {
      const c = cSnap.data() as any;

      if (c.active === false) couponResult = { ok: false, code: "INACTIVE", error: "Code is inactive" };
      else {
        const startsAtMs = c.startsAtMs ? Number(c.startsAtMs) : null;
        const endsAtMs = c.endsAtMs ? Number(c.endsAtMs) : null;

        if (startsAtMs && now < startsAtMs) couponResult = { ok: false, code: "NOT_STARTED", error: "Code not active yet" };
        else if (endsAtMs && now > endsAtMs) couponResult = { ok: false, code: "EXPIRED", error: "Code expired" };
        else {
          const minOrderKobo = Math.max(0, Math.floor(Number(c.minOrderKobo || 0)));
          if (minOrderKobo && saleSubtotalKobo < minOrderKobo) {
            couponResult = { ok: false, code: "MIN_ORDER", error: "Order total is too low for this code", minOrderKobo };
          } else {
            const usageLimitTotal = c.usageLimitTotal != null ? Number(c.usageLimitTotal) : null;
            const usedCount = Number(c.usedCount || 0);
            if (usageLimitTotal != null && usedCount >= usageLimitTotal) {
              couponResult = { ok: false, code: "LIMIT_REACHED", error: "Code usage limit reached" };
            } else {
              const type = String(c.type || "percent") === "fixed" ? "fixed" : "percent";
              const maxDiscountKobo = c.maxDiscountKobo != null ? Math.floor(Number(c.maxDiscountKobo || 0)) : null;

              couponDiscountKobo = computeCouponDiscount({
                type,
                percent: c.percent ?? null,
                amountOffKobo: c.amountOffKobo ?? null,
                subtotalKobo: saleSubtotalKobo,
                maxDiscountKobo,
              });

              couponResult = {
                ok: true,
                coupon: {
                  code: couponCode,
                  type,
                  percent: c.percent ?? null,
                  amountOffKobo: c.amountOffKobo ?? null,
                  minOrderKobo: minOrderKobo || 0,
                  maxDiscountKobo: c.maxDiscountKobo ?? null,
                },
              };
            }
          }
        }
      }
    }
  }

  const shippingFeeKobo = Math.max(0, Math.floor(Number(input.shippingFeeKobo || 0)));
  const itemsAfterCouponKobo = Math.max(0, saleSubtotalKobo - couponDiscountKobo);
  const totalKobo = Math.max(0, itemsAfterCouponKobo + shippingFeeKobo);

  return {
    businessId,
    storeSlug,
    normalizedItems,
    pricing: {
      originalSubtotalKobo,
      saleSubtotalKobo,
      saleDiscountKobo,
      couponDiscountKobo,
      shippingFeeKobo,
      totalKobo,
    },
    couponResult,
  };
}