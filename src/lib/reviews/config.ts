// FILE: src/lib/reviews/config.ts

/**
 * myBizHub — Review System Configuration
 *
 * All thresholds, weights, and rules in one place.
 * Admin-adjustable values can later be moved to Firestore.
 */

/* ------------------------------------------------------------------ */
/*  Rating → SmartMatch Score Conversion                              */
/* ------------------------------------------------------------------ */

export type RatingBand = {
  min: number;
  max: number;
  score: number;
  label: string;
};

export const RATING_BANDS: RatingBand[] = [
  { min: 5.0, max: 5.0, score: 20, label: "Excellent" },
  { min: 4.5, max: 4.99, score: 16, label: "Very Good" },
  { min: 4.0, max: 4.49, score: 12, label: "Good" },
  { min: 3.5, max: 3.99, score: 6, label: "Fair" },
  { min: 3.0, max: 3.49, score: 0, label: "Average" },
  { min: 0, max: 2.99, score: -10, label: "Poor" },
];

/**
 * Convert average rating to SmartMatch score points.
 */
export function ratingToScore(avgRating: number): number {
  for (const band of RATING_BANDS) {
    if (avgRating >= band.min && avgRating <= band.max) {
      return band.score;
    }
  }
  return 0;
}

/**
 * Get the label for a rating band.
 */
export function ratingToLabel(avgRating: number): string {
  for (const band of RATING_BANDS) {
    if (avgRating >= band.min && avgRating <= band.max) {
      return band.label;
    }
  }
  return "No Rating";
}

/* ------------------------------------------------------------------ */
/*  Review Eligibility & Rules                                        */
/* ------------------------------------------------------------------ */

/** Minimum reviews before rating affects SmartMatch ranking */
export const MIN_REVIEWS_FOR_RANKING = 5;

/** Maximum comment length (characters) */
export const MAX_COMMENT_LENGTH = 500;

/** Minimum comment length if provided (characters) */
export const MIN_COMMENT_LENGTH = 10;

/** Hours after delivery before review prompt */
export const REVIEW_PROMPT_DELAY_HOURS = 0;

/** Hours after delivery to send reminder if not reviewed */
export const REVIEW_REMINDER_HOURS = 24;

/** Maximum days after delivery a buyer can still leave a review */
export const REVIEW_WINDOW_DAYS = 30;

/* ------------------------------------------------------------------ */
/*  Review Weight Decay                                               */
/* ------------------------------------------------------------------ */

/** Maximum age in months before decay reaches minimum */
export const DECAY_MAX_MONTHS = 24;

/** Minimum weight factor (never goes below this) */
export const DECAY_MIN_WEIGHT = 0.5;

/**
 * Compute decay weight factor based on review age in months.
 *
 * Formula: max(0.5, 1 - (months / 24))
 * - 0 months → 1.0 (full weight)
 * - 12 months → 0.5
 * - 24+ months → 0.5 (minimum)
 */
export function computeDecayFactor(monthsSinceReview: number): number {
  if (monthsSinceReview <= 0) return 1.0;
  const factor = 1 - monthsSinceReview / DECAY_MAX_MONTHS;
  return Math.max(DECAY_MIN_WEIGHT, Math.round(factor * 100) / 100);
}

/* ------------------------------------------------------------------ */
/*  Recovery System                                                   */
/* ------------------------------------------------------------------ */

/** Consecutive positive reviews (≥4 stars) to begin recovery */
export const RECOVERY_PARTIAL_THRESHOLD = 5;

/** Consecutive positive reviews (≥4 stars) for full recovery */
export const RECOVERY_FULL_THRESHOLD = 10;

/** Minimum rating to count as "positive" for recovery */
export const RECOVERY_POSITIVE_MIN_RATING = 4;

/**
 * Compute recovery progress percentage.
 */
export function computeRecoveryProgress(
  consecutivePositiveReviews: number
): number {
  if (consecutivePositiveReviews >= RECOVERY_FULL_THRESHOLD) return 100;
  if (consecutivePositiveReviews <= 0) return 0;
  return Math.round(
    (consecutivePositiveReviews / RECOVERY_FULL_THRESHOLD) * 100
  );
}

/* ------------------------------------------------------------------ */
/*  Buyer Abuse Prevention                                            */
/* ------------------------------------------------------------------ */

/** Number of removed reviews before warning */
export const BUYER_WARN_THRESHOLD = 2;

/** Number of removed reviews before suspension */
export const BUYER_SUSPEND_THRESHOLD = 4;

/* ------------------------------------------------------------------ */
/*  Appeal Rules                                                      */
/* ------------------------------------------------------------------ */

/** Valid appeal reasons */
export const APPEAL_REASONS = [
  { key: "abusive_language", label: "Abusive or offensive language" },
  { key: "false_claim", label: "False or misleading claim" },
  { key: "issue_resolved", label: "Issue was already resolved" },
  { key: "buyer_violated_policy", label: "Buyer violated platform policy" },
  { key: "spam_irrelevant", label: "Spam or irrelevant content" },
] as const;

/** Maximum explanation length for appeals */
export const MAX_APPEAL_EXPLANATION_LENGTH = 300;

/** Maximum pending appeals per vendor at one time */
export const MAX_PENDING_APPEALS = 5;

/* ------------------------------------------------------------------ */
/*  Order Status that allows review                                   */
/* ------------------------------------------------------------------ */

/** opsStatus value that means order is complete */
export const REVIEW_ELIGIBLE_OPS_STATUS = "delivered";

/** Alternative: escrow status that means order is complete */
export const REVIEW_ELIGIBLE_ESCROW_STATUS = "released";