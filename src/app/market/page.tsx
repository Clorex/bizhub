"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase/client";
import { BadgeCheck, Sparkles, Plus } from "lucide-react";
import { collection, getDocs, limit, orderBy, query, where, type DocumentData } from "firebase/firestore";

import { useCart } from "@/lib/cart/CartContext";

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

import { MarketFilterSheet } from "@/components/market/MarketFilterSheet";
import { MarketSortSheet } from "@/components/market/MarketSortSheet";
import { DEFAULT_MARKET_FILTERS, type MarketFilterState, type MarketSortKey } from "@/lib/market/filters/types";
import { applyMarketProductFilters } from "@/lib/market/filters/apply";
import { buildFashionFacets } from "@/lib/market/filters/facets";
import { computeSalePriceNgn, saleBadgeText, saleIsActive } from "@/lib/market/sale";

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

function verificationLabel(n: any) {
  const t = Number(n || 0);
  if (t >= 3) return "Address verified";
  if (t === 2) return "ID verified";
  if (t === 1) return "Verified";
  return "New seller";
}

function hasActiveSubscriptionBusiness(b: any) {
  const exp = Number(b?.subscription?.expiresAtMs || 0);
  return !!(b?.subscription?.planKey && exp && exp > Date.now());
}

export default function MarketPage() {
  const router = useRouter();
  const { addToCart } = useCart();

  const [qText, setQText] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [productsPool, setProductsPool] = useState<DocumentData[]>([]);
  const [tokenHits, setTokenHits] = useState<Record<string, number> | null>(null);
  const [dealsPool, setDealsPool] = useState<DocumentData[]>([]);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [storesPool, setStoresPool] = useState<DocumentData[]>([]);
  const [storesLoading, setStoresLoading] = useState(false);

  const [filters, setFilters] = useState<MarketFilterState>(DEFAULT_MARKET_FILTERS);
  const [sortKey, setSortKey] = useState<MarketSortKey>("recommended");

  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const searchTokens = useMemo(() => tokensForSearch(qText), [qText]);
  const impressed = useRef(new Set<string>());

  const items = useMemo(() => {
    return applyMarketProductFilters({
      products: productsPool,
      filters,
      sortKey,
      tokenHits,
    });
  }, [productsPool, filters, sortKey, tokenHits]);

  const deals = useMemo(() => {
    const forced: MarketFilterState = {
      ...filters,
      status: { ...filters.status, onSale: true },
    };
    const arr = applyMarketProductFilters({
      products: dealsPool,
      filters: forced,
      sortKey: "recommended",
      tokenHits: null,
    });
    return arr.filter((p: any) => saleIsActive(p)).slice(0, 12);
  }, [dealsPool, filters]);

  const stores = useMemo(() => {
    const stNeed = String(filters.location.state || "").trim().toLowerCase();
    const ctNeed = String(filters.location.city || "").trim().toLowerCase();
    return (storesPool || [])
      .filter((b: any) => !!String(b?.slug || "").trim())
      .filter((b: any) => hasActiveSubscriptionBusiness(b))
      .filter((b: any) => {
        if (!stNeed) return true;
        return String(b?.state || "").toLowerCase().includes(stNeed);
      })
      .filter((b: any) => {
        if (!ctNeed) return true;
        return String(b?.city || "").toLowerCase().includes(ctNeed);
      })
      .slice(0, 12);
  }, [storesPool, filters.location.state, filters.location.city]);

  const fashionFacets = useMemo(() => buildFashionFacets(productsPool), [productsPool]);
  const searchingLabel = useMemo(() => (searchTokens.length ? searchTokens.join(", ") : ""), [searchTokens]);

  const hasAnyFilter = useMemo(() => {
    const f = filters;
    return !!(
      f.category ||
      f.location.state ||
      f.location.city ||
      f.price.min != null ||
      f.price.max != null ||
      f.price.quick ||
      f.categorySpecific.color ||
      f.categorySpecific.size ||
      f.trust.verification !== "any" ||
      f.trust.trustedBadgeOnly ||
      f.status.onSale ||
      f.status.newArrivals ||
      f.status.availableNow ||
      f.status.limitedStock
    );
  }, [filters]);

  const filterChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];
    if (filters.category) {
      const lbl = MARKET_CATEGORIES.find((c) => c.key === filters.category)?.label || filters.category;
      chips.push({
        key: "cat",
        label: `Category: ${lbl}`,
        onRemove: () => setFilters((s) => ({ ...s, category: null, categorySpecific: { color: null, size: null } })),
      });
    }
    if (filters.location.state) {
      chips.push({
        key: "state",
        label: `State: ${filters.location.state}`,
        onRemove: () => setFilters((s) => ({ ...s, location: { state: null, city: null } })),
      });
    }
    if (filters.location.city) {
      chips.push({
        key: "city",
        label: `Area: ${filters.location.city}`,
        onRemove: () => setFilters((s) => ({ ...s, location: { ...s.location, city: null } })),
      });
    }
    if (filters.price.min != null || filters.price.max != null) {
      const min = filters.price.min != null ? `₦${filters.price.min.toLocaleString("en-NG")}` : "₦0";
      const max = filters.price.max != null ? `₦${filters.price.max.toLocaleString("en-NG")}` : "Any";
      chips.push({
        key: "price",
        label: `Price: ${min} – ${max}`,
        onRemove: () => setFilters((s) => ({ ...s, price: { min: null, max: null, quick: null } })),
      });
    }
    // ... other chips ...
    return chips;
  }, [filters]);

  async function loadDeals() {
    setDealsLoading(true);
    try {
      const qRef = query(collection(db, "products"), where("saleMarketBoost", "==", true), limit(120));
      const snap = await getDocs(qRef);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setDealsPool(rows);
    } catch {
      setDealsPool([]);
    } finally {
      setDealsLoading(false);
    }
  }

  async function loadTrending() {
    setLoading(true);
    setMsg(null);
    setStoresPool([]);
    setStoresLoading(false);
    setTokenHits(null);
    try {
      const boostedRef = query(collection(db, "products"), where("boostUntilMs", ">", Date.now()), orderBy("boostUntilMs", "desc"), limit(50));
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
      setProductsPool(merged);
    } catch (e: any) {
      setMsg(e?.message || "Could not load marketplace. Please try again.");
      setProductsPool([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadByCategory(cat: MarketCategoryKey) {
    setLoading(true);
    setMsg(null);
    setStoresPool([]);
    setStoresLoading(false);
    setTokenHits(null);
    try {
      const qRef = query(collection(db, "products"), where("categoryKeys", "array-contains", cat), limit(180));
      const snap = await getDocs(qRef);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setProductsPool(rows);
    } catch (e: any) {
      setMsg(e?.message || "Could not load this category. Please try again.");
      setProductsPool([]);
    } finally {
      setLoading(false);
    }
  }

  async function runSearch() {
    const tokens = tokensForSearch(qText);
    if (!tokens.length) {
      if (filters.category) return loadByCategory(filters.category);
      return loadTrending();
    }
    setLoading(true);
    setStoresLoading(true);
    setMsg(null);
    try {
      const hits: Record<string, number> = {};
      const productMap = new Map<string, any>();
      const productSnaps = await Promise.all(tokens.map((t) => getDocs(query(collection(db, "products"), where("keywords", "array-contains", t), limit(120)))));
      for (const snap of productSnaps) {
        for (const d of snap.docs) {
          const id = d.id;
          hits[id] = (hits[id] || 0) + 1;
          if (!productMap.has(id)) productMap.set(id, { id, ...d.data() });
        }
      }
      setTokenHits(hits);
      setProductsPool(Array.from(productMap.values()));
      const storeMap = new Map<string, any>();
      const storeSnaps = await Promise.all(tokens.map((t) => getDocs(query(collection(db, "businesses"), where("searchKeywords", "array-contains", t), limit(40)))));
      for (const snap of storeSnaps) {
        for (const d of snap.docs) {
          const id = d.id;
          if (!storeMap.has(id)) storeMap.set(id, { id, ...d.data() });
        }
      }
      setStoresPool(Array.from(storeMap.values()));
    } catch (e: any) {
      setMsg(e?.message || "Could not search. Please try again.");
      setProductsPool([]);
      setStoresPool([]);
      setTokenHits(null);
    } finally {
      setLoading(false);
      setStoresLoading(false);
    }
  }

  useEffect(() => {
    loadTrending();
    loadDeals();
  }, []);

  useEffect(() => {
    loadDeals();
  }, [filters.category]);

  useEffect(() => {
    try {
      const events = items
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
      if (events.length) trackBatch(events);
    } catch {}
  }, [items]);

  function openProduct(p: any) {
    const slug = String(p?.businessSlug || "");
    if (!slug) return;
    if (p?.businessId && p?.id) {
      track({ type: "market_click", businessId: String(p.businessId), businessSlug: slug, productId: String(p.id) });
    }
    router.push(`/b/${slug}/p/${p.id}`);
  }

  function handleAddToCart(e: React.MouseEvent, p: any) {
    e.stopPropagation();
    addToCart(p.businessSlug, {
      productId: p.id,
      name: p.name,
      price: saleIsActive(p) ? computeSalePriceNgn(p) : p.price,
      imageUrl: Array.isArray(p?.images) ? p.images[0] : "",
      // --- THIS IS THE FIX ---
      selectedOptions: undefined, // Use 'undefined' instead of 'null' to match the type
    });
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
      <div key={p.id} className="relative text-left">
        <button onClick={() => openProduct(p)} className="w-full">
          <Card className="p-3 hover:bg-black/[0.02] transition">
            <div className={`${aspectClass} w-full rounded-2xl bg-gradient-to-br from-biz-sand to-biz-cream overflow-hidden relative`}>
              {img ? (<CloudImage src={img} alt={p?.name || "Listing"} w={w} h={h} sizes="(max-width: 430px) 45vw, 220px" className="h-full w-full object-cover" />) : (<div className="h-full w-full flex items-center justify-center text-xs text-gray-400">No image</div>)}
              {apexBadgeActive ? (<div className="absolute top-2 left-2 px-2 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-100 inline-flex items-center gap-1"><BadgeCheck className="h-3.5 w-3.5" /> Trusted badge</div>) : boosted ? (<div className="absolute top-2 left-2 px-2 py-1 rounded-full text-[10px] font-bold bg-white/90 border border-black/5 inline-flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-orange-600" /> Promoted</div>) : null}
              {onSale ? (<div className="absolute top-2 right-2 px-2 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-100">{saleBadgeText(p, fmtNaira)}</div>) : null}
              <div className="absolute bottom-2 left-2 px-2 py-1 rounded-full text-[10px] font-bold bg-white/90 border border-black/5">{verificationLabel(tier)}</div>
            </div>
            <p className="mt-2 text-sm font-bold text-biz-ink line-clamp-2">{p?.name || "Unnamed"}</p>
            <p className="mt-1 text-xs text-biz-muted">{bookOnly ? "Book only" : onSale ? (<><span className="line-through text-gray-400 mr-1">{fmtNaira(basePrice)}</span><span className="text-emerald-700 font-extrabold">{fmtNaira(finalPrice)}</span></>) : (fmtNaira(basePrice))}</p>
            <p className="mt-1 text-[11px] text-gray-500">Vendor: <b className="text-biz-ink">{p?.businessSlug || "—"}</b></p>
          </Card>
        </button>
        {!bookOnly && (<button onClick={(e) => handleAddToCart(e, p)} className="absolute bottom-5 right-5 h-8 w-8 bg-biz-accent text-white rounded-full flex items-center justify-center shadow-lg hover:bg-biz-accent-darker transition-transform active:scale-90" aria-label="Add to cart"><Plus className="h-5 w-5" /></button>)}
      </div>
    );
  }

  function renderStoreCard(b: any) {
    const slug = String(b?.slug || "").trim();
    const name = String(b?.name || slug || "Store");
    const state = String(b?.state || "").trim();
    const city = String(b?.city || "").trim();
    const loc = [city, state].filter(Boolean).join(", ");
    return (
      <Link key={b?.id || slug} href={slug ? `/b/${slug}` : "#"} className="block rounded-2xl border border-biz-line bg-white p-3 hover:bg-black/[0.02] transition">
        <p className="text-sm font-extrabold text-biz-ink line-clamp-1">{name}</p>
        <p className="text-[11px] text-biz-muted mt-1 line-clamp-2">{String(b?.description || "Visit vendor")}</p>
        <p className="text-[11px] text-gray-500 mt-2">@{slug} {loc ? <>• {loc}</> : null}</p>
      </Link>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="relative">
        <div className="h-2 w-full bg-gradient-to-r from-biz-accent2 to-biz-accent" />
        <div className="px-4 pt-5 pb-5 bg-gradient-to-b from-biz-sand to-biz-bg">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="relative h-14 sm:h-16" style={{ width: "min(520px, 78vw)" }}><Image src="/brand/logo-transparent.png" alt="myBizHub" fill priority className="object-contain object-left" sizes="(max-width: 430px) 78vw, 520px" /></div>
              <p className="text-xs text-biz-muted mt-1">Discover products & vendors</p>
            </div>
            <Link href="/cart" className="rounded-2xl border border-biz-line bg-white px-4 py-2 text-xs font-bold shadow-soft">Cart</Link>
          </div>
          <Card className="p-3 mt-4">
            <div className="flex gap-2">
              <Input placeholder="Search products, services, vendors…" value={qText} onChange={(e) => setQText(e.target.value)} />
              <Button size="sm" onClick={runSearch} disabled={loading}>Search</Button>
            </div>
            <p className="mt-2 text-[11px] text-biz-muted">{searchTokens.length ? (<>Searching: <b className="text-biz-ink">{searchingLabel}</b></>) : filters.category ? (<>Category: <b className="text-biz-ink">{MARKET_CATEGORIES.find((c) => c.key === filters.category)?.label || filters.category}</b></>) : (<>Showing latest + promoted</>)}</p>
          </Card>
          <Card className="p-3 mt-3">
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" size="sm" onClick={() => setFilterOpen(true)}>Filters</Button>
              <Button variant="secondary" size="sm" onClick={() => setSortOpen(true)}>Sort</Button>
            </div>
            {filterChips.length ? (<div className="mt-3 flex flex-wrap gap-2">{filterChips.map((c) => (<Chip key={c.key} active onClick={c.onRemove}>{c.label} ✕</Chip>))}</div>) : null}
            {hasAnyFilter ? (<div className="mt-3"><Button variant="secondary" size="sm" onClick={() => setFilters(DEFAULT_MARKET_FILTERS)}>Clear all</Button></div>) : null}
          </Card>
        </div>
      </div>
      <div className="px-4 pb-24 space-y-3">
        <Card className="p-4">
          <p className="font-bold text-biz-ink">Hot deals</p>
          <p className="text-[11px] text-biz-muted mt-1">Discounts from trusted vendors</p>
          {dealsLoading ? (<p className="text-sm text-biz-muted mt-3">Loading…</p>) : deals.length === 0 ? (<EmptyState title="No deals right now" description="Check back soon for discounts." className="mt-3" />) : (<div className="mt-3 grid grid-cols-2 gap-3 items-start">{deals.slice(0, 6).map((p: any) => renderCard(p))}</div>)}
        </Card>
        <Card className="p-4">
          <p className="font-bold text-biz-ink">Categories</p>
          <p className="text-[11px] text-biz-muted mt-1">Browse by what you're looking for</p>
          <div className="mt-3 grid grid-cols-3 gap-2">{MARKET_CATEGORIES.filter((c) => c.key !== "other").map((c) => {
              const active = filters.category === c.key;
              return (<button key={c.key} onClick={() => { setFilters((s) => ({ ...s, category: s.category === c.key ? null : c.key, categorySpecific: { color: null, size: null }, })); setTimeout(runSearch, 0); }} className={active ? "rounded-2xl border border-biz-accent/30 bg-gradient-to-br from-orange-50 to-white p-3 text-left shadow-soft" : "rounded-2xl border border-biz-line bg-white p-3 text-left hover:bg-black/[0.02] transition"}>
                  <p className={active ? "text-sm font-bold text-biz-accent" : "text-sm font-bold text-biz-ink"}>{c.label}</p>
                  <p className="text-[11px] text-biz-muted mt-1">{c.hint}</p>
                </button>);})}
          </div>
        </Card>
        {searchTokens.length ? (<Card className="p-4"><p className="font-bold text-biz-ink">Vendors</p><p className="text-[11px] text-biz-muted mt-1">Vendors matching your search</p>{storesLoading ? (<p className="text-sm text-biz-muted mt-3">Loading…</p>) : stores.length === 0 ? (<EmptyState title="No vendors found" description="Try a different keyword or check product results below." className="mt-3" />) : (<div className="mt-3 grid grid-cols-1 gap-2">{stores.map((b: any) => renderStoreCard(b))}</div>)}</Card>) : null}
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}
        {loading ? (<Card className="p-4">Loading…</Card>) : items.length === 0 ? (<EmptyState title="No results" description="Try a different search term or adjust your filters." ctaLabel="Clear filters" onCta={() => { setFilters(DEFAULT_MARKET_FILTERS); setSortKey("recommended"); setQText(""); loadTrending(); }}/>) : (<div className="grid grid-cols-2 gap-3 items-start">{items.map((p: any) => renderCard(p))}</div>)}
      </div>
      <MarketFilterSheet open={filterOpen} onClose={() => setFilterOpen(false)} value={filters} onApply={(v) => setFilters(v)} productsPool={productsPool} fashionFacets={fashionFacets} />
      <MarketSortSheet open={sortOpen} onClose={() => setSortOpen(false)} value={sortKey} onChange={(v) => setSortKey(v)} />
    </div>
  );
}