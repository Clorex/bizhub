// FILE: src/lib/market/filters/types.ts
import type { MarketCategoryKey } from "@/lib/search/marketTaxonomy";

export type PriceQuickRange = "UNDER_5K" | "5K_20K" | "20K_100K" | "ABOVE_100K";

// ✅ ADDED: "best_match" sort key
export type MarketSortKey =
  | "recommended"
  | "best_match"
  | "latest"
  | "price_asc"
  | "price_desc"
  | "best_selling"
  | "closest";

export type TrustVerificationLevel = "any" | "verified" | "id_verified" | "address_verified";

export type MarketFilterState = {
  category: MarketCategoryKey | null;

  location: {
    state: string | null;
    city: string | null;
  };

  price: {
    min: number | null;
    max: number | null;
    quick: PriceQuickRange | null;
  };

  categorySpecific: {
    color: string | null;
    size: string | null;
  };

  trust: {
    verification: TrustVerificationLevel;
    trustedBadgeOnly: boolean;
  };

  status: {
    onSale: boolean;
    newArrivals: boolean;
    availableNow: boolean;
    limitedStock: boolean;
  };
};

export const DEFAULT_MARKET_FILTERS: MarketFilterState = {
  category: null,
  location: { state: null, city: null },
  price: { min: null, max: null, quick: null },
  categorySpecific: { color: null, size: null },
  trust: { verification: "any", trustedBadgeOnly: false },
  status: { onSale: false, newArrivals: false, availableNow: false, limitedStock: false },
};