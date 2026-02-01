// FILE: src/lib/bizhubPlans.ts
export type BizhubPlanKey = "FREE" | "LAUNCH" | "MOMENTUM" | "APEX";
export type BizhubBillingCycle = "monthly" | "quarterly" | "biannually" | "yearly";

/**
 * Names are intentionally original (not Starter/Pro/Growth).
 * Goal is to match the concept/UX, not copy wording.
 */

export type PlanCatalog = {
  key: BizhubPlanKey;
  name: string;
  tagline: string;

  /** All plans support all cycles per your instruction */
  priceNgn: Record<BizhubBillingCycle, number>;

  limits: {
    maxProducts: number | "unlimited";
  };

  /** Shown on plan card as checkmarks */
  highlights: string[];

  /** Summary tab: Plan Benefits */
  benefits: Record<string, string[]>; // category -> items

  /** Summary tab: Plan Purchases */
  purchases: Record<string, string[]>; // category -> items
};

export const BIZHUB_PLANS: Record<BizhubPlanKey, PlanCatalog> = {
  FREE: {
    key: "FREE",
    name: "Free",
    tagline: "Basics to get started.",
    priceNgn: { monthly: 0, quarterly: 0, biannually: 0, yearly: 0 },
    limits: { maxProducts: 20 },
    highlights: ["Up to 20 products", "Paystack escrow checkout", "Direct bank transfer orders", "Basic storefront"],
    benefits: {
      "Sell online": ["Public store link", "Product pages", "Cart + checkout gating (login at checkout)"],
      Products: ["Up to 20 products", "Images + variations (display-only)"],
      Orders: ["Order tracking on this device", "Vendor order list"],
      Payments: ["Paystack escrow payments", "Direct transfer orders"],
    },
    purchases: {
      "You can still buy": ["Product Boost (₦1,700/day)", "Subscription upgrades"],
    },
  },

  LAUNCH: {
    key: "LAUNCH",
    name: "Launch",
    tagline: "For new sellers ready to look professional.",
    priceNgn: { monthly: 5000, quarterly: 14000, biannually: 27000, yearly: 50000 },
    limits: { maxProducts: "unlimited" },
    highlights: ["Unlimited products", "Better store presentation", "Improved workflows", "Essential insights"],
    benefits: {
      "Sell online": ["Unlimited products", "Cleaner storefront experience"],
      "Store & brand": ["Logo + banner", "Store description + location + socials"],
      Operations: ["Low stock/out of stock signals", "Basic performance overview"],
      Payments: ["Paystack escrow + direct transfer"],
    },
    purchases: {
      "Add-ons": ["Product Boost (₦1,700/day)", "Advanced analytics (coming)"],
    },
  },

  MOMENTUM: {
    key: "MOMENTUM",
    name: "Momentum",
    tagline: "For sellers who want stronger growth tools.",
    priceNgn: { monthly: 10000, quarterly: 28000, biannually: 55000, yearly: 100000 },
    limits: { maxProducts: "unlimited" },
    highlights: ["Unlimited products", "Stronger insights (rolling out)", "Priority growth tools (rolling out)", "More control (rolling out)"],
    benefits: {
      "Sell online": ["Unlimited products", "Stronger store experience"],
      Insights: ["Deeper insights (rolling out)", "Better performance signals (rolling out)"],
      Operations: ["More tools (rolling out)"],
      Payments: ["Paystack escrow + direct transfer"],
    },
    purchases: {
      "Add-ons": ["Product Boost (₦1,700/day)", "Extra tools bundle (coming)"],
    },
  },

  APEX: {
    key: "APEX",
    name: "Apex",
    tagline: "For brands scaling aggressively.",
    priceNgn: { monthly: 25000, quarterly: 70000, biannually: 130000, yearly: 200000 },
    limits: { maxProducts: "unlimited" },
    highlights: ["Unlimited products", "Premium toolkit (rolling out)", "Top insights (rolling out)", "Priority enablement (rolling out)"],
    benefits: {
      Growth: ["Premium growth toolkit (rolling out)", "Highest tier access"],
      Insights: ["Top reporting (rolling out)", "More comparisons (rolling out)"],
      Operations: ["More automation (rolling out)"],
      Payments: ["Paystack escrow + direct transfer"],
    },
    purchases: {
      "Add-ons": ["Product Boost (₦1,700/day)", "Premium tools bundle (coming)"],
    },
  },
};

export function priceKoboFor(planKey: BizhubPlanKey, cycle: BizhubBillingCycle) {
  const ngn = Number(BIZHUB_PLANS[planKey]?.priceNgn?.[cycle] ?? 0);
  if (!Number.isFinite(ngn) || ngn < 0) throw new Error("Invalid plan price");
  return Math.round(ngn * 100);
}

export function computeExpiryMs(cycle: BizhubBillingCycle, startMs = Date.now()) {
  const day = 24 * 60 * 60 * 1000;

  // MVP: approximate by days (later we can do true calendar months)
  const days = cycle === "yearly" ? 365 : cycle === "biannually" ? 182 : cycle === "quarterly" ? 91 : 30;

  return startMs + days * day;
}

export type BusinessTrial = {
  planKey: Exclude<BizhubPlanKey, "FREE">;
  startedAtMs: number;
  endsAtMs: number;
};

export type BusinessSubscription = {
  planKey: Exclude<BizhubPlanKey, "FREE">;
  cycle: BizhubBillingCycle;
  status: "active" | "expired";
  startedAtMs: number;
  expiresAtMs: number;
  lastPaymentReference?: string;
};

export type Entitlement = {
  planKey: BizhubPlanKey;
  source: "trial" | "subscription" | "free";
  expiresAtMs?: number;
};

// NOTE: Trials are deprecated (Batch 10 rule: no time-based free trials).
// Kept only for backwards compatibility with old business docs that may still have `trial`.
export const DEFAULT_TRIAL_DAYS = 0;
/** Deprecated */
export const DEFAULT_TRIAL_PLAN: Exclude<BizhubPlanKey, "FREE"> = "LAUNCH";

export function getEntitlement(params: {
  trial?: Partial<BusinessTrial> | null;
  subscription?: Partial<BusinessSubscription> | null;
}): Entitlement {
  const now = Date.now();

  // ✅ Batch 10 rule: ignore trial entirely (FREE is unlimited time, restricted by planConfig)
  const s = params.subscription;
  if (s?.planKey && Number(s.expiresAtMs || 0) > now) {
    return { planKey: s.planKey as BizhubPlanKey, source: "subscription", expiresAtMs: Number(s.expiresAtMs) };
  }

  return { planKey: "FREE", source: "free" };
}

export function productLimitFor(planKey: BizhubPlanKey): number | "unlimited" {
  return BIZHUB_PLANS[planKey]?.limits?.maxProducts ?? 20;
}