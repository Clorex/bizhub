// FILE: src/components/market/MarketFilterSheet.tsx

"use client";

import { useEffect, useMemo, useState } from "react";
import { applyMarketProductFilters } from "@/lib/market/filters/apply"; // <-- ADDED
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { MARKET_CATEGORIES } from "@/lib/search/marketTaxonomy";
import {
  DEFAULT_MARKET_FILTERS,
  type MarketFilterState,
  type PriceQuickRange,
  type TrustVerificationLevel,
} from "@/lib/market/filters/types";
import { NG_STATES, areasForState } from "@/lib/locations/ngPopularAreas";
import type { DocumentData } from "firebase/firestore"; // <-- ADDED

function safeNum(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function rangeToMinMax(r: PriceQuickRange) {
  if (r === "UNDER_5K") return { min: null, max: 5000 };
  if (r === "5K_20K") return { min: 5000, max: 20000 };
  if (r === "20K_100K") return { min: 20000, max: 100000 };
  return { min: 100000, max: null };
}

const VERIFY_OPTIONS: { key: TrustVerificationLevel; label: string; hint: string }[] = [
  { key: "any", label: "Any seller", hint: "Show everyone" },
  { key: "verified", label: "Verified sellers", hint: "Basic verification" },
  { key: "id_verified", label: "ID-verified sellers", hint: "Stronger verification" },
  { key: "address_verified", label: "Address-verified sellers", hint: "Highest verification" },
];

export function MarketFilterSheet({
  open,
  onClose,
  value,
  onApply,
  productsPool, // <-- CHANGED
  fashionFacets,
}: {
  open: boolean;
  onClose: () => void;
  value: MarketFilterState;
  onApply: (v: MarketFilterState) => void;
  productsPool: DocumentData[]; // <-- CHANGED
  fashionFacets?: { colors: string[]; sizes: string[] };
}) {
  const [draft, setDraft] = useState<MarketFilterState>(value);
  const [showMore, setShowMore] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(value);
      setShowMore(false);
    }
  }, [open, value]);

  // --- START: NEW LOGIC TO FIX COUNT ---
  const liveResultCount = useMemo(() => {
    if (!open) return 0;
    const results = applyMarketProductFilters({
      products: productsPool,
      filters: draft,
      sortKey: "recommended", // sortKey doesn't affect the count, so 'recommended' is fine
    });
    return results.length;
  }, [draft, productsPool, open]);
  // --- END: NEW LOGIC ---

  const areas = useMemo(() => areasForState(draft.location.state), [draft.location.state]);

  const cityDatalistId = "ng_city_datalist";

  const hasAny = useMemo(() => {
    const d = draft;
    return !!(
      d.category ||
      d.location.state ||
      d.location.city ||
      d.price.min != null ||
      d.price.max != null ||
      d.price.quick ||
      d.categorySpecific.color ||
      d.categorySpecific.size ||
      d.trust.verification !== "any" ||
      d.trust.trustedBadgeOnly ||
      d.status.onSale ||
      d.status.newArrivals ||
      d.status.availableNow ||
      d.status.limitedStock
    );
  }, [draft]);

  function clearAll() {
    setDraft(DEFAULT_MARKET_FILTERS);
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Filters"
      footer={
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={clearAll} disabled={!hasAny}>
            Clear all
          </Button>
          <Button
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            Show results ({liveResultCount}) {/* <-- CHANGED */}
          </Button>
        </div>
      }
    >
      {/* ... REST OF THE FILE IS THE SAME, PASTE AS IS ... */}
      {/* CATEGORY (PRIMARY) */}
      <div>
        <p className="text-xs font-extrabold text-gray-500 uppercase">Category</p>

        <div className="mt-2 grid grid-cols-3 gap-2">
          <button
            onClick={() =>
              setDraft((s) => ({
                ...s,
                category: null,
                categorySpecific: { color: null, size: null },
              }))
            }
            className={
              !draft.category
                ? "rounded-2xl border border-biz-accent/30 bg-gradient-to-br from-orange-50 to-white p-3 text-left shadow-soft"
                : "rounded-2xl border border-biz-line bg-white p-3 text-left hover:bg-black/[0.02] transition"
            }
          >
            <p className={!draft.category ? "text-sm font-bold text-biz-accent" : "text-sm font-bold text-biz-ink"}>
              All
            </p>
            <p className="text-[11px] text-biz-muted mt-1">Any category</p>
          </button>

          {MARKET_CATEGORIES.filter((c) => c.key !== "other").map((c) => {
            const active = draft.category === c.key;
            return (
              <button
                key={c.key}
                onClick={() =>
                  setDraft((s) => ({
                    ...s,
                    category: s.category === c.key ? null : c.key,
                    categorySpecific: { color: null, size: null },
                  }))
                }
                className={
                  active
                    ? "rounded-2xl border border-biz-accent/30 bg-gradient-to-br from-orange-50 to-white p-3 text-left shadow-soft"
                    : "rounded-2xl border border-biz-line bg-white p-3 text-left hover:bg-black/[0.02] transition"
                }
              >
                <p className={active ? "text-sm font-bold text-biz-accent" : "text-sm font-bold text-biz-ink"}>
                  {c.label}
                </p>
                <p className="text-[11px] text-biz-muted mt-1">{c.hint}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* LOCATION (CORE) */}
      <div className="mt-5">
        <p className="text-xs font-extrabold text-gray-500 uppercase">Location</p>
        <div className="mt-2 grid grid-cols-1 gap-2">
          <Select
            value={draft.location.state || ""}
            onChange={(e) => {
              const next = e.target.value || null;
              setDraft((s) => ({
                ...s,
                location: { state: next, city: null },
              }));
            }}
          >
            <option value="">Anywhere (Nigeria)</option>
            {NG_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>

          <Input
            list={draft.location.state ? cityDatalistId : undefined}
            placeholder={draft.location.state ? "City / Area (optional)" : "Select a state first (optional)"}
            value={draft.location.city || ""}
            onChange={(e) =>
              setDraft((s) => ({
                ...s,
                location: { ...s.location, city: e.target.value || null },
              }))
            }
            disabled={!draft.location.state}
          />

          {draft.location.state ? (
            <datalist id={cityDatalistId}>
              {areas.map((a) => (
                <option key={a} value={a} />
              ))}
            </datalist>
          ) : null}

          <p className="text-[11px] text-biz-muted">Tip: Location affects ranking (same city/state shows higher).</p>
        </div>
      </div>

      {/* PRICE (ESSENTIAL) */}
      <div className="mt-5">
        <p className="text-xs font-extrabold text-gray-500 uppercase">Price (₦)</p>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <Input
            inputMode="numeric"
            placeholder="Min ₦"
            value={draft.price.min == null ? "" : String(draft.price.min)}
            onChange={(e) => {
              const n = safeNum(e.target.value);
              setDraft((s) => ({
                ...s,
                price: { ...s.price, min: n, quick: null },
              }));
            }}
          />
          <Input
            inputMode="numeric"
            placeholder="Max ₦"
            value={draft.price.max == null ? "" : String(draft.price.max)}
            onChange={(e) => {
              const n = safeNum(e.target.value);
              setDraft((s) => ({
                ...s,
                price: { ...s.price, max: n, quick: null },
              }));
            }}
          />
        </div>

        <div className="mt-2 flex flex-wrap gap-2">
          {[
            { key: "UNDER_5K", label: "Under ₦5k" },
            { key: "5K_20K", label: "₦5k – ₦20k" },
            { key: "20K_100K", label: "₦20k – ₦100k" },
            { key: "ABOVE_100K", label: "Above ₦100k" },
          ].map((r) => {
            const active = draft.price.quick === (r.key as any);
            return (
              <Chip
                key={r.key}
                active={active}
                onClick={() => {
                  const k = active ? null : (r.key as PriceQuickRange);
                  if (!k) {
                    setDraft((s) => ({ ...s, price: { ...s.price, quick: null } }));
                    return;
                  }
                  const mm = rangeToMinMax(k);
                  setDraft((s) => ({
                    ...s,
                    price: { min: mm.min, max: mm.max, quick: k },
                  }));
                }}
              >
                {r.label}
              </Chip>
            );
          })}
        </div>
      </div>

      {/* CATEGORY-SPECIFIC (DYNAMIC) — V1: Fashion only */}
      {draft.category === "fashion" ? (
        <div className="mt-5">
          <p className="text-xs font-extrabold text-gray-500 uppercase">Fashion details</p>

          <div className="mt-2">
            <p className="text-xs font-extrabold text-biz-ink">Color</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(fashionFacets?.colors || []).slice(0, 16).map((c) => (
                <Chip
                  key={c}
                  active={(draft.categorySpecific.color || "").toLowerCase() === c.toLowerCase()}
                  onClick={() =>
                    setDraft((s) => ({
                      ...s,
                      categorySpecific: {
                        ...s.categorySpecific,
                        color: (s.categorySpecific.color || "").toLowerCase() === c.toLowerCase() ? null : c,
                      },
                    }))
                  }
                >
                  {c}
                </Chip>
              ))}
            </div>

            <div className="mt-2">
              <Input
                placeholder="Or type a color (e.g. black)"
                value={draft.categorySpecific.color || ""}
                onChange={(e) =>
                  setDraft((s) => ({
                    ...s,
                    categorySpecific: { ...s.categorySpecific, color: e.target.value || null },
                  }))
                }
              />
            </div>
          </div>

          <div className="mt-4">
            <p className="text-xs font-extrabold text-biz-ink">Size</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(fashionFacets?.sizes || []).slice(0, 16).map((z) => (
                <Chip
                  key={z}
                  active={(draft.categorySpecific.size || "").toLowerCase() === z.toLowerCase()}
                  onClick={() =>
                    setDraft((s) => ({
                      ...s,
                      categorySpecific: {
                        ...s.categorySpecific,
                        size: (s.categorySpecific.size || "").toLowerCase() === z.toLowerCase() ? null : z,
                      },
                    }))
                  }
                >
                  {z}
                </Chip>
              ))}
            </div>

            <div className="mt-2">
              <Input
                placeholder="Or type a size (e.g. 42 / XL)"
                value={draft.categorySpecific.size || ""}
                onChange={(e) =>
                  setDraft((s) => ({
                    ...s,
                    categorySpecific: { ...s.categorySpecific, size: e.target.value || null },
                  }))
                }
              />
            </div>
          </div>

          <p className="mt-2 text-[11px] text-biz-muted">
            These filters load based on category. Phones/Services will get their own filters once those attributes are
            stored.
          </p>
        </div>
      ) : null}

      {/* Progressive disclosure */}
      <div className="mt-5">
        <button
          type="button"
          onClick={() => setShowMore((v) => !v)}
          className="w-full rounded-2xl border border-biz-line bg-white p-4 hover:bg-black/[0.02] transition text-left"
        >
          <p className="text-sm font-extrabold text-biz-ink">More filters</p>
          <p className="text-[11px] text-biz-muted mt-1">Seller trust and product status</p>
        </button>
      </div>

      {showMore ? (
        <>
          {/* SELLER TRUST */}
          <div className="mt-4">
            <p className="text-xs font-extrabold text-gray-500 uppercase">Seller trust</p>

            <div className="mt-2">
              <p className="text-xs font-extrabold text-biz-ink">Verification level</p>
              <div className="mt-2 grid grid-cols-1 gap-2">
                {VERIFY_OPTIONS.map((o) => {
                  const active = draft.trust.verification === o.key;
                  return (
                    <button
                      key={o.key}
                      onClick={() =>
                        setDraft((s) => ({
                          ...s,
                          trust: { ...s.trust, verification: o.key },
                        }))
                      }
                      className={
                        active
                          ? "rounded-2xl border border-biz-accent/30 bg-gradient-to-br from-orange-50 to-white p-3 text-left shadow-soft"
                          : "rounded-2xl border border-biz-line bg-white p-3 text-left hover:bg-black/[0.02] transition"
                      }
                    >
                      <p className={active ? "text-sm font-bold text-biz-accent" : "text-sm font-bold text-biz-ink"}>
                        {o.label}
                      </p>
                      <p className="text-[11px] text-biz-muted mt-1">{o.hint}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3">
              <Chip
                active={draft.trust.trustedBadgeOnly}
                onClick={() =>
                  setDraft((s) => ({
                    ...s,
                    trust: { ...s.trust, trustedBadgeOnly: !s.trust.trustedBadgeOnly },
                  }))
                }
              >
                Trusted badge sellers
              </Chip>
              <p className="mt-2 text-[11px] text-biz-muted">This is the trust badge (earned + maintained).</p>
            </div>
          </div>

          {/* PRODUCT STATUS */}
          <div className="mt-4">
            <p className="text-xs font-extrabold text-gray-500 uppercase">Product status</p>

            <div className="mt-2 flex flex-wrap gap-2">
              <Chip
                active={draft.status.onSale}
                onClick={() => setDraft((s) => ({ ...s, status: { ...s.status, onSale: !s.status.onSale } }))}
              >
                On sale
              </Chip>

              <Chip
                active={draft.status.newArrivals}
                onClick={() =>
                  setDraft((s) => ({ ...s, status: { ...s.status, newArrivals: !s.status.newArrivals } }))
                }
              >
                New arrivals
              </Chip>

              <Chip
                active={draft.status.availableNow}
                onClick={() =>
                  setDraft((s) => ({ ...s, status: { ...s.status, availableNow: !s.status.availableNow } }))
                }
              >
                Available now
              </Chip>

              <Chip
                active={draft.status.limitedStock}
                onClick={() =>
                  setDraft((s) => ({ ...s, status: { ...s.status, limitedStock: !s.status.limitedStock } }))
                }
              >
                Limited stock
              </Chip>
            </div>
          </div>
        </>
      ) : null}
    </BottomSheet>
  );
}