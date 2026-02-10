// FILE: src/lib/smartmatch/buyerIntent.ts

import type { BuyerIntentProfile } from "./types";
import type { MarketFilterState } from "@/lib/market/filters/types";

/**
 * Build a BuyerIntentProfile from available signals.
 *
 * Phase 1: Uses filter state + optional order history.
 * Phase 2: Will add session tracking, past searches, etc.
 */
export function buildBuyerIntent(args: {
  filters: MarketFilterState;
  /** Past orders for this buyer: { businessId, paymentType, categoryKeys }[] */
  orderHistory?: Array<{
    businessId: string;
    paymentType?: string;
    categoryKeys?: string[];
  }>;
}): BuyerIntentProfile {
  const { filters, orderHistory = [] } = args;

  // --- Location from filters ---
  const state = filters.location.state || null;
  const city = filters.location.city || null;

  // --- Category ---
  const category = filters.category || null;

  // --- Price range ---
  const priceMin = filters.price.min ?? null;
  const priceMax = filters.price.max ?? null;

  // --- Payment preference (inferred from past orders) ---
  let preferredPaymentType: BuyerIntentProfile["preferredPaymentType"] = null;
  if (orderHistory.length > 0) {
    const typeCounts: Record<string, number> = {};
    for (const o of orderHistory) {
      const t = String(o.paymentType || "");
      if (t === "paystack_escrow" || t === "flutterwave") {
        typeCounts["card"] = (typeCounts["card"] || 0) + 1;
      } else if (t === "direct_transfer") {
        typeCounts["bank_transfer"] = (typeCounts["bank_transfer"] || 0) + 1;
      } else if (t === "chat_whatsapp") {
        typeCounts["chat"] = (typeCounts["chat"] || 0) + 1;
      }
    }
    const sorted = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      preferredPaymentType = sorted[0][0] as any;
    }
  }

  // --- Vendor history ---
  const vendorHistory: Record<string, number> = {};
  for (const o of orderHistory) {
    if (o.businessId) {
      vendorHistory[o.businessId] = (vendorHistory[o.businessId] || 0) + 1;
    }
  }

  // --- Past categories ---
  const catSet = new Set<string>();
  for (const o of orderHistory) {
    if (Array.isArray(o.categoryKeys)) {
      for (const c of o.categoryKeys) {
        catSet.add(String(c));
      }
    }
  }
  const pastCategories = Array.from(catSet);

  return {
    state,
    city,
    category,
    priceMin,
    priceMax,
    preferredPaymentType,
    prefersPickup: false,   // Phase 2: infer from order history
    prefersDelivery: false,  // Phase 2: infer from order history
    vendorHistory,
    pastCategories,
  };
}