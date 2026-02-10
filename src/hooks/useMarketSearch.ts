// FILE: src/hooks/useMarketSearch.ts
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { db } from "@/lib/firebase/client";
import {
  collection,
  getDocs,
  limit,
  orderBy,
  query,
  where,
  type DocumentData,
} from "firebase/firestore";
import { trackBatch, track } from "@/lib/track/client";
import { applyMarketProductFilters } from "@/lib/market/filters/apply";
import { saleIsActive } from "@/lib/market/sale";
import type { MarketFilterState, MarketSortKey } from "@/lib/market/filters/types";
import type { MarketCategoryKey } from "@/lib/search/marketTaxonomy";
// ✅ ADDED: SmartMatch imports
import { isSmartMatchEnabled } from "@/lib/smartmatch/featureFlag";
import type { ProductMatchResult } from "@/lib/smartmatch/types";

function normToken(w: string) {
  return String(w || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim()
    .slice(0, 10);
}

function tokensForSearch(q: string) {
  const raw = String(q || "").toLowerCase().trim().split(/\s+/).filter(Boolean);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const w of raw) {
    const t = normToken(w);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 3) break;
  }
  return out;
}

interface UseMarketSearchOptions {
  filters: MarketFilterState;
  sortKey: MarketSortKey;
}

