// FILE: src/lib/smartmatch/types.ts

/* ------------------------------------------------------------------ */
/*  Vendor Reliability Profile (precomputed, cached on business doc)   */
/* ------------------------------------------------------------------ */

export type VendorReliabilityProfile = {
  /** Firestore business doc ID */
  businessId: string;

  /** Percentage of orders fulfilled successfully (0–100) */
  fulfillmentRate: number;

  /** Average delivery time in hours (0 = unknown) */
  avgDeliveryHours: number;

  /** Percentage of orders that resulted in a dispute (0–100) */
  disputeRate: number;

  /** Total completed orders used to compute stats */
  totalCompletedOrders: number;

  /** Total disputes filed against this vendor */
  totalDisputes: number;

  /** Whether vendor is verified (any level) */
  isVerified: boolean;

  /** Verification tier (0=none, 1=basic, 2=ID, 3=address) */
  verificationTier: number;

  /** Whether vendor has apex badge active */
  apexBadgeActive: boolean;

  /** Vendor location */
  state: string;
  city: string;

  /** Payment methods supported (kept for compatibility with existing code) */
  supportsCard: boolean;
  supportsBankTransfer: boolean;
  supportsChat: boolean;

  /** Stock accuracy: ratio of products with accurate stock (0–100) */
  stockAccuracyRate: number;

  /** Average review rating (weighted by decay, 0 = no reviews) */
  averageRating: number;

  /** Total active reviews */
  totalReviews: number;

  /** Rating score (legacy field; ok to keep) */
  ratingScore: number;

  /** Recent review trend */
  reviewTrend: "improving" | "stable" | "declining";

  /** Optional activity signals (if present; otherwise scorer uses neutral defaults) */
  lastActiveAtMs?: number | null;
  responseTimeAvgMin?: number | null;

  /** Optional delivery coverage flag (if present) */
  nationwideDelivery?: boolean;

  /** When this profile was last computed (ms since epoch) */
  computedAtMs: number;

  /** Whether this vendor has been flagged by admin for SmartMatch abuse */
  flagged: boolean;
};

/* ------------------------------------------------------------------ */
/*  Buyer Intent Profile (inferred at query time, not stored)          */
/* ------------------------------------------------------------------ */

export type BuyerIntentProfile = {
  state: string | null;
  city: string | null;

  /** Selected category (from filters) */
  category: string | null;

  priceMin: number | null;
  priceMax: number | null;

  preferredPaymentType: "card" | "bank_transfer" | "chat" | null;

  prefersPickup: boolean;
  prefersDelivery: boolean;

  vendorHistory: Record<string, number>;
  pastCategories: string[];
};

/* ------------------------------------------------------------------ */
/*  Match Score Output (SPEC: normalized 0–100 components)             */
/* ------------------------------------------------------------------ */

export type MatchScoreBreakdown = {
  categoryMatch: number;        // 0–100
  locationProximity: number;    // 0–100
  reliabilityScore: number;     // 0–100
  activityScore: number;        // 0–100
  customerRatingScore: number;  // 0–100
  total: number;                // 0–100
};

export type MatchLabel = "best_match" | "recommended" | "fair_match" | "low_match";

export type ProductMatchResult = {
  productId: string;
  businessId: string;
  score: MatchScoreBreakdown;
  label: MatchLabel;
  reason: string;
  excluded?: boolean;
};

/* ------------------------------------------------------------------ */
/*  Scoring Config (admin-adjustable weights)                          */
/* ------------------------------------------------------------------ */

/** weights are percentages that should sum to 100 */
export type SmartMatchWeights = {
  categoryMatch: number;        // default 30
  locationProximity: number;    // default 20
  reliabilityScore: number;     // default 20
  activityScore: number;        // default 15
  customerRatingScore: number;  // default 15
};

export type SmartMatchConfig = {
  enabled: boolean;
  weights: SmartMatchWeights;

  /** Minimum score to show in results */
  hideThreshold: number;

  premiumBonus: number;
  premiumMinScore: number;

  profileCacheTtlMs: number;
  scoreCacheTtlMs: number;
};

/* ------------------------------------------------------------------ */
/*  Vendor dashboard insights                                          */
/* ------------------------------------------------------------------ */
export type FactorStatus = "good" | "improve" | "bad";

export type VendorMatchInsight = {
  factor: string;
  label: string;
  status: FactorStatus;
  value: string;
  tip: string;
};
