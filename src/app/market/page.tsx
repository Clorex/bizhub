"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase/client";
import { BadgeCheck, Sparkles } from "lucide-react";
import { collection, getDocs, limit, orderBy, query, where, type DocumentData } from "firebase/firestore";

import { Card } from "@/components/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { trackBatch, track } from "@/lib/track/client";
import { Chip } from "@/components/ui/Chip";
import { CloudImage } from "@/components/CloudImage";
import {
  normalizeCoverAspect,
  coverAspectToTailwindClass,
  coverAspectToWH,
  type CoverAspectKey,
} from "@/lib/products/coverAspect";
import { MARKET_CATEGORIES, type MarketCategoryKey } from "@/lib/search/marketTaxonomy";

function fmtNaira(n: number) {
  try {
    return `₦${Number(n || 0).toLocaleString("en-NG")}`;
  } catch {
    return `₦${n}`;
  }
}

function normToken(w: string) {
  return String(w || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim()
    .slice(0, 10);
}

function tokensForSearch(q: string) {
  const raw = String(q || "")
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  const out: string[] = [];
  const seen = new Set<string>();
  for (const w of raw) {
    const t = normToken(w);
    if (!t) continue;
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 3) break;
  }
  return out;
}

// ✅ Friendly tier labels (no more "Tier 1/2/3")
function tierLabel(n: any) {
  const t = Number(n || 0);
  if (t >= 3) return "Premium";
  if (t === 2) return "Standard";
  if (t === 1) return "Basic";
  return "New";
}

/** --- Sale helpers --- */
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

function saleBadgeText(p: any) {
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

function marketRankScore(p: any) {
  const base = Number(p?.marketScore || 0);

  const apexBoost = p?.apexBadgeActive === true ? 2500 : 0;
  const risk = Math.max(0, Math.min(100, Number(p?.apexRiskScore || 0) || 0));
  const riskPenalty = risk * 6;

  return base + apexBoost - riskPenalty;
}

function hasActiveSubscriptionBusiness(b: any) {
  const exp = Number(b?.subscription?.expiresAtMs || 0);
  return !!(b?.subscription?.planKey && exp && exp > Date.now());
}

export default function MarketPage() {
  const router = useRouter();

  const [qText, setQText] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<DocumentData[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const [deals, setDeals] = useState<DocumentData[]>([]);
  const [dealsLoading, setDealsLoading] = useState(false);

  const [stores, setStores] = useState<DocumentData[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);

  // filters
  const [tierFilter, setTierFilter] = useState<number | null>(null);
  const [stateFilter, setStateFilter] = useState<string>("");
  const [cityFilter, setCityFilter] = useState<string>("");

  const [saleOnly, setSaleOnly] = useState(false);

  const [categoryFilter, setCategoryFilter] = useState<MarketCategoryKey | null>(null);
  const [apexOnly, setApexOnly] = useState(false);
  const [colorFilter, setColorFilter] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");

  const searchTokens = useMemo(() => tokensForSearch(qText), [qText]);
  const impressed = useRef(new Set<string>());

  function applyMarketRules(list: any[], opts?: { tokenHits?: Map<string, number> }) {
    const now = Date.now();
    const colorNeedle = String(colorFilter || "").trim().toLowerCase();
    const sizeNeedle = String(sizeFilter || "").trim().toLowerCase();

    const filtered = list
      .filter((p: any) => p?.marketEnabled !== false)
      .filter((p: any) => !!p?.businessSlug)
      .filter((p: any) => p?.businessHasActiveSubscription !== false)
      .filter((p: any) => {
        if (tierFilter == null) return true;
        return Number(p?.marketTier || 0) === tierFilter;
      })
      .filter((p: any) => {
        if (!stateFilter.trim()) return true;
        return String(p?.businessState || "").toLowerCase().includes(stateFilter.trim().toLowerCase());
      })
      .filter((p: any) => {
        if (!cityFilter.trim()) return true;
        return String(p?.businessCity || "").toLowerCase().includes(cityFilter.trim().toLowerCase());
      })
      .filter((p: any) => {
        if (!saleOnly) return true;
        const isService = String(p?.listingType || "product") === "service";
        const serviceMode = String(p?.serviceMode || "book");
        const bookOnly = isService && serviceMode === "book";
        if (bookOnly) return false;
        return saleIsActive(p, now);
      })
      .filter((p: any) => {
        if (!categoryFilter) return true;
        const cats = Array.isArray(p?.categoryKeys) ? p.categoryKeys : [];
        return cats.includes(categoryFilter);
      })
      .filter((p: any) => {
        if (!apexOnly) return true;
        return p?.apexBadgeActive === true;
      })
      .filter((p: any) => {
        if (!colorNeedle) return true;
        const colors = Array.isArray(p?.attrs?.colors) ? p.attrs.colors : [];
        return colors.map((x: any) => String(x || "").toLowerCase()).includes(colorNeedle);
      })
      .filter((p: any) => {
        if (!sizeNeedle) return true;
        const sizes = Array.isArray(p?.attrs?.sizes) ? p.attrs.sizes : [];
        return sizes.map((x: any) => String(x || "").toLowerCase()).includes(sizeNeedle);
      });

    return filtered.sort((a: any, b: any) => {
      const ha = opts?.tokenHits?.get(String(a?.id || "")) || 0;
      const hb = opts?.tokenHits?.get(String(b?.id || "")) || 0;
      if (hb !== ha) return hb - ha;
      return marketRankScore(b) - marketRankScore(a);
    });
  }

  async function loadDeals() {
    setDealsLoading(true);
    try {
      const qRef = query(collection(db, "products"), where("saleMarketBoost", "==", true), limit(120));
      const snap = await getDocs(qRef);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const filtered = applyMarketRules(rows).filter((p: any) => saleIsActive(p));
      setDeals(filtered.slice(0, 12));
    } catch {
      setDeals([]);
    } finally {
      setDealsLoading(false);
    }
  }

  async function loadTrending() {
    setLoading(true);
    setMsg(null);
    setStores([]);
    setStoresLoading(false);

    try {
      const boostedRef = query(
        collection(db, "products"),
        where("boostUntilMs", ">", Date.now()),
        orderBy("boostUntilMs", "desc"),
        limit(50)
      );
      const boostedSnap = await getDocs(boostedRef);
      const boosted = boostedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const latestRef = query(collection(db, "products"), orderBy("createdAt", "desc"), limit(120));
      const latestSnap = await getDocs(latestRef);
      const latest = latestSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const merged: any[] = [];
      const seen = new Set<string>();

      for (const p of [...boosted, ...latest]) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        merged.push(p);
      }

      const filtered = applyMarketRules(merged);
      setItems(filtered);

      const events = filtered
        .slice(0, 40)
        .filter((p: any) => p?.businessId && p?.id)
        .filter((p: any) => {
          if (impressed.current.has(p.id)) return false;
          impressed.current.add(p.id);
          return true;
        })
        .map((p: any) => ({
          type: "market_impression" as const,
          businessId: String(p.businessId),
          businessSlug: String(p.businessSlug || ""),
          productId: String(p.id),
        }));

      trackBatch(events);
    } catch (e: any) {
      setMsg(e?.message || "Could not load marketplace. Please try again.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadByCategory(cat: MarketCategoryKey) {
    setLoading(true);
    setMsg(null);
    setStores([]);
    setStoresLoading(false);

    try {
      const qRef = query(collection(db, "products"), where("categoryKeys", "array-contains", cat), limit(180));
      const snap = await getDocs(qRef);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const filtered = applyMarketRules(rows);
      setItems(filtered);

      const events = filtered
        .slice(0, 40)
        .filter((p: any) => p?.businessId && p?.id)
        .filter((p: any) => {
          if (impressed.current.has(p.id)) return false;
          impressed.current.add(p.id);
          return true;
        })
        .map((p: any) => ({
          type: "market_impression" as const,
          businessId: String(p.businessId),
          businessSlug: String(p.businessSlug || ""),
          productId: String(p.id),
        }));

      trackBatch(events);
    } catch (e: any) {
      setMsg(e?.message || "Could not load this category. Please try again.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function runSearch() {
    const tokens = tokensForSearch(qText);

    if (!tokens.length) {
      if (categoryFilter) return loadByCategory(categoryFilter);
      return loadTrending();
    }

    setLoading(true);
    setStoresLoading(true);
    setMsg(null);

    try {
      const tokenHits = new Map<string, number>();
      const productMap = new Map<string, any>();

      const productSnaps = await Promise.all(
        tokens.map((t) => getDocs(query(collection(db, "products"), where("keywords", "array-contains", t), limit(120))))
      );

      for (const snap of productSnaps) {
        for (const d of snap.docs) {
          const id = d.id;
          tokenHits.set(id, (tokenHits.get(id) || 0) + 1);
          if (!productMap.has(id)) productMap.set(id, { id, ...d.data() });
        }
      }

      const mergedProducts = Array.from(productMap.values());
      const filteredProducts = applyMarketRules(mergedProducts, { tokenHits });
      setItems(filteredProducts);

      const events = filteredProducts
        .slice(0, 40)
        .filter((p: any) => p?.businessId && p?.id)
        .filter((p: any) => {
          if (impressed.current.has(p.id)) return false;
          impressed.current.add(p.id);
          return true;
        })
        .map((p: any) => ({
          type: "market_impression" as const,
          businessId: String(p.businessId),
          businessSlug: String(p.businessSlug || ""),
          productId: String(p.id),
        }));
      trackBatch(events);

      const storeHits = new Map<string, number>();
      const storeMap = new Map<string, any>();

      const storeSnaps = await Promise.all(
        tokens.map((t) => getDocs(query(collection(db, "businesses"), where("searchKeywords", "array-contains", t), limit(40))))
      );

      for (const snap of storeSnaps) {
        for (const d of snap.docs) {
          const id = d.id;
          storeHits.set(id, (storeHits.get(id) || 0) + 1);
          if (!storeMap.has(id)) storeMap.set(id, { id, ...d.data() });
        }
      }

      const mergedStores = Array.from(storeMap.values())
        .filter((b: any) => !!String(b?.slug || "").trim())
        .filter((b: any) => hasActiveSubscriptionBusiness(b))
        .filter((b: any) => {
          if (!stateFilter.trim()) return true;
          return String(b?.state || "").toLowerCase().includes(stateFilter.trim().toLowerCase());
        })
        .filter((b: any) => {
          if (!cityFilter.trim()) return true;
          return String(b?.city || "").toLowerCase().includes(cityFilter.trim().toLowerCase());
        })
        .sort((a: any, b: any) => {
          const ha = storeHits.get(String(a?.id || "")) || 0;
          const hb = storeHits.get(String(b?.id || "")) || 0;
          if (hb !== ha) return hb - ha;
          return String(a?.name || "").localeCompare(String(b?.name || ""));
        })
        .slice(0, 12);

      setStores(mergedStores);
    } catch (e: any) {
      setMsg(e?.message || "Could not search. Please try again.");
      setItems([]);
      setStores([]);
    } finally {
      setLoading(false);
      setStoresLoading(false);
    }
  }

  useEffect(() => {
    loadTrending();
    loadDeals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setItems((prev) => applyMarketRules(prev));
    setDeals((prev) => applyMarketRules(prev).filter((p: any) => saleIsActive(p)).slice(0, 12));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tierFilter, stateFilter, cityFilter, saleOnly, categoryFilter, apexOnly, colorFilter, sizeFilter]);

  useEffect(() => {
    loadDeals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter]);

  function openProduct(p: any) {
    const slug = String(p?.businessSlug || "");
    if (!slug) return;

    if (p?.businessId && p?.id) {
      track({
        type: "market_click",
        businessId: String(p.businessId),
        businessSlug: slug,
        productId: String(p.id),
      });
    }

    router.push(`/b/${slug}/p/${p.id}`);
  }

  function renderCard(p: any) {
    const img = Array.isArray(p?.images) ? p.images[0] : "";
    const boosted = Number(p?.boostUntilMs || 0) > Date.now();
    const tier = Number(p?.marketTier ?? p?.verificationTier ?? 0);

    const isService = String(p?.listingType || "product") === "service";
    const serviceMode = String(p?.serviceMode || "book");
    const bookOnly = isService && serviceMode === "book";

    const basePrice = Number(p?.price || 0);
    const onSale = !bookOnly && saleIsActive(p);
    const finalPrice = onSale ? computeSalePriceNgn(p) : basePrice;

    const apexBadgeActive = p?.apexBadgeActive === true;

    const coverAspect: CoverAspectKey = normalizeCoverAspect(p?.coverAspect) ?? "1:1";
    const aspectClass = coverAspectToTailwindClass(coverAspect);
    const { w, h } = coverAspectToWH(coverAspect, 520);

    return (
      <button key={p.id} onClick={() => openProduct(p)} className="text-left">
        <Card className="p-3 hover:bg-black/[0.02] transition">
          <div className={`${aspectClass} w-full rounded-2xl bg-gradient-to-br from-biz-sand to-biz-cream overflow-hidden relative`}>
            {img ? (
              <CloudImage
                src={img}
                alt={p?.name || "Listing"}
                w={w}
                h={h}
                sizes="(max-width: 430px) 45vw, 220px"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xs text-gray-400">No image</div>
            )}

            {apexBadgeActive ? (
              <div className="absolute top-2 left-2 px-2 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-100 inline-flex items-center gap-1">
                <BadgeCheck className="h-3.5 w-3.5" />
                Verified
              </div>
            ) : boosted ? (
              <div className="absolute top-2 left-2 px-2 py-1 rounded-full text-[10px] font-bold bg-white/90 border border-black/5 inline-flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-orange-600" />
                Promoted
              </div>
            ) : null}

            {onSale ? (
              <div className="absolute top-2 right-2 px-2 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-100">
                {saleBadgeText(p)}
              </div>
            ) : null}

            <div className="absolute bottom-2 left-2 px-2 py-1 rounded-full text-[10px] font-bold bg-white/90 border border-black/5">
              {tierLabel(tier)}
            </div>
          </div>

          <p className="mt-2 text-sm font-bold text-biz-ink line-clamp-2">{p?.name || "Unnamed"}</p>

          <p className="mt-1 text-xs text-biz-muted">
            {bookOnly ? (
              "Book only"
            ) : onSale ? (
              <>
                <span className="line-through text-gray-400 mr-1">{fmtNaira(basePrice)}</span>
                <span className="text-emerald-700 font-extrabold">{fmtNaira(finalPrice)}</span>
              </>
            ) : (
              fmtNaira(basePrice)
            )}
          </p>

          <p className="mt-1 text-[11px] text-gray-500">
            Vendor: <b className="text-biz-ink">{p?.businessSlug || "—"}</b>
          </p>
        </Card>
      </button>
    );
  }

  function renderStoreCard(b: any) {
    const slug = String(b?.slug || "").trim();
    const name = String(b?.name || slug || "Store");
    const state = String(b?.state || "").trim();
    const city = String(b?.city || "").trim();

    const loc = [city, state].filter(Boolean).join(", ");

    return (
      <Link
        key={b?.id || slug}
        href={slug ? `/b/${slug}` : "#"}
        className="block rounded-2xl border border-biz-line bg-white p-3 hover:bg-black/[0.02] transition"
      >
        <p className="text-sm font-extrabold text-biz-ink line-clamp-1">{name}</p>
        <p className="text-[11px] text-biz-muted mt-1 line-clamp-2">{String(b?.description || "Visit vendor")}</p>
        <p className="text-[11px] text-gray-500 mt-2">
          @{slug} {loc ? <>• {loc}</> : null}
        </p>
      </Link>
    );
  }

  const searchingLabel = useMemo(() => {
    if (!searchTokens.length) return "";
    return searchTokens.join(", ");
  }, [searchTokens]);

  const hasAnyFilter = !!(
    tierFilter != null ||
    stateFilter.trim() ||
    cityFilter.trim() ||
    saleOnly ||
    categoryFilter ||
    apexOnly ||
    colorFilter.trim() ||
    sizeFilter.trim()
  );

  return (
    <div className="min-h-screen">
      <div className="relative">
        <div className="h-2 w-full bg-gradient-to-r from-biz-accent2 to-biz-accent" />
        <div className="px-4 pt-5 pb-5 bg-gradient-to-b from-biz-sand to-biz-bg">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-biz-ink">
                myBizHub<span className="text-biz-accent">.</span>
              </p>
              <p className="text-xs text-biz-muted mt-1">Discover products & vendors</p>
            </div>

            <Link href="/cart" className="rounded-2xl border border-biz-line bg-white px-4 py-2 text-xs font-bold shadow-soft">
              Cart
            </Link>
          </div>

          <Card className="p-3 mt-4">
            <div className="flex gap-2">
              <Input placeholder="Search products, services, vendors…" value={qText} onChange={(e) => setQText(e.target.value)} />
              <Button size="sm" onClick={runSearch} disabled={loading}>
                Search
              </Button>
            </div>

            <p className="mt-2 text-[11px] text-biz-muted">
              {searchTokens.length ? (
                <>
                  Searching: <b className="text-biz-ink">{searchingLabel}</b>
                </>
              ) : categoryFilter ? (
                <>
                  Category:{" "}
                  <b className="text-biz-ink">
                    {MARKET_CATEGORIES.find((c) => c.key === categoryFilter)?.label || categoryFilter}
                  </b>
                </>
              ) : (
                <>Showing latest + promoted</>
              )}
            </p>
          </Card>

          <Card className="p-3 mt-3">
            <p className="text-xs font-bold text-gray-500 uppercase">Filters</p>

            <div className="mt-2 flex gap-2 flex-wrap">
              {[null, 1, 2, 3].map((t) => (
                <Chip key={String(t)} active={tierFilter === t} onClick={() => setTierFilter(t as any)}>
                  {t == null ? "All sellers" : tierLabel(t)}
                </Chip>
              ))}

              <Chip active={saleOnly} onClick={() => setSaleOnly((v) => !v)}>
                On sale
              </Chip>

              <Chip active={apexOnly} onClick={() => setApexOnly((v) => !v)}>
                Verified
              </Chip>

              {categoryFilter ? (
                <Chip active={true} onClick={() => setCategoryFilter(null)}>
                  {MARKET_CATEGORIES.find((c) => c.key === categoryFilter)?.label || categoryFilter} ✕
                </Chip>
              ) : null}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <Input placeholder="State (optional)" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} />
              <Input placeholder="City (optional)" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} />
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <Input placeholder="Color e.g. black" value={colorFilter} onChange={(e) => setColorFilter(e.target.value)} />
              <Input placeholder="Size e.g. 41 / XL" value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)} />
            </div>

            {hasAnyFilter ? (
              <div className="mt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setTierFilter(null);
                    setStateFilter("");
                    setCityFilter("");
                    setSaleOnly(false);
                    setCategoryFilter(null);
                    setApexOnly(false);
                    setColorFilter("");
                    setSizeFilter("");
                  }}
                >
                  Clear all filters
                </Button>
              </div>
            ) : null}
          </Card>
        </div>
      </div>

      <div className="px-4 pb-24 space-y-3">
        <Card className="p-4">
          <p className="font-bold text-biz-ink">Hot deals</p>
          <p className="text-[11px] text-biz-muted mt-1">Discounts from top vendors</p>

          {dealsLoading ? (
            <p className="text-sm text-biz-muted mt-3">Loading…</p>
          ) : deals.length === 0 ? (
            <EmptyState
              title="No deals right now"
              description="Check back soon for discounts from verified vendors."
              className="mt-3"
            />
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-3 items-start">{deals.slice(0, 6).map((p: any) => renderCard(p))}</div>
          )}
        </Card>

        <Card className="p-4">
          <p className="font-bold text-biz-ink">Categories</p>
          <p className="text-[11px] text-biz-muted mt-1">Browse by what you're looking for</p>

          <div className="mt-3 grid grid-cols-3 gap-2">
            {MARKET_CATEGORIES.filter((c) => c.key !== "other").map((c) => {
              const active = categoryFilter === c.key;
              return (
                <button
                  key={c.key}
                  onClick={() => {
                    setCategoryFilter((prev) => (prev === c.key ? null : c.key));
                    setTimeout(runSearch, 0);
                  }}
                  className={
                    active
                      ? "rounded-2xl border border-biz-accent/30 bg-gradient-to-br from-orange-50 to-white p-3 text-left shadow-soft"
                      : "rounded-2xl border border-biz-line bg-white p-3 text-left hover:bg-black/[0.02] transition"
                  }
                >
                  <p className={active ? "text-sm font-bold text-biz-accent" : "text-sm font-bold text-biz-ink"}>{c.label}</p>
                  <p className="text-[11px] text-biz-muted mt-1">{c.hint}</p>
                </button>
              );
            })}
          </div>
        </Card>

        {searchTokens.length ? (
          <Card className="p-4">
            <p className="font-bold text-biz-ink">Vendors</p>
            <p className="text-[11px] text-biz-muted mt-1">Vendors matching your search</p>

            {storesLoading ? (
              <p className="text-sm text-biz-muted mt-3">Loading…</p>
            ) : stores.length === 0 ? (
              <EmptyState
                title="No vendors found"
                description="Try a different keyword or check product results below."
                className="mt-3"
              />
            ) : (
              <div className="mt-3 grid grid-cols-1 gap-2">{stores.map((b: any) => renderStoreCard(b))}</div>
            )}
          </Card>
        ) : null}

        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}

        {loading ? (
          <Card className="p-4">Loading…</Card>
        ) : items.length === 0 ? (
          <EmptyState
            title="No results"
            description="Try a different search term or adjust your filters."
            ctaLabel="Clear filters"
            onCta={() => {
              setTierFilter(null);
              setStateFilter("");
              setCityFilter("");
              setSaleOnly(false);
              setCategoryFilter(null);
              setApexOnly(false);
              setColorFilter("");
              setSizeFilter("");
              setQText("");
              loadTrending();
            }}
          />
        ) : (
          <div className="grid grid-cols-2 gap-3 items-start">{items.map((p: any) => renderCard(p))}</div>
        )}
      </div>
    </div>
  );
}