// FILE: src/lib/market/filters/apply.ts
import type { MarketFilterState, MarketSortKey } from "@/lib/market/filters/types";
import { computeEffectivePriceNgn, saleIsActive } from "@/lib/market/sale";

function norm(s: any) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function createdAtMs(p: any): number {
  const v = p?.createdAt ?? p?.createdAtMs ?? 0;

  // Firestore Timestamp (client/admin) best-effort
  if (v && typeof v === "object") {
    if (typeof v.toMillis === "function") return Number(v.toMillis()) || 0;
    if (typeof v.seconds === "number") return Math.floor(v.seconds * 1000);
  }

  if (typeof v === "number") return v;
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : 0;
}

function locationMatchScore(p: any, state: string | null, city: string | null) {
  const sNeed = norm(state);
  const cNeed = norm(city);
  if (!sNeed && !cNeed) return 0;

  const ps = norm(p?.businessState || "");
  const pc = norm(p?.businessCity || "");

  let score = 0;

  if (sNeed) {
    if (ps === sNeed) score += 20;
    else if (ps.includes(sNeed) || sNeed.includes(ps)) score += 10;
  }

  if (cNeed) {
    if (pc === cNeed) score += 40;
    else if (pc.includes(cNeed) || cNeed.includes(pc)) score += 15;
  }

  return score;
}

function marketRankScore(p: any) {
  const base = Number(p?.marketScore || 0);

  const apexBoost = p?.apexBadgeActive === true ? 2500 : 0;
  const risk = Math.max(0, Math.min(100, Number(p?.apexRiskScore || 0) || 0));
  const riskPenalty = risk * 6;

  return base + apexBoost - riskPenalty;
}

export function applyMarketProductFilters(args: {
  products: any[];
  filters: MarketFilterState;
  sortKey: MarketSortKey;
  tokenHits?: Record<string, number> | null;
}) {
  const { products, filters, sortKey, tokenHits } = args;

  const now = Date.now();
  const sevenDaysAgo = now - 7 * 86400000;

  const sNeed = norm(filters.location.state);
  const cNeed = norm(filters.location.city);

  const colorNeedle = norm(filters.categorySpecific.color);
  const sizeNeedle = norm(filters.categorySpecific.size);

  const min = filters.price.min != null ? Number(filters.price.min) : null;
  const max = filters.price.max != null ? Number(filters.price.max) : null;

  const out = (products || [])
    // hard market rules
    .filter((p) => p?.marketEnabled !== false)
    .filter((p) => !!p?.businessSlug)
    .filter((p) => p?.marketAllowed !== false)
    .filter((p) => p?.businessHasActiveSubscription !== false)
    // category
    .filter((p) => {
      if (!filters.category) return true;
      const cats = Array.isArray(p?.categoryKeys) ? p.categoryKeys : [];
      return cats.includes(filters.category);
    })
    // location
    .filter((p) => {
      if (!sNeed) return true;
      return norm(p?.businessState || "").includes(sNeed);
    })
    .filter((p) => {
      if (!cNeed) return true;
      return norm(p?.businessCity || "").includes(cNeed);
    })
    // price
    .filter((p) => {
      if (min == null && max == null) return true;
      const v = computeEffectivePriceNgn(p);
      if (min != null && v < min) return false;
      if (max != null && v > max) return false;
      return true;
    })
    // trust
    .filter((p) => {
      const t = Number(p?.marketTier || 0);

      if (filters.trust.verification === "verified") return t >= 1;
      if (filters.trust.verification === "id_verified") return t >= 2;
      if (filters.trust.verification === "address_verified") return t >= 3;
      return true;
    })
    .filter((p) => {
      if (!filters.trust.trustedBadgeOnly) return true;
      return p?.apexBadgeActive === true;
    })
    // status
    .filter((p) => {
      if (!filters.status.onSale) return true;
      const isService = String(p?.listingType || "product") === "service";
      const serviceMode = String(p?.serviceMode || "book");
      const bookOnly = isService && serviceMode === "book";
      if (bookOnly) return false;
      return saleIsActive(p, now);
    })
    .filter((p) => {
      if (!filters.status.newArrivals) return true;
      return createdAtMs(p) >= sevenDaysAgo;
    })
    .filter((p) => {
      if (!filters.status.availableNow) return true;
      const isService = String(p?.listingType || "product") === "service";
      if (isService) return true;
      const stock = Number(p?.stock ?? 0);
      return Number.isFinite(stock) && stock > 0;
    })
    .filter((p) => {
      if (!filters.status.limitedStock) return true;
      const isService = String(p?.listingType || "product") === "service";
      if (isService) return false;
      const stock = Math.floor(Number(p?.stock ?? 0));
      return Number.isFinite(stock) && stock > 0 && stock <= 3;
    })
    // category-specific (V1: only apply for fashion; others ignore)
    .filter((p) => {
      if (filters.category !== "fashion") return true;

      if (colorNeedle) {
        const colors = Array.isArray(p?.attrs?.colors) ? p.attrs.colors : [];
        const ok = colors.map((x: any) => norm(x)).includes(colorNeedle);
        if (!ok) return false;
      }

      if (sizeNeedle) {
        const sizes = Array.isArray(p?.attrs?.sizes) ? p.attrs.sizes : [];
        const ok = sizes.map((x: any) => norm(x)).includes(sizeNeedle);
        if (!ok) return false;
      }

      return true;
    });

  // sorting
  const sorted = out.sort((a, b) => {
    const aId = String(a?.id || "");
    const bId = String(b?.id || "");

    // If searching, token hits first (keeps your existing behavior)
    const ha = tokenHits?.[aId] || 0;
    const hb = tokenHits?.[bId] || 0;
    if (hb !== ha && sortKey === "recommended") return hb - ha;

    if (sortKey === "latest") {
      return createdAtMs(b) - createdAtMs(a);
    }

    if (sortKey === "price_asc") {
      return computeEffectivePriceNgn(a) - computeEffectivePriceNgn(b);
    }

    if (sortKey === "price_desc") {
      return computeEffectivePriceNgn(b) - computeEffectivePriceNgn(a);
    }

    if (sortKey === "best_selling") {
      // proxy for now: marketScore (until you add true sales metrics)
      return marketRankScore(b) - marketRankScore(a);
    }

    if (sortKey === "closest") {
      const la = locationMatchScore(a, filters.location.state, filters.location.city);
      const lb = locationMatchScore(b, filters.location.state, filters.location.city);
      if (lb !== la) return lb - la;
      return marketRankScore(b) - marketRankScore(a);
    }

    // recommended
    // add location boost BEFORE market score so location feels strong
    const la = locationMatchScore(a, filters.location.state, filters.location.city);
    const lb = locationMatchScore(b, filters.location.state, filters.location.city);
    if (lb !== la) return lb - la;

    return marketRankScore(b) - marketRankScore(a);
  });

  return sorted;
}