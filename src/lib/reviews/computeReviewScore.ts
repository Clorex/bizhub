// FILE: src/lib/reviews/computeReviewScore.ts

/**
 * myBizHub — Compute Vendor Review Summary
 *
 * Reads all active reviews for a vendor, applies decay weighting,
 * computes averages, recovery progress, and trend.
 *
 * Result is stored on the business doc as `reviewSummary`.
 */

import type { VendorReviewSummary } from "./types";
import {
  computeDecayFactor,
  ratingToScore,
  computeRecoveryProgress,
  RECOVERY_POSITIVE_MIN_RATING,
  MIN_REVIEWS_FOR_RANKING,
} from "./config";

type ReviewDoc = {
  id: string;
  rating: number;
  status: string;
  createdAt: any;
};

function toMs(v: any): number {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v === "object") {
    if (typeof v.toMillis === "function") return Number(v.toMillis()) || 0;
    if (typeof v.seconds === "number") return Math.floor(v.seconds * 1000);
  }
  const t = Date.parse(String(v));
  return Number.isFinite(t) ? t : 0;
}

function monthsBetween(msA: number, msB: number): number {
  if (!msA || !msB) return 0;
  const diff = Math.abs(msB - msA);
  return diff / (1000 * 60 * 60 * 24 * 30.44); // average month
}

/**
 * Compute the full review summary for a vendor.
 */
export function computeVendorReviewSummary(
  reviews: ReviewDoc[],
  nowMs: number = Date.now()
): VendorReviewSummary {
  // Filter to active reviews only
  const activeReviews = reviews.filter(
    (r) => r.status === "active" && r.rating >= 1 && r.rating <= 5
  );

  const totalReviews = activeReviews.length;

  if (totalReviews === 0) {
    return {
      averageRating: 0,
      rawAverageRating: 0,
      totalReviews: 0,
      ratingScore: 0,
      appealCount: 0,
      recoveryProgress: 0,
      recentTrend: "stable",
      computedAtMs: nowMs,
    };
  }

  // ── Raw average (unweighted) ──
  const rawSum = activeReviews.reduce((s, r) => s + r.rating, 0);
  const rawAverageRating = Math.round((rawSum / totalReviews) * 100) / 100;

  // ── Weighted average (with decay) ──
  let weightedSum = 0;
  let weightTotal = 0;

  for (const r of activeReviews) {
    const createdMs = toMs(r.createdAt);
    const months = monthsBetween(createdMs, nowMs);
    const weight = computeDecayFactor(months);

    weightedSum += r.rating * weight;
    weightTotal += weight;
  }

  const averageRating =
    weightTotal > 0
      ? Math.round((weightedSum / weightTotal) * 100) / 100
      : rawAverageRating;

  // ── Rating score for SmartMatch ──
  // Only apply if minimum review count is met
  const ratingScore =
    totalReviews >= MIN_REVIEWS_FOR_RANKING ? ratingToScore(averageRating) : 0;

  // ── Recovery progress ──
  // Count consecutive positive reviews from most recent
  const sorted = [...activeReviews].sort((a, b) => {
    const aMs = toMs(a.createdAt);
    const bMs = toMs(b.createdAt);
    return bMs - aMs; // newest first
  });

  let consecutivePositive = 0;
  for (const r of sorted) {
    if (r.rating >= RECOVERY_POSITIVE_MIN_RATING) {
      consecutivePositive++;
    } else {
      break; // streak broken
    }
  }

  const recoveryProgress = computeRecoveryProgress(consecutivePositive);

  // ── Recent trend ──
  // Compare last 5 reviews average vs previous 5
  const recentSlice = sorted.slice(0, 5);
  const previousSlice = sorted.slice(5, 10);

  let recentTrend: "improving" | "stable" | "declining" = "stable";

  if (recentSlice.length >= 3 && previousSlice.length >= 3) {
    const recentAvg =
      recentSlice.reduce((s, r) => s + r.rating, 0) / recentSlice.length;
    const previousAvg =
      previousSlice.reduce((s, r) => s + r.rating, 0) / previousSlice.length;

    const diff = recentAvg - previousAvg;

    if (diff >= 0.5) {
      recentTrend = "improving";
    } else if (diff <= -0.5) {
      recentTrend = "declining";
    }
  } else if (recentSlice.length >= 3) {
    // Not enough history to compare — check if recent is positive
    const recentAvg =
      recentSlice.reduce((s, r) => s + r.rating, 0) / recentSlice.length;
    if (recentAvg >= 4.0) {
      recentTrend = "improving";
    } else if (recentAvg < 3.0) {
      recentTrend = "declining";
    }
  }

  return {
    averageRating,
    rawAverageRating,
    totalReviews,
    ratingScore,
    appealCount: 0, // set by caller
    recoveryProgress,
    recentTrend,
    computedAtMs: nowMs,
  };
}