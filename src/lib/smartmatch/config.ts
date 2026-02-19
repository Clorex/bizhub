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

  hideThreshold: 0,

  premiumBonus: 0,
  premiumMinScore: 70,

  profileCacheTtlMs: 30 * 60 * 1000, // 30 min
  scoreCacheTtlMs: 5 * 60 * 1000,    // 5 min
};

/**
 * Kept for compatibility with any older imports in the codebase.
 * (Not required by the new spec scorer, but harmless.)
 */
export const DELIVERY_THRESHOLDS = { fast: 24, moderate: 72, slow: 168 };
export const FULFILLMENT_THRESHOLDS = { excellent: 95, good: 85, fair: 70 };
export const DISPUTE_THRESHOLDS = { excellent: 2, acceptable: 5 };

export function scoreToLabel(total: number): MatchLabel {
  const t = Number(total || 0);
  if (t >= 85) return "best_match";
  if (t >= 70) return "recommended";
  if (t >= 50) return "fair_match";
  return "low_match";
}

/** ✅ UI helper used by SmartMatchBadge.tsx */
export function labelToDisplayText(label: MatchLabel): string {
  switch (label) {
    case "best_match":
      return "Best Match";
    case "recommended":
      return "Recommended";
    case "fair_match":
      return "Fair Match";
    case "low_match":
    default:
      return "Low Match";
  }
}

/**
 * ✅ UI helper used by SmartMatchBadge.tsx
 * IMPORTANT: returns an object with bg/text/border (NOT a string).
 */
export function labelToColorClasses(label: MatchLabel): { bg: string; text: string; border: string } {
  switch (label) {
    case "best_match":
      return {
        bg: "bg-emerald-50",
        text: "text-emerald-800",
        border: "border-emerald-200",
      };
    case "recommended":
      return {
        bg: "bg-blue-50",
        text: "text-blue-800",
        border: "border-blue-200",
      };
    case "fair_match":
      return {
        bg: "bg-amber-50",
        text: "text-amber-900",
        border: "border-amber-200",
      };
    case "low_match":
    default:
      return {
        bg: "bg-gray-50",
        text: "text-gray-700",
        border: "border-gray-200",
      };
  }
}
