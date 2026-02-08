// FILE: src/lib/market/sale.ts

export function saleIsActive(p: any, now = Date.now()) {
  if (p?.saleActive !== true) return false;

  const start = Number(p?.saleStartsAtMs || 0);
  const end = Number(p?.saleEndsAtMs || 0);

  if (start && now < start) return false;
  if (end && now > end) return false;

  const t = String(p?.saleType || "");
  return t === "percent" || t === "fixed";
}

export function computeSalePriceNgn(p: any) {
  const base = Number(p?.price || 0);
  if (!Number.isFinite(base) || base <= 0) return 0;

  if (!saleIsActive(p)) return Math.floor(base);

  const t = String(p?.saleType || "");
  if (t === "fixed") {
    const off = Number(p?.saleAmountOffNgn || 0);
    return Math.max(0, Math.floor(base - Math.max(0, off)));
  }

  const pct = Math.max(0, Math.min(90, Number(p?.salePercent || 0)));
  const off = Math.floor((base * pct) / 100);
  return Math.max(0, Math.floor(base - off));
}

export function computeEffectivePriceNgn(p: any) {
  const isService = String(p?.listingType || "product") === "service";
  const serviceMode = String(p?.serviceMode || "book");
  const bookOnly = isService && serviceMode === "book";
  const base = Math.max(0, Math.floor(Number(p?.price || 0)));

  if (bookOnly) return base;
  return saleIsActive(p) ? computeSalePriceNgn(p) : base;
}

export function saleBadgeText(p: any, fmtNaira: (n: number) => string) {
  const t = String(p?.saleType || "");
  if (t === "fixed") {
    const off = Number(p?.saleAmountOffNgn || 0);
    if (off > 0) return `${fmtNaira(off)} OFF`;
    return "Sale";
  }
  const pct = Number(p?.salePercent || 0);
  if (pct > 0) return `${pct}% OFF`;
  return "Sale";
}