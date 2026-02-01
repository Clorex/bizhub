// FILE: src/app/market/page.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase/client";
import { collection, getDocs, limit, orderBy, query, where, DocumentData } from "firebase/firestore";

import { Card } from "@/components/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { trackBatch, track } from "@/lib/track/client";
import { Chip } from "@/components/ui/Chip";

function fmtNaira(n: number) {
  try {
    return `₦${Number(n || 0).toLocaleString()}`;
  } catch {
    return `₦${n}`;
  }
}

function tokenForSearch(q: string) {
  const t = q.toLowerCase().trim().split(/\s+/).filter(Boolean)[0] || "";
  return t.slice(0, 10);
}

const CATEGORIES = [
  { label: "Fashion", hint: "Clothes, shoes" },
  { label: "Phones", hint: "Android, iPhone" },
  { label: "Beauty", hint: "Hair, makeup" },
  { label: "Home", hint: "Kitchen, decor" },
  { label: "Bags", hint: "Handbags" },
  { label: "Services", hint: "Lash, nails" },
];

function listingSubtitle(p: any) {
  const isService = String(p?.listingType || "product") === "service";
  const serviceMode = String(p?.serviceMode || "book");
  if (!isService) return fmtNaira(p?.price || 0);
  return serviceMode === "pay" ? fmtNaira(p?.price || 0) : "Book only";
}

function tierLabel(n: any) {
  const t = Number(n || 0);
  if (t >= 3) return "Tier 3";
  if (t === 2) return "Tier 2";
  if (t === 1) return "Tier 1";
  return "Tier 0";
}

export default function MarketPage() {
  const router = useRouter();
  const [qText, setQText] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<DocumentData[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const [tierFilter, setTierFilter] = useState<number | null>(null);
  const [stateFilter, setStateFilter] = useState<string>("");
  const [cityFilter, setCityFilter] = useState<string>("");

  const token = useMemo(() => tokenForSearch(qText), [qText]);
  const impressed = useRef(new Set<string>());

  function applyMarketRules(list: any[]) {
    // ✅ Rule: FREE vendors do NOT appear on Market.
    // We enforce this via a denormalized product field: businessHasActiveSubscription.
    return list
      .filter((p: any) => p?.marketEnabled !== false)
      .filter((p: any) => !!p?.businessSlug)
      .filter((p: any) => p?.businessHasActiveSubscription === true)
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
      .sort((a: any, b: any) => {
        // Higher marketScore first (tier boosts, dispute penalties reduce)
        return Number(b.marketScore || 0) - Number(a.marketScore || 0);
      });
  }

  async function loadTrending() {
    setLoading(true);
    setMsg(null);
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
      setMsg(e?.message || "Failed to load market");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function runSearch() {
    const t = tokenForSearch(qText);
    if (!t) return loadTrending();

    setLoading(true);
    setMsg(null);

    try {
      const qRef = query(collection(db, "products"), where("keywords", "array-contains", t), limit(120));
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
      setMsg(e?.message || "Search failed");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadTrending();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // re-apply filters without refetch
    setItems((prev) => applyMarketRules(prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tierFilter, stateFilter, cityFilter]);

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

  return (
    <div className="min-h-screen">
      <div className="relative">
        <div className="h-2 w-full bg-gradient-to-r from-biz-accent2 to-biz-accent" />
        <div className="px-4 pt-5 pb-5 bg-gradient-to-b from-biz-sand to-biz-bg">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-lg font-bold text-biz-ink">
                BizHub<span className="text-biz-accent">.</span>
              </p>
              <p className="text-xs text-biz-muted mt-1">Marketplace</p>
            </div>

            <Link href="/cart" className="rounded-2xl border border-biz-line bg-white px-4 py-2 text-xs font-bold shadow-soft">
              Cart
            </Link>
          </div>

          <Card className="p-3 mt-4">
            <div className="flex gap-2">
              <Input placeholder="Search products or services…" value={qText} onChange={(e) => setQText(e.target.value)} />
              <Button size="sm" onClick={runSearch} disabled={loading}>
                Search
              </Button>
            </div>

            <p className="mt-2 text-[11px] text-biz-muted">
              {token ? (
                <>
                  Searching: <b className="text-biz-ink">{token}</b>
                </>
              ) : (
                <>Showing latest + promoted</>
              )}
            </p>
          </Card>

          <Card className="p-3 mt-3">
            <p className="text-xs font-bold text-gray-500">FILTERS</p>

            <div className="mt-2 flex gap-2 flex-wrap">
              {[null, 1, 2, 3].map((t) => (
                <Chip key={String(t)} active={tierFilter === t} onClick={() => setTierFilter(t as any)}>
                  {t == null ? "All tiers" : `Tier ${t}`}
                </Chip>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <Input placeholder="State (optional)" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} />
              <Input placeholder="City (optional)" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} />
            </div>

            <div className="mt-2">
              <Button variant="secondary" size="sm" onClick={() => { setTierFilter(null); setStateFilter(""); setCityFilter(""); }}>
                Clear filters
              </Button>
            </div>
          </Card>
        </div>
      </div>

      <div className="px-4 pb-24 space-y-3">
        <Card className="p-4">
          <p className="font-bold text-biz-ink">Categories</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.label}
                onClick={() => {
                  setQText(c.label);
                  setTimeout(runSearch, 0);
                }}
                className="rounded-2xl border border-biz-line bg-white p-3 text-left hover:bg-black/[0.02] transition"
              >
                <p className="text-sm font-bold text-biz-ink">{c.label}</p>
                <p className="text-[11px] text-biz-muted mt-1">{c.hint}</p>
              </button>
            ))}
          </div>
        </Card>

        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}

        {loading ? (
          <Card className="p-4">Loading…</Card>
        ) : items.length === 0 ? (
          <Card className="p-4">
            <p className="font-bold text-biz-ink">No results</p>
            <p className="text-sm text-biz-muted mt-1">Try another keyword or adjust filters.</p>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {items.map((p: any) => {
              const img = Array.isArray(p?.images) ? p.images[0] : "";
              const boosted = Number(p?.boostUntilMs || 0) > Date.now();
              const tier = Number(p?.marketTier ?? p?.verificationTier ?? 0);

              return (
                <button key={p.id} onClick={() => openProduct(p)} className="text-left">
                  <Card className="p-3">
                    <div className="h-28 w-full rounded-2xl bg-gradient-to-br from-biz-sand to-biz-cream overflow-hidden relative">
                      {img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img} alt={p?.name || "Listing"} className="h-full w-full object-cover" />
                      ) : null}

                      {boosted ? (
                        <div className="absolute top-2 left-2 px-2 py-1 rounded-full text-[10px] font-bold bg-white/90 border border-black/5">
                          Promoted
                        </div>
                      ) : null}

                      <div className="absolute bottom-2 left-2 px-2 py-1 rounded-full text-[10px] font-bold bg-white/90 border border-black/5">
                        {tierLabel(tier)}
                      </div>
                    </div>

                    <p className="mt-2 text-sm font-bold text-biz-ink line-clamp-2">{p?.name || "Unnamed"}</p>
                    <p className="mt-1 text-xs text-biz-muted">{listingSubtitle(p)}</p>

                    <p className="mt-1 text-[11px] text-gray-500">
                      Store: <b className="text-biz-ink">{p?.businessSlug || "—"}</b>
                    </p>
                  </Card>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}