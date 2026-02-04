// FILE: src/lib/bizhubPlans.ts

export type BizhubPlanKey = "FREE" | "LAUNCH" | "MOMENTUM" | "APEX";
export type BizhubBillingCycle = "monthly" | "quarterly" | "biannually" | "yearly";

export type PlanCatalog = {
  key: BizhubPlanKey;

  /**
   * IMPORTANT:
   * Internal key stays "FREE", but the display name is "Free access"
   * (as you requested: FREE is not a plan name on the pricing page).
   */
  name: string;

  tagline: string;

  /** Shown on pricing/subscription UI */
  recommendedFor: string;

  /** All plans support all cycles */
  priceNgn: Record<BizhubBillingCycle, number>;

  limits: {
    maxProducts: number | "unlimited";
  };

  /** Short bullets for plan cards */
  highlights: string[];

  /** Longer breakdown */
  benefits: Record<string, string[]>;

  /** Optional add-ons / upgrades (can include “coming soon”) */
  purchases: Record<string, string[]>;
};

const NAIRA = "\u20A6"; // ₦

export const BIZHUB_PLANS: Record<BizhubPlanKey, PlanCatalog> = {
  FREE: {
    key: "FREE",
    name: "Free access",
    tagline: "Starter use to test the app and build trust.",
    recommendedFor: "Trying BizHub and setting up your first products.",
    priceNgn: { monthly: 0, quarterly: 0, biannually: 0, yearly: 0 },
    limits: { maxProducts: 20 },

    highlights: [
      "Up to 20 products",
      "Basic orders",
      "Basic customers",
      "Basic business summary",
    ],

    benefits: {
      "Storefront basics": [
        "Public store link",
        "Product pages",
        "Cart + checkout",
        "Store link sharing",
      ],
      "Sales & orders": [
        "Manual order tracking",
        "Basic order list",
      ],
      Inventory: [
        "Basic stock count",
        "Out-of-stock handling",
      ],
      Customers: [
        "Basic customer list (from orders)",
      ],
      "Business summary": [
        "Simple daily / weekly sales summary (limited)",
      ],
      Support: [
        "Help center access",
      ],
      "Business assistant": [
        "Free business assistant (very limited)",
      ],
      Sales: [
        "Run sales on up to 5 products",
      ],
    },

    purchases: {
      "Optional upgrades": [
        "Upgrade your plan anytime to unlock more tools",
        `Product Boost (${NAIRA}1,700/day)`,
      ],
    },
  },

  LAUNCH: {
    key: "LAUNCH",
    name: "Launch",
    tagline: "For new and growing businesses that want to start properly.",
    recommendedFor: "New and growing businesses (solo sellers and small shops).",
    priceNgn: { monthly: 5000, quarterly: 14000, biannually: 27000, yearly: 50000 },
    limits: { maxProducts: "unlimited" },

    highlights: [
      "Unlimited products",
      "Order progress updates",
      "Stock signals",
      "Sales on up to 30 products",
    ],

    benefits: {
      "Everything in Free access": [
        "Store link sharing",
        "Basic customer list",
      ],

      "Sales & orders": [
        "Unlimited product listing",
        "Order status updates",
        "Order filtering (basic)",
        "Delivery notes per order (if enabled on your plan)",
        "Offline order recording (coming soon)",
      ],

      Payments: [
        "Payment confirmation tracking (coming soon)",
        "Proof-of-payment upload (coming soon)",
        "Pay-on-delivery support (coming soon)",
        "Paystack escrow + bank transfer orders",
      ],

      Inventory: [
        "Stock tracking",
        "Low-stock alerts",
        "Auto-hide out-of-stock items",
      ],

      Customers: [
        "Customer purchase history (basic)",
        "Customer notes (VIP / issue) (coming soon)",
      ],

      "Business tools": [
        "Weekly performance summary",
        "Expense tracking (coming soon)",
        "Profit estimation (coming soon)",
      ],

      Support: [
        "Standard support",
      ],

      Sales: [
        "Run sales on up to 30 products",
      ],
    },

    purchases: {
      "Growth tools": [
        `Product Boost (${NAIRA}1,700/day)`,
        "More growth tools (coming soon)",
      ],
    },
  },

  MOMENTUM: {
    key: "MOMENTUM",
    name: "Momentum",
    tagline: "For businesses that want steady growth and more control.",
    recommendedFor: "Growing businesses with a small team and steady sales.",
    priceNgn: { monthly: 10000, quarterly: 28000, biannually: 55000, yearly: 100000 },
    limits: { maxProducts: "unlimited" },

    highlights: [
      "Everything in Launch",
      "Better sales tools",
      "Deeper insights",
      "Sales on up to 50 products",
    ],

    benefits: {
      "Everything in Launch": [
        "Unlimited products",
        "Order status updates",
        "Stock tracking and alerts",
      ],

      "Better sales tools": [
        "Scheduled sales (set a start time)",
        "Better marketplace visibility for sales (Hot deals)",
        "Run sales on up to 50 products",
      ],

      "Sales control": [
        "Automated order follow-ups (coming soon)",
        "Custom order stages (coming soon)",
        "Failed order detection (coming soon)",
      ],

      "Payments & protection": [
        "Partial payments support (coming soon)",
        "Refund management (coming soon)",
        "Priority dispute review (coming soon)",
      ],

      "Inventory intelligence": [
        "Best-selling product tracking (coming soon)",
        "Dead stock detection (coming soon)",
        "Sales trend per product (coming soon)",
      ],

      "Customer growth": [
        "Repeat-buyer tagging (coming soon)",
        "Re-engagement broadcasts (already available with limits)",
        "Abandoned order recovery (coming soon)",
      ],

      "Business insights": [
        "Monthly business report (coming soon)",
        "Profit trend analysis (coming soon)",
      ],

      "Business assistant": [
        "More daily assistant usage",
        "Advice based on your store data (coming soon)",
        "Customer reply drafting (coming soon)",
      ],

      Support: [
        "Faster support response (coming soon)",
      ],
    },

    purchases: {
      "Growth tools": [
        `Product Boost (${NAIRA}1,700/day)`,
        "Advanced analytics pack (coming soon)",
      ],
    },
  },

  APEX: {
    key: "APEX",
    name: "Apex",
    tagline: "For high-volume and serious businesses.",
    recommendedFor: "Big businesses and brands scaling with higher volume.",
    priceNgn: { monthly: 25000, quarterly: 70000, biannually: 130000, yearly: 200000 },
    limits: { maxProducts: "unlimited" },

    highlights: [
      "Everything in Momentum",
      "Best sales visibility",
      "Advanced automation (coming soon)",
      "Unlimited sales products",
    ],

    benefits: {
      "Everything in Momentum": [
        "Scheduled sales",
        "Hot deals marketplace visibility",
        "Deeper insights (more)",
      ],

      "Better sales tools": [
        "Unlimited sales products",
        "Best marketplace visibility for sales",
        "More control for high-volume sales (coming soon)",
      ],

      "Advanced sales automation": [
        "Automated workflows (coming soon)",
        "High-value order alerts (coming soon)",
        "Bulk order actions (coming soon)",
      ],

      "Advanced payments & trust": [
        "Delivery confirmation system (coming soon)",
        "Buyer reliability indicators (coming soon)",
        "Faster dispute resolution (coming soon)",
      ],

      "Advanced inventory & forecasting": [
        "Smart restock prediction (coming soon)",
        "Seasonal product performance (coming soon)",
        "Supplier tracking (coming soon)",
      ],

      "Advanced customer management": [
        "Customer segmentation (coming soon)",
        "Loyalty and birthday messaging (coming soon)",
        "Customer lifetime value estimation (coming soon)",
      ],

      "Business intelligence": [
        "Business health score (coming soon)",
        "Sales channel comparison (coming soon)",
        "Downloadable detailed reports (coming soon)",
      ],

      "Business assistant": [
        "Highest assistant limits",
        "Smart growth recommendations (coming soon)",
        "Pricing and product strategy help (coming soon)",
      ],

      Support: [
        "Highest priority support (coming soon)",
        "Early access to new features (coming soon)",
      ],
    },

    purchases: {
      "Premium tools": [
        `Product Boost (${NAIRA}1,700/day)`,
        "Premium tools bundle (coming soon)",
      ],
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

// Trials are deprecated; kept only for backwards compatibility.
export const DEFAULT_TRIAL_DAYS = 0;
/** Deprecated */
export const DEFAULT_TRIAL_PLAN: Exclude<BizhubPlanKey, "FREE"> = "LAUNCH";

export function getEntitlement(params: {
  trial?: Partial<BusinessTrial> | null;
  subscription?: Partial<BusinessSubscription> | null;
}): Entitlement {
  const now = Date.now();

  const s = params.subscription;
  if (s?.planKey && Number(s.expiresAtMs || 0) > now) {
    return { planKey: s.planKey as BizhubPlanKey, source: "subscription", expiresAtMs: Number(s.expiresAtMs) };
  }

  return { planKey: "FREE", source: "free" };
}

export function productLimitFor(planKey: BizhubPlanKey): number | "unlimited" {
  return BIZHUB_PLANS[planKey]?.limits?.maxProducts ?? 20;
}