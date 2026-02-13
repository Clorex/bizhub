// FILE: src/components/ProductCard.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  normalizeCoverAspect,
  coverAspectToTailwindClass,
  type CoverAspectKey,
} from "@/lib/products/coverAspect";
import { formatMoneyNGN } from "@/lib/money";

function saleIsActive(p: any, now = Date.now()) {
  if (p?.saleActive !== true) return false;

  const start = Number(p?.saleStartsAtMs || 0);
  const end = Number(p?.saleEndsAtMs || 0);

  if (start && now < start) return false;
  if (end && now > end) return false;

  const t = String(p?.saleType || "");
  return t === "percent" || t === "fixed";
}

function computeSalePriceNgn(p: any) {
  const base = Number(p?.priceKobo != null ? Number(p.priceKobo) / 100 : p?.price || 0);
  if (!Number.isFinite(base) || base <= 0) return 0;
  if (!saleIsActive(p)) return base;

  const t = String(p?.saleType || "");
  if (t === "fixed") {
    const off = Number(p?.saleAmountOffNgn || 0);
    return Math.max(0, Math.floor(base - Math.max(0, off)));
  }

  const pct = Math.max(0, Math.min(90, Number(p?.salePercent || 0)));
  const off = Math.floor((base * pct) / 100);
  return Math.max(0, Math.floor(base - off));
}

function saleBadgeText(p: any) {
  const t = String(p?.saleType || "");
  if (t === "fixed") {
    const off = Number(p?.saleAmountOffNgn || 0);
    return off > 0 ? `${formatMoneyNGN(off)} OFF` : "Sale";
  }
  const pct = Number(p?.salePercent || 0);
  return pct > 0 ? `${pct}% OFF` : "Sale";
}

type TrustBadgeType = "earned_apex" | "temporary_apex" | null;

const trustCache = new Map<
  string,
  { fetchedAtMs: number; data: any; inflight?: Promise<any> }
>();
const TRUST_TTL_MS = 5 * 60 * 1000;

async function fetchStoreTrust(slug: string) {
  const s = String(slug || "").trim().toLowerCase();
  if (!s) return null;

  const url = `/api/public/store/${encodeURIComponent(s)}/trust`;

  const r = await fetch(url);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return null;
  return data;
}

function badgeTypeFromTrust(t: any): TrustBadgeType {
  const badge = t?.badge || null;
  const bActive = badge?.active === true;
  const bType = String(badge?.type || "");

  if (bActive && (bType === "earned_apex" || bType === "temporary_apex")) return bType as any;

  if (t?.apexBadgeActive === true) return "earned_apex";
  if (t?.temporaryApexBadgeActive === true) return "temporary_apex";

  return null;
}

export function ProductCard({ slug, product }: { slug: string; product: any }) {
  const name = String(product?.name ?? "Product");
  const img = Array.isArray(product?.images) ? product.images?.[0] : null;

  const listingType = String(product?.listingType || "product");
  const serviceMode = String(product?.serviceMode || "book");
  const bookOnly = listingType === "service" && serviceMode === "book";

  const basePrice = Number(
    product?.priceKobo != null ? Number(product.priceKobo) / 100 : product?.price || 0
  );
  const onSale = !bookOnly && saleIsActive(product);
  const finalPrice = onSale ? computeSalePriceNgn(product) : basePrice;

  const coverAspect: CoverAspectKey = normalizeCoverAspect(product?.coverAspect) ?? "1:1";
  const aspectClass = coverAspectToTailwindClass(coverAspect);

  const [trust, setTrust] = useState<any>(null);

  useEffect(() => {
    let mounted = true;

    async function loadTrust() {
      const s = String(slug || "").trim().toLowerCase();
      if (!s) return;

      const cached = trustCache.get(s);
      const now = Date.now();

      if (cached && cached.data && now - cached.fetchedAtMs < TRUST_TTL_MS) {
        if (mounted) setTrust(cached.data);
        return;
      }

      if (cached?.inflight) {
        const d = await cached.inflight.catch(() => null);
        if (mounted && d) setTrust(d);
        return;
      }

      const inflight = fetchStoreTrust(s);
      trustCache.set(s, { fetchedAtMs: now, data: cached?.data || null, inflight });

      const d = await inflight.catch(() => null);
      trustCache.set(s, { fetchedAtMs: Date.now(), data: d, inflight: undefined });

      if (mounted) setTrust(d);
    }

    loadTrust();
    return () => {
      mounted = false;
    };
  }, [slug]);

  const badgeType = badgeTypeFromTrust(trust);

  return (
    <Link
      href={`/b/${slug}/p/${product.id}`}
      className="block rounded-2xl border border-black/5 bg-white shadow-sm active:scale-[0.99] transition"
      aria-label={name}
      title={name}
    >
      <div className={`${aspectClass} w-full rounded-2xl bg-[#F3F4F6] overflow-hidden relative`}>
        {img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={img} alt={name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-xs text-gray-500">
            No image
          </div>
        )}

        {onSale ? (
          <div className="absolute top-2 left-2 px-2 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-100">
            {saleBadgeText(product)}
          </div>
        ) : null}

        {badgeType === "earned_apex" ? (
          <div
            className="absolute top-2 right-2 px-2 py-1 rounded-full text-[10px] font-extrabold bg-[#0F172A] text-white border border-white/20"
            title="Verified Apex badge (earned + maintained)"
          >
            Verified Apex
          </div>
        ) : null}

        {badgeType === "temporary_apex" ? (
          <div
            className="absolute top-2 right-2 px-2 py-1 rounded-full text-[10px] font-extrabold bg-white/90 text-orange-700 border border-orange-200"
            title="Temporary / probation Apex badge"
          >
            Apex (Temporary)
          </div>
        ) : null}
      </div>

      <div className="p-3">
        {/* 2-line clamp + reserved height to keep card height consistent */}
        <p
          className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight min-h-[2.6rem]"
          title={name}
        >
          {name}
        </p>

        <p className="mt-1 text-sm text-gray-700">
          {bookOnly ? (
            "Book only"
          ) : onSale ? (
            <>
              <span className="line-through text-gray-400 mr-1">
                {formatMoneyNGN(basePrice)}
              </span>
              <span className="text-emerald-700 font-extrabold">
                {formatMoneyNGN(finalPrice)}
              </span>
            </>
          ) : (
            formatMoneyNGN(basePrice)
          )}
        </p>

        <div className="mt-2">
          <span className="inline-flex items-center rounded-full bg-[#FFF3E6] text-[#C2410C] px-2 py-1 text-[11px] font-medium">
            View details
          </span>
        </div>
      </div>
    </Link>
  );
}