// FILE: src/lib/smartmatch/config.ts

import type { SmartMatchConfig, SmartMatchWeights, MatchLabel } from "./types";

/**
 * Default SmartMatch scoring weights.
 * Total max = 25 + 15 + 25 + 10 + 15 + 10 = 100
 *
 * These can be overridden by admin via Firestore doc `config/smartmatch`.
 */
export const DEFAULT_WEIGHTS: SmartMatchWeights = {
  location: 25,
  delivery: 15,
  reliability: 25,
  paymentFit: 10,
  vendorQuality: 15,
  buyerHistory: 10,
};

export const DEFAULT_CONFIG: SmartMatchConfig = {
  enabled: true,
  weights: DEFAULT_WEIGHTS,
  hideThreshold: 0,       // Phase 1: don't hide anything, just sort
  premiumBonus: 10,
  premiumMinScore: 70,
  profileCacheTtlMs: 30 * 60 * 1000,   // 30 minutes
  scoreCacheTtlMs: 10 * 60 * 1000,     // 10 minutes
};

/**
 * Map a total score (0–100) to a display label.
 */
export function scoreToLabel(total: number): MatchLabel {
  if (total >= 85) return "best_match";
  if (total >= 70) return "recommended";
  if (total >= 50) return "fair_match";
  return "low_match";
}

/**
 * Map a label to display text for the UI.
 */
export function labelToDisplayText(label: MatchLabel): string {
  switch (label) {
    case "best_match":
      return "Best Match";
    case "recommended":
      return "Recommended";
    case "fair_match":
      return "Fair Match";
    case "low_match":
      return "";
  }
}

/**
 * Map a label to badge color classes.
 */
export function labelToColorClasses(label: MatchLabel): {
  bg: string;
  text: string;
  border: string;
} {
  switch (label) {
    case "best_match":
      return {
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        border: "border-emerald-200",
      };
    case "recommended":
      return {
        bg: "bg-blue-50",
        text: "text-blue-700",
        border: "border-blue-200",
      };
    case "fair_match":
      return {
        bg: "bg-amber-50",
        text: "text-amber-700",
        border: "border-amber-200",
      };
    case "low_match":
      return {
        bg: "bg-gray-50",
        text: "text-gray-500",
        border: "border-gray-200",
      };
  }
}

/**
 * Delivery speed thresholds (in hours).
 */
export const DELIVERY_THRESHOLDS = {
  fast: 24,       // ≤ 24h → max points
  moderate: 72,   // ≤ 72h → medium points
  slow: 168,      // ≤ 7 days → low points
} as const;

/**
 * Fulfillment rate thresholds (percentage).
 */
export const FULFILLMENT_THRESHOLDS = {
  excellent: 95,  // ≥ 95% → max points
  good: 90,       // ≥ 90% → good points
  fair: 80,       // ≥ 80% → some points
} as const;

/**
 * Dispute rate thresholds (percentage).
 */
export const DISPUTE_THRESHOLDS = {
  excellent: 2,   // < 2% → max quality points for disputes
  acceptable: 5,  // < 5% → some points
} as const;