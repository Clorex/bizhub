"use client";

import { Suspense, useEffect, useMemo, useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ShoppingCart, SlidersHorizontal, ArrowUpDown, X, ArrowUp, Sparkles } from "lucide-react";

import { useCart } from "@/lib/cart/CartContext";
import { useMarketSearch } from "@/hooks/useMarketSearch";
import { buildFashionFacets } from "@/lib/market/filters/facets";
import { saleIsActive, computeSalePriceNgn } from "@/lib/market/sale";
import { DEFAULT_MARKET_FILTERS, type MarketFilterState, type MarketSortKey } from "@/lib/market/filters/types";
import { MARKET_CATEGORIES, type MarketCategoryKey } from "@/lib/search/marketTaxonomy";
import { toast } from "@/lib/ui/toast";
import { formatMoneyNGN } from "@/lib/money";

import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";
import { SectionCard } from "@/components/ui/SectionCard";
import { ProductGridSkeleton, StoreCardSkeleton } from "@/components/ui/Skeleton";

import { ProductCard } from "@/components/market/ProductCard";
import { StoreCard } from "@/components/market/StoreCard";
import { DealsCarousel } from "@/components/market/DealsCarousel";
import { CategoryGrid } from "@/components/market/CategoryGrid";
import { SearchBar } from "@/components/market/SearchBar";
import { MarketFilterSheet } from "@/components/market/MarketFilterSheet";
import { MarketSortSheet } from "@/components/market/MarketSortSheet";

const POPULAR_SEARCHES = ["iPhone", "Sneakers", "Wigs", "Bags", "Perfume", "Ankara"];
const ITEMS_PER_PAGE = 20;

/* ————— URL param helpers (B5-3) ————— */

function filtersToParams(filters: MarketFilterState, sortKey: MarketSortKey, q: string): URLSearchParams {
  const p = new URLSearchParams();
  if (q) p.set("q", q);
  if (filters.category) p.set("cat", filters.category);
  if (filters.location.state) p.set("state", filters.location.state);
  if (filters.location.city) p.set("city", filters.location.city);
  if (filters.price.min != null) p.set("pmin", String(filters.price.min));
  if (filters.price.max != null) p.set("pmax", String(filters.price.max));
  if (filters.status.onSale) p.set("sale", "1");
  if (filters.trust.trustedBadgeOnly) p.set("trusted", "1");
  if (sortKey !== "recommended") p.set("sort", sortKey);
  return p;
}

function paramsToFilters(sp: URLSearchParams): { filters: MarketFilterState; sortKey: MarketSortKey; q: string } {
  const filters: MarketFilterState = {
    ...DEFAULT_MARKET_FILTERS,
    category: (sp.get("cat") as MarketCategoryKey) || null,
    location: { state: sp.get("state") || null, city: sp.get("city") || null },
    price: {
      min: sp.has("pmin") ? Number(sp.get("pmin")) : null,
      max: sp.has("pmax") ? Number(sp.get("pmax")) : null,
      quick: null,
    },
    status: { ...DEFAULT_MARKET_FILTERS.status, onSale: sp.get("sale") === "1" },
    trust: { ...DEFAULT_MARKET_FILTERS.trust, trustedBadgeOnly: sp.get("trusted") === "1" },
  };

  const sortKey = (sp.get("sort") as MarketSortKey) || "recommended";
  const q = sp.get("q") || "";
  return { filters, sortKey, q };
}

/**
 * IMPORTANT (build fix):
 * Wrap the component using useSearchParams() in Suspense to avoid prerender/export errors.
 */
export default function MarketPage() {
  return (
    <Suspense fallback={<MarketPageFallback />}>
      <MarketPageInner />
    </Suspense>
  );
}

