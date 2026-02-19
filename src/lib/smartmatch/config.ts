// FILE: src/lib/smartmatch/config.ts
import type { MatchLabel, SmartMatchConfig, SmartMatchWeights } from "./types";

/**
 * ✅ SPEC DEFAULT WEIGHTS (sum = 100)
 * match_score =
 * (0.30 × category_match) +
 * (0.20 × location_proximity) +
 * (0.20 × reliability_score) +
 * (0.15 × activity_score) +
 * (0.15 × customer_rating_score)
 */
export const DEFAULT_WEIGHTS: SmartMatchWeights = {
  categoryMatch: 30,
  locationProximity: 20,
  reliabilityScore: 20,
  activityScore: 15,
  customerRatingScore: 15,
};

export const DEFAULT_CONFIG: SmartMatchConfig = {
  enabled: true,
  weights: DEFAULT_WEIGHTS,

  // Keep your existing concept (auto-hide low scoring matches)
  hideThreshold: 0,

  // Optional monetization behavior (set to 0 to disable bonus)
  premiumBonus: 0,
  premiumMinScore: 70,

  // caches
  profileCacheTtlMs: 30 * 60 * 1000, // 30 min
  scoreCacheTtlMs: 5 * 60 * 1000,    // 5 min
};

/**
 * Kept for compatibility (other parts of your code may import these).
 * They are not used by the new spec scorer directly, but keeping them avoids breakage.
 */
export const DELIVERY_THRESHOLDS = {
  fast: 24,
  moderate: 72,
  slow: 168,
};

export const FULFILLMENT_THRESHOLDS = {
  excellent: 95,
  good: 85,
  fair: 70,
};

export const DISPUTE_THRESHOLDS = {
  excellent: 2,     // <2%
  acceptable: 5,    // <5%
};

export function scoreToLabel(total: number): MatchLabel {
  const t = Number(total || 0);
  if (t >= 85) return "best_match";
  if (t >= 70) return "recommended";
  if (t >= 50) return "fair_match";
  return "low_match";
}