export function useMarketSearch({ filters, sortKey }: UseMarketSearchOptions) {
  const [productsPool, setProductsPool] = useState<DocumentData[]>([]);
  const [dealsPool, setDealsPool] = useState<DocumentData[]>([]);
  const [storesPool, setStoresPool] = useState<DocumentData[]>([]);
  const [tokenHits, setTokenHits] = useState<Record<string, number> | null>(null);

  const [loading, setLoading] = useState(false);
  const [dealsLoading, setDealsLoading] = useState(false);
  const [storesLoading, setStoresLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const impressed = useRef(new Set<string>());

  // ✅ ADDED: SmartMatch scores state
  const [matchScores, setMatchScores] = useState<Record<string, ProductMatchResult> | null>(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const smartMatchEnabled = isSmartMatchEnabled();

  // ✅ ADDED: Fetch match scores for a pool of products
  const fetchMatchScores = useCallback(
    async (products: DocumentData[]) => {
      if (!smartMatchEnabled) return;
      if (products.length === 0) {
        setMatchScores(null);
        return;
      }

      setMatchLoading(true);

      try {
        // Build product stubs for the API
        const stubs = products.slice(0, 200).map((p) => ({
          id: String(p?.id || ""),
          businessId: String(p?.businessId || ""),
          categoryKeys: Array.isArray(p?.categoryKeys) ? p.categoryKeys : [],
        }));

        const res = await fetch("/api/smartmatch/rank", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            products: stubs,
            filters,
            // Phase 2: pass orderHistory from buyer's past orders
            orderHistory: [],
          }),
        });

        const data = await res.json().catch(() => ({}));

        if (data?.ok && data?.enabled && data?.scores) {
          setMatchScores(data.scores);
        } else {
          setMatchScores(null);
        }
      } catch {
        // Graceful degradation — no scores, market works normally
        setMatchScores(null);
      } finally {
        setMatchLoading(false);
      }
    },
    [smartMatchEnabled, filters]
  );

  // Load trending products (initial load)
  const loadTrending = useCallback(async () => {
    setLoading(true);
    setError(null);
    setStoresPool([]);
    setTokenHits(null);

    try {
      const [boostedSnap, latestSnap] = await Promise.all([
        getDocs(
          query(
            collection(db, "products"),
            where("boostUntilMs", ">", Date.now()),
            orderBy("boostUntilMs", "desc"),
            limit(50)
          )
        ),
        getDocs(
          query(collection(db, "products"), orderBy("createdAt", "desc"), limit(120))
        ),
      ]);

      const boosted = boostedSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const latest = latestSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const merged: any[] = [];
      const seen = new Set<string>();
      for (const p of [...boosted, ...latest]) {
        if (seen.has(p.id)) continue;
        seen.add(p.id);
        merged.push(p);
      }

      setProductsPool(merged);

      // ✅ ADDED: fetch match scores after products load
      fetchMatchScores(merged);
    } catch (e: any) {
      setError(e?.message || "Could not load marketplace. Please try again.");
      setProductsPool([]);
    } finally {
      setLoading(false);
    }
  }, [fetchMatchScores]);

  // Load deals
  const loadDeals = useCallback(async () => {
    setDealsLoading(true);
    try {
      const snap = await getDocs(
        query(collection(db, "products"), where("saleMarketBoost", "==", true), limit(120))
      );
      setDealsPool(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch {
      setDealsPool([]);
    } finally {
      setDealsLoading(false);
    }
  }, []);

  // Load by category
  const loadByCategory = useCallback(
    async (cat: MarketCategoryKey) => {
      setLoading(true);
      setError(null);
      setStoresPool([]);
      setTokenHits(null);

      try {
        const snap = await getDocs(
          query(
            collection(db, "products"),
            where("categoryKeys", "array-contains", cat),
            limit(180)
          )
        );

        const products = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setProductsPool(products);

        // ✅ ADDED: fetch match scores
        fetchMatchScores(products);
      } catch (e: any) {
        setError(e?.message || "Could not load this category. Please try again.");
        setProductsPool([]);
      } finally {
        setLoading(false);
      }
    },
    [fetchMatchScores]
  );

  // Run search
  const runSearch = useCallback(
    async (searchInput: string) => {
      const tokens = tokensForSearch(searchInput);
      setSearchQuery(searchInput);

      if (!tokens.length) {
        if (filters.category) {
          return loadByCategory(filters.category);
        }
        return loadTrending();
      }

      setLoading(true);
      setStoresLoading(true);
      setError(null);

      try {
        const [productResults, storeResults] = await Promise.all([
          Promise.all(
            tokens.map((t) =>
              getDocs(
                query(
                  collection(db, "products"),
                  where("keywords", "array-contains", t),
                  limit(120)
                )
              )
            )
          ),
          Promise.all(
            tokens.map((t) =>
              getDocs(
                query(
                  collection(db, "businesses"),
                  where("searchKeywords", "array-contains", t),
                  limit(40)
                )
              )
            )
          ),
        ]);

        const hits: Record<string, number> = {};
        const productMap = new Map<string, any>();
        for (const snap of productResults) {
          for (const d of snap.docs) {
            const id = d.id;
            hits[id] = (hits[id] || 0) + 1;
            if (!productMap.has(id)) productMap.set(id, { id, ...d.data() });
          }
        }
        setTokenHits(hits);

        const products = Array.from(productMap.values());
        setProductsPool(products);

        // ✅ ADDED: fetch match scores
        fetchMatchScores(products);

        const storeMap = new Map<string, any>();
        for (const snap of storeResults) {
          for (const d of snap.docs) {
            const id = d.id;
            if (!storeMap.has(id)) storeMap.set(id, { id, ...d.data() });
          }
        }
        setStoresPool(Array.from(storeMap.values()));
      } catch (e: any) {
        setError(e?.message || "Could not search. Please try again.");
        setProductsPool([]);
        setStoresPool([]);
        setTokenHits(null);
      } finally {
        setLoading(false);
        setStoresLoading(false);
      }
    },
    [filters.category, loadByCategory, loadTrending, fetchMatchScores]
  );

  // ✅ MODIFIED: pass matchScores to filter function
  const getFilteredProducts = useCallback(() => {
    return applyMarketProductFilters({
      products: productsPool,
      filters,
      sortKey,
      tokenHits,
      matchScores,
    });
  }, [productsPool, filters, sortKey, tokenHits, matchScores]);

  const getFilteredDeals = useCallback(() => {
    const forced: MarketFilterState = {
      ...filters,
      status: { ...filters.status, onSale: true },
    };
    return applyMarketProductFilters({
      products: dealsPool,
      filters: forced,
      sortKey: "recommended",
      tokenHits: null,
      matchScores: null,
    })
      .filter((p: any) => saleIsActive(p))
      .slice(0, 12);
  }, [dealsPool, filters]);

  const getFilteredStores = useCallback(() => {
    const stNeed = String(filters.location.state || "").trim().toLowerCase();
    const ctNeed = String(filters.location.city || "").trim().toLowerCase();

    return storesPool
      .filter((b: any) => !!String(b?.slug || "").trim())
      .filter((b: any) => {
        const exp = Number(b?.subscription?.expiresAtMs || 0);
        return !!(b?.subscription?.planKey && exp && exp > Date.now());
      })
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

  // Track impressions
  const trackImpressions = useCallback((products: any[]) => {
    try {
      const events = products
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
  }, []);

  // Track product click
  const trackProductClick = useCallback((product: any) => {
    if (product?.businessId && product?.id) {
      track({
        type: "market_click",
        businessId: String(product.businessId),
        businessSlug: String(product.businessSlug || ""),
        productId: String(product.id),
      });
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadTrending();
    loadDeals();
  }, [loadTrending, loadDeals]);

  // Reload deals when category changes
  useEffect(() => {
    loadDeals();
  }, [filters.category, loadDeals]);

  // ✅ ADDED: Refetch scores when filters change (buyer intent changed)
  useEffect(() => {
    if (smartMatchEnabled && productsPool.length > 0) {
      fetchMatchScores(productsPool);
    }
  }, [filters.location.state, filters.location.city, filters.category]);

  return {
    // State
    loading,
    dealsLoading,
    storesLoading,
    error,
    searchQuery,
    productsPool,
    // ✅ ADDED: expose match data
    matchScores,
    matchLoading,
    smartMatchEnabled,

    // Actions
    runSearch,
    loadTrending,
    loadByCategory,
    loadDeals,

    // Getters
    getFilteredProducts,
    getFilteredDeals,
    getFilteredStores,

    // Tracking
    trackImpressions,
    trackProductClick,
  };
}