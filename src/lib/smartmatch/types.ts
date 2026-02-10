// FILE: src/lib/smartmatch/types.ts

/**
 * SmartMatch — Buyer–Vendor Match & Trust Score System
 *
 * Types for the entire SmartMatch pipeline:
 * 1. Vendor reliability profiles (precomputed)
 * 2. Buyer intent signals (inferred at query time)
 * 3. Match score output (per buyer × product)
 */

/* ------------------------------------------------------------------ */
/*  Vendor Reliability Profile (precomputed, cached on vendor doc)     */
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

  /** Payment methods supported */
  supportsCard: boolean;
  supportsBankTransfer: boolean;
  supportsChat: boolean;

  /** Stock accuracy: ratio of products with accurate stock (0–100) */
  stockAccuracyRate: number;

  /** Average review rating (weighted by decay, 0 = no reviews) */
  averageRating: number;

  /** Total active reviews */
  totalReviews: number;

  /** Rating score for SmartMatch (+20 to -10, 0 if below min reviews) */
  ratingScore: number;

  /** Recent review trend */
  reviewTrend: "improving" | "stable" | "declining";

  /** When this profile was last computed (ms since epoch) */
  computedAtMs: number;

  /** Whether this vendor has been flagged by admin for SmartMatch abuse */
  flagged: boolean;
};

/* ------------------------------------------------------------------ */
/*  Buyer Intent Profile (inferred at query time, not stored)         */
/* ------------------------------------------------------------------ */

export type BuyerIntentProfile = {
  /** Buyer location (from filter selection or account) */
  state: string | null;
  city: string | null;

  /** Selected category */
  category: string | null;

  /** Price range preference */
  priceMin: number | null;
  priceMax: number | null;

  /** Preferred payment method (inferred from past orders) */
  preferredPaymentType: "card" | "bank_transfer" | "chat" | null;

  /** Delivery preference */
  prefersPickup: boolean;
  prefersDelivery: boolean;

  /** Past vendor interactions: businessId → order count */
  vendorHistory: Record<string, number>;

  /** Categories the buyer has purchased from before */
  pastCategories: string[];
};

/* ------------------------------------------------------------------ */
/*  Match Score Output                                                */
/* ------------------------------------------------------------------ */

export type MatchScoreBreakdown = {
  location: number;       // 0–25
  delivery: number;       // 0–15
  reliability: number;    // 0–25
  paymentFit: number;     // 0–10
  vendorQuality: number;  // 0–15
  buyerHistory: number;   // 0–10
  total: number;          // 0–100
};

export type MatchLabel = "best_match" | "recommended" | "fair_match" | "low_match";

export type ProductMatchResult = {
  productId: string;
  businessId: string;
  score: MatchScoreBreakdown;
  label: MatchLabel;
  /** Human-readable explanation for the buyer */
  reason: string;
};

/* ------------------------------------------------------------------ */
/*  Scoring Config (admin-adjustable weights)                         */
/* ------------------------------------------------------------------ */

export type SmartMatchWeights = {
  location: number;       // max points for location match
  delivery: number;       // max points for delivery speed
  reliability: number;    // max points for fulfillment rate
  paymentFit: number;     // max points for payment compatibility
  vendorQuality: number;  // max points for verification + low disputes + stock accuracy + reviews
  buyerHistory: number;   // max points for repeat buyer boost
};

export type SmartMatchConfig = {
  enabled: boolean;
  weights: SmartMatchWeights;
  /** Minimum score to show in results (products below are hidden unless explicitly searched) */
  hideThreshold: number;
  /** Premium vendor bonus points (capped, cannot exceed 100 total) */
  premiumBonus: number;
  /** Premium bonus only applies if score >= this threshold */
  premiumMinScore: number;
  /** Cache TTL in milliseconds for vendor profiles */
  profileCacheTtlMs: number;
  /** Cache TTL in milliseconds for match score results */
  scoreCacheTtlMs: number;
};

/* ------------------------------------------------------------------ */
/*  Factor status for vendor dashboard                                */
/* ------------------------------------------------------------------ */

export type FactorStatus = "good" | "improve" | "bad";

export type VendorMatchInsight = {
  factor: string;
  label: string;
  status: FactorStatus;
  value: string;
  tip: string;
};