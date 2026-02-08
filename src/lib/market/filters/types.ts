// FILE: src/lib/market/filters/types.ts
import type { MarketCategoryKey } from "@/lib/search/marketTaxonomy";

export type PriceQuickRange = "UNDER_5K" | "5K_20K" | "20K_100K" | "ABOVE_100K";

export type MarketSortKey =
  | "recommended"
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
    // V1: Fashion only (because only attrs.colors/sizes exist today)
    color: string | null;
    size: string | null;
  };

  trust: {
    verification: TrustVerificationLevel;
    trustedBadgeOnly: boolean; // apexBadgeActive
  };

  status: {
    onSale: boolean;
    newArrivals: boolean; // last N days (we'll use 7 in V1)
    availableNow: boolean; // in stock (products) / available (services)
    limitedStock: boolean; // stock <= 3
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