function MarketPageFallback() {
  return (
    <div className="min-h-screen bg-gray-50 px-4 pt-4 pb-24">
      <div className="h-10 w-40 bg-gray-200 rounded-xl mb-4" />
      <Card className="p-4">
        <p className="text-sm text-gray-600">Loading market…</p>
      </Card>
      <div className="mt-4">
        <ProductGridSkeleton count={6} />
      </div>
    </div>
  );
}

function MarketPageInner() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { addToCart, cart } = useCart();

  const initial = useMemo(() => paramsToFilters(searchParams), []); // only on mount

  const [filters, setFilters] = useState<MarketFilterState>(initial.filters);
  const [sortKey, setSortKey] = useState<MarketSortKey>(initial.sortKey);
  const [searchText, setSearchText] = useState(initial.q);

  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE);

  const {
    loading,
    dealsLoading,
    storesLoading,
    error,
    searchQuery,
    productsPool,
    matchScores,
    smartMatchEnabled,
    runSearch,
    loadTrending,
    getFilteredProducts,
    getFilteredDeals,
    getFilteredStores,
    trackImpressions,
    trackProductClick,
  } = useMarketSearch({ filters, sortKey });

  const items = useMemo(() => getFilteredProducts(), [getFilteredProducts]);
  const deals = useMemo(() => getFilteredDeals(), [getFilteredDeals]);
  const stores = useMemo(() => getFilteredStores(), [getFilteredStores]);
  const fashionFacets = useMemo(() => buildFashionFacets(productsPool), [productsPool]);

  const displayedItems = useMemo(() => items.slice(0, displayCount), [items, displayCount]);
  const hasMore = displayCount < items.length;

  const itemCount = useMemo(() => {
    const list = Array.isArray(cart?.items) ? cart.items : [];
    return list.reduce((s: number, it: any) => s + Math.max(0, Number(it?.qty || 0)), 0);
  }, [cart]);

  // Sync filters → URL (shallow)
  useEffect(() => {
    const params = filtersToParams(filters, sortKey, searchText);
    const qs = params.toString();
    const target = qs ? `${pathname}?${qs}` : pathname;
    const current = searchParams.toString();
    if (qs !== current) router.replace(target, { scroll: false });
  }, [filters, sortKey, searchText, pathname, router, searchParams]);

  useEffect(() => {
    trackImpressions(displayedItems);
  }, [displayedItems, trackImpressions]);

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 800);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setDisplayCount(ITEMS_PER_PAGE);
  }, [filters, sortKey, searchQuery]);

  useEffect(() => {
    if (initial.q) runSearch(initial.q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = useCallback(() => runSearch(searchText), [runSearch, searchText]);

  const handleCategorySelect = useCallback(
    (category: MarketCategoryKey | null) => {
      setFilters((s) => ({ ...s, category, categorySpecific: { color: null, size: null } }));
      if (category) {
        runSearch("");
        setSearchText("");
      }
    },
    [runSearch]
  );

  const handleProductClick = useCallback(
    (product: any) => {
      const slug = String(product?.businessSlug || "");
      if (!slug) return;
      trackProductClick(product);
      router.push(`/b/${slug}/p/${product.id}`);
    },
    [router, trackProductClick]
  );

  const handleAddToCart = useCallback(
    (product: any) => {
      const price = saleIsActive(product) ? computeSalePriceNgn(product) : product.price;
      addToCart(product.businessSlug, {
        productId: product.id,
        name: product.name,
        price,
        imageUrl: Array.isArray(product?.images) ? product.images[0] : "",
        selectedOptions: undefined,
      });
      toast.success(`${String(product?.name || "Item").slice(0, 30)} added to cart`);
    },
    [addToCart]
  );

  const handleLoadMore = () => setDisplayCount((prev) => prev + ITEMS_PER_PAGE);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const clearAllFilters = () => {
    setFilters(DEFAULT_MARKET_FILTERS);
    setSortKey("recommended");
    setSearchText("");
    loadTrending();
  };

  const filterChips = useMemo(() => {
    const chips: { key: string; label: string; onRemove: () => void }[] = [];

    if (filters.category) {
      const lbl = MARKET_CATEGORIES.find((c) => c.key === filters.category)?.label || filters.category;
      chips.push({
        key: "cat",
        label: lbl,
        onRemove: () => setFilters((s) => ({ ...s, category: null, categorySpecific: { color: null, size: null } })),
      });
    }

    if (filters.location.state) {
      chips.push({
        key: "state",
        label: filters.location.state,
        onRemove: () => setFilters((s) => ({ ...s, location: { state: null, city: null } })),
      });
    }

    if (filters.price.min != null || filters.price.max != null) {
      const min = filters.price.min != null ? formatMoneyNGN(filters.price.min) : formatMoneyNGN(0);
      const max = filters.price.max != null ? formatMoneyNGN(filters.price.max) : "Any";
      chips.push({
        key: "price",
        label: `${min} – ${max}`,
        onRemove: () => setFilters((s) => ({ ...s, price: { min: null, max: null, quick: null } })),
      });
    }

    if (filters.status.onSale) {
      chips.push({
        key: "sale",
        label: "On Sale",
        onRemove: () => setFilters((s) => ({ ...s, status: { ...s.status, onSale: false } })),
      });
    }

    if (filters.trust.trustedBadgeOnly) {
      chips.push({
        key: "trusted",
        label: "Trusted Only",
        onRemove: () => setFilters((s) => ({ ...s, trust: { ...s.trust, trustedBadgeOnly: false } })),
      });
    }

    if (sortKey !== "recommended") {
      const sortLabels: Record<string, string> = {
        best_match: "Best Match",
        price_low: "Price: Low→High",
        price_high: "Price: High→Low",
        newest: "Newest",
        popular: "Popular",
      };
      chips.push({
        key: "sort",
        label: `Sort: ${sortLabels[sortKey] || sortKey}`,
        onRemove: () => setSortKey("recommended"),
      });
    }

    return chips;
  }, [filters, sortKey]);

  const hasActiveFilters = filterChips.length > 0 || searchQuery;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="relative h-8" style={{ width: "min(140px, 40vw)" }}>
                <Image src="/brand/logo-transparent.png" alt="myBizHub" fill priority className="object-contain object-left" sizes="140px" />
              </div>
            </div>
            <Link
              href="/cart"
              className="relative flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-semibold hover:border-orange-200 transition"
            >
              <ShoppingCart className="w-5 h-5 text-gray-600" />
              <span className="hidden sm:inline">Cart</span>
              {itemCount > 0 && (
                <span className="absolute -top-2 -right-2 w-5 h-5 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {itemCount > 9 ? "9+" : itemCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* Search Section */}
      <div className="bg-gradient-to-b from-orange-50 to-gray-50 px-4 py-4">
        <SearchBar value={searchText} onChange={setSearchText} onSearch={handleSearch} loading={loading} suggestions={POPULAR_SEARCHES} />

        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={() => setFilterOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:border-orange-200 transition"
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {filterChips.length > 0 && (
              <span className="w-5 h-5 bg-orange-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                {filterChips.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setSortOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white text-sm font-semibold hover:border-orange-200 transition"
          >
            <ArrowUpDown className="w-4 h-4" />
            Sort
          </button>

          {smartMatchEnabled && sortKey !== "best_match" ? (
            <button
              onClick={() => setSortKey("best_match")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-200 bg-emerald-50 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Best Match
            </button>
          ) : null}

          {smartMatchEnabled && sortKey === "best_match" ? (
            <button
              onClick={() => setSortKey("recommended")}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-orange-300 bg-gradient-to-br from-orange-50 to-white text-xs font-bold text-orange-700 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Best Match ✓
            </button>
          ) : null}
        </div>

        {filterChips.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {filterChips.map((chip) => (
              <Chip key={chip.key} active onClick={chip.onRemove}>
                {chip.label}
                <X className="w-3 h-3 ml-1" />
              </Chip>
            ))}
            <button onClick={clearAllFilters} className="text-xs font-semibold text-orange-600 hover:text-orange-700 px-2">
              Clear all
            </button>
          </div>
        )}

        {searchQuery && (
          <p className="mt-3 text-sm text-gray-600">
            Searching for <span className="font-bold text-gray-900">“{searchQuery}”</span>
            {items.length > 0 && (
              <span className="text-gray-500">
                {" "}
                • {items.length} result{items.length !== 1 ? "s" : ""}
              </span>
            )}
          </p>
        )}
      </div>

      <div className="px-4 pb-24 space-y-6 pt-6 max-w-[1100px] mx-auto">
        {error && (
          <Card className="p-4 bg-red-50 border-red-100">
            <p className="text-red-700 font-medium text-sm">{error}</p>
            <Button variant="secondary" size="sm" onClick={loadTrending} className="mt-2">
              Try again
            </Button>
          </Card>
        )}

        <DealsCarousel deals={deals} loading={dealsLoading} onProductClick={handleProductClick} onAddToCart={handleAddToCart} />

        {!searchQuery && (
          <SectionCard title="Categories" subtitle="Browse by what you’re looking for" right={<Sparkles className="w-5 h-5 text-orange-500" />}>
            <CategoryGrid selectedCategory={filters.category} onSelectCategory={handleCategorySelect} />
          </SectionCard>
        )}

        {searchQuery && (
          <SectionCard title="Stores" subtitle="Vendors matching your search">
            {storesLoading ? (
              <div className="space-y-2">
                <StoreCardSkeleton />
                <StoreCardSkeleton />
              </div>
            ) : stores.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No stores found for this search</p>
            ) : (
              <div className="space-y-2">
                {stores.map((store) => (
                  <StoreCard key={store.id} store={store} />
                ))}
              </div>
            )}
          </SectionCard>
        )}

        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {sortKey === "best_match"
                  ? "Best Match"
                  : searchQuery
                    ? "Products"
                    : filters.category
                      ? MARKET_CATEGORIES.find((c) => c.key === filters.category)?.label || "Products"
                      : "Trending"}
              </h2>
              {!loading && items.length > 0 && (
                <p className="text-xs text-gray-500 mt-0.5">
                  {items.length} product{items.length !== 1 ? "s" : ""} found
                </p>
              )}
            </div>
          </div>

          {loading ? (
            <ProductGridSkeleton count={6} />
          ) : items.length === 0 ? (
            <EmptyState
              title="No products found"
              description={hasActiveFilters ? "Try adjusting your filters or search terms" : "Check back later for new products"}
              ctaLabel={hasActiveFilters ? "Clear filters" : undefined}
              onCta={hasActiveFilters ? clearAllFilters : undefined}
            />
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {displayedItems.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onClick={() => handleProductClick(product)}
                    onAddToCart={() => handleAddToCart(product)}
                    matchResult={matchScores?.[String(product?.id || "")] || null}
                  />
                ))}
              </div>

              {hasMore && (
                <div className="mt-6 text-center">
                  <Button variant="secondary" onClick={handleLoadMore} className="px-8">
                    Load more ({items.length - displayCount} remaining)
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showBackToTop && (
        <button
          onClick={scrollToTop}
          className="fixed bottom-24 right-4 w-12 h-12 bg-orange-500 text-white rounded-full shadow-lg flex items-center justify-center hover:bg-orange-600 transition-all z-40"
          aria-label="Back to top"
        >
          <ArrowUp className="w-5 h-5" />
        </button>
      )}

      <MarketFilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        value={filters}
        onApply={(v) => {
          setFilters(v);
          runSearch(searchText);
        }}
        productsPool={productsPool}
        fashionFacets={fashionFacets}
      />

      <MarketSortSheet open={sortOpen} onClose={() => setSortOpen(false)} value={sortKey} onChange={(v) => setSortKey(v)} />
    </div>
  );
}

