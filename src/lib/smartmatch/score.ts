// FILE: src/lib/smartmatch/score.ts

import type {
  BuyerIntentProfile,
  VendorReliabilityProfile,
  MatchScoreBreakdown,
  MatchLabel,
  ProductMatchResult,
  SmartMatchWeights,
} from "./types";
import {
  DEFAULT_WEIGHTS,
  DELIVERY_THRESHOLDS,
  FULFILLMENT_THRESHOLDS,
  DISPUTE_THRESHOLDS,
  scoreToLabel,
} from "./config";

function norm(s: any): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}

/* ------------------------------------------------------------------ */
/*  Individual factor scorers                                         */
/* ------------------------------------------------------------------ */

/**
 * Location match: 0 → weights.location
 */
function scoreLocation(
  buyer: BuyerIntentProfile,
  vendor: VendorReliabilityProfile,
  maxPts: number
): number {
  const buyerState = norm(buyer.state);
  const buyerCity = norm(buyer.city);
  const vendorState = norm(vendor.state);
  const vendorCity = norm(vendor.city);

  if (!buyerState && !buyerCity) return Math.round(maxPts * 0.5);

  if (buyerCity && vendorCity && buyerCity === vendorCity) return maxPts;

  if (
    buyerCity &&
    vendorCity &&
    (vendorCity.includes(buyerCity) || buyerCity.includes(vendorCity))
  ) {
    return Math.round(maxPts * 0.85);
  }

  if (buyerState && vendorState && buyerState === vendorState) {
    return Math.round(maxPts * 0.72);
  }

  if (
    buyerState &&
    vendorState &&
    (vendorState.includes(buyerState) || buyerState.includes(vendorState))
  ) {
    return Math.round(maxPts * 0.6);
  }

  if (vendorState) return Math.round(maxPts * 0.4);

  return 0;
}

/**
 * Delivery performance: 0 → weights.delivery
 */
function scoreDelivery(
  vendor: VendorReliabilityProfile,
  maxPts: number
): number {
  const h = vendor.avgDeliveryHours;

  if (!h || h <= 0) return Math.round(maxPts * 0.3);

  if (h <= DELIVERY_THRESHOLDS.fast) return maxPts;
  if (h <= DELIVERY_THRESHOLDS.moderate) return Math.round(maxPts * 0.67);
  if (h <= DELIVERY_THRESHOLDS.slow) return Math.round(maxPts * 0.33);

  return 0;
}

/**
 * Order reliability (fulfillment rate): 0 → weights.reliability
 */
function scoreReliability(
  vendor: VendorReliabilityProfile,
  maxPts: number
): number {
  const rate = vendor.fulfillmentRate;
  const orders = vendor.totalCompletedOrders;

  if (orders === 0) return Math.round(maxPts * 0.4);

  if (rate >= FULFILLMENT_THRESHOLDS.excellent) return maxPts;
  if (rate >= FULFILLMENT_THRESHOLDS.good) return Math.round(maxPts * 0.72);
  if (rate >= FULFILLMENT_THRESHOLDS.fair) return Math.round(maxPts * 0.4);

  return 0;
}

/**
 * Payment compatibility: 0 → weights.paymentFit
 */
function scorePaymentFit(
  buyer: BuyerIntentProfile,
  vendor: VendorReliabilityProfile,
  maxPts: number
): number {
  const pref = buyer.preferredPaymentType;

  if (!pref) return Math.round(maxPts * 0.5);

  if (pref === "card" && vendor.supportsCard) return maxPts;
  if (pref === "bank_transfer" && vendor.supportsBankTransfer) return maxPts;
  if (pref === "chat" && vendor.supportsChat) return maxPts;

  if (vendor.supportsCard || vendor.supportsBankTransfer || vendor.supportsChat) {
    return Math.round(maxPts * 0.5);
  }

  return 0;
}

/**
 * Vendor quality signals: 0 → weights.vendorQuality
 *
 * Breakdown within this bucket:
 * - Verified vendor  → 35% of maxPts
 * - Dispute rate      → 25% of maxPts
 * - Stock accuracy    → 15% of maxPts
 * - Review rating     → 25% of maxPts
 */
function scoreVendorQuality(
  vendor: VendorReliabilityProfile,
  maxPts: number
): number {
  let pts = 0;

  // ── Verification (35% of maxPts) ──
  const verifyMax = Math.round(maxPts * 0.35);
  if (vendor.apexBadgeActive) {
    pts += verifyMax;
  } else if (vendor.verificationTier >= 3) {
    pts += Math.round(verifyMax * 0.9);
  } else if (vendor.verificationTier >= 2) {
    pts += Math.round(verifyMax * 0.7);
  } else if (vendor.verificationTier >= 1) {
    pts += Math.round(verifyMax * 0.5);
  }

  // ── Dispute rate (25% of maxPts) ──
  const disputeMax = Math.round(maxPts * 0.25);
  if (vendor.totalCompletedOrders === 0) {
    pts += Math.round(disputeMax * 0.5);
  } else if (vendor.disputeRate < DISPUTE_THRESHOLDS.excellent) {
    pts += disputeMax;
  } else if (vendor.disputeRate < DISPUTE_THRESHOLDS.acceptable) {
    pts += Math.round(disputeMax * 0.5);
  }

  // ── Stock accuracy (15% of maxPts) ──
  const stockMax = Math.round(maxPts * 0.15);
  if (vendor.stockAccuracyRate >= 90) {
    pts += stockMax;
  } else if (vendor.stockAccuracyRate >= 70) {
    pts += Math.round(stockMax * 0.5);
  }

  // ── Review rating (25% of maxPts) ──
  const reviewMax = Math.round(maxPts * 0.25);
  if (vendor.totalReviews > 0 && vendor.averageRating > 0) {
    if (vendor.averageRating >= 4.5) {
      pts += reviewMax;
    } else if (vendor.averageRating >= 4.0) {
      pts += Math.round(reviewMax * 0.8);
    } else if (vendor.averageRating >= 3.5) {
      pts += Math.round(reviewMax * 0.5);
    } else if (vendor.averageRating >= 3.0) {
      pts += Math.round(reviewMax * 0.25);
    }
    // Below 3.0 → 0 points
  } else {
    // No reviews yet → neutral (40% of review bucket)
    pts += Math.round(reviewMax * 0.4);
  }

  return Math.min(maxPts, pts);
}

/**
 * Buyer history boost: 0 → weights.buyerHistory
 */
function scoreBuyerHistory(
  buyer: BuyerIntentProfile,
  vendor: VendorReliabilityProfile,
  maxPts: number
): number {
  const orderCount = buyer.vendorHistory[vendor.businessId] || 0;

  if (orderCount > 0) return maxPts;

  return 0;
}

/* ------------------------------------------------------------------ */
/*  Main scorer                                                       */
/* ------------------------------------------------------------------ */

/**
 * Compute the match score between a buyer and a vendor.
 */
export function computeMatchScore(args: {
  buyer: BuyerIntentProfile;
  vendor: VendorReliabilityProfile;
  weights?: SmartMatchWeights;
  productCategories?: string[];
  isPremium?: boolean;
  premiumBonus?: number;
  premiumMinScore?: number;
}): MatchScoreBreakdown {
  const {
    buyer,
    vendor,
    weights = DEFAULT_WEIGHTS,
    productCategories,
    isPremium = false,
    premiumBonus = 0,
    premiumMinScore = 70,
  } = args;

  const location = scoreLocation(buyer, vendor, weights.location);
  const delivery = scoreDelivery(vendor, weights.delivery);
  const reliability = scoreReliability(vendor, weights.reliability);
  const paymentFit = scorePaymentFit(buyer, vendor, weights.paymentFit);
  const vendorQuality = scoreVendorQuality(vendor, weights.vendorQuality);

  let buyerHistory = scoreBuyerHistory(buyer, vendor, weights.buyerHistory);

  if (
    buyerHistory === 0 &&
    productCategories?.length &&
    buyer.pastCategories.length > 0
  ) {
    const overlap = productCategories.some((c) =>
      buyer.pastCategories.includes(c)
    );
    if (overlap) {
      buyerHistory = Math.round(weights.buyerHistory * 0.5);
    }
  }

  let rawTotal = location + delivery + reliability + paymentFit + vendorQuality + buyerHistory;

  // ✅ Flagged vendor penalty — hard cap at 30
  if (vendor.flagged) {
    rawTotal = Math.min(rawTotal, 30);
  }

  // Premium bonus (ethical: only if score is already good)
  // ✅ No premium bonus for flagged vendors
  if (isPremium && premiumBonus > 0 && rawTotal >= premiumMinScore && !vendor.flagged) {
    rawTotal = Math.min(100, rawTotal + premiumBonus);
  }

  const total = Math.max(0, Math.min(100, rawTotal));

  return {
    location,
    delivery,
    reliability,
    paymentFit,
    vendorQuality,
    buyerHistory,
    total,
  };
}

/**
 * Build a human-readable reason string for a match score.
 */
export function buildMatchReason(
  score: MatchScoreBreakdown,
  vendor: VendorReliabilityProfile,
  weights: SmartMatchWeights = DEFAULT_WEIGHTS
): string {
  const parts: string[] = [];

  // Location
  if (score.location >= weights.location * 0.8) {
    parts.push("near you");
  } else if (score.location >= weights.location * 0.6) {
    parts.push("in your state");
  }

  // Delivery
  if (score.delivery >= weights.delivery * 0.8) {
    parts.push("delivers fast");
  }

  // Reliability
  if (vendor.totalCompletedOrders > 0 && vendor.fulfillmentRate >= 90) {
    parts.push(`${vendor.fulfillmentRate}% fulfillment rate`);
  }

  // Quality
  if (vendor.apexBadgeActive) {
    parts.push("trusted vendor");
  } else if (vendor.isVerified) {
    parts.push("verified seller");
  }

  // Low disputes
  if (
    vendor.totalCompletedOrders >= 5 &&
    vendor.disputeRate < DISPUTE_THRESHOLDS.excellent
  ) {
    parts.push("low dispute rate");
  }

  // ✅ Review rating
  if (vendor.totalReviews >= 5 && vendor.averageRating >= 4.0) {
    parts.push(`${vendor.averageRating.toFixed(1)}★ rating`);
  }

  // Buyer history
  if (score.buyerHistory >= weights.buyerHistory * 0.8) {
    parts.push("you've ordered here before");
  }

  if (parts.length === 0) return "";

  const joined = parts.join(" · ");
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

/**
 * Build a full ProductMatchResult.
 */
export function buildProductMatchResult(args: {
  productId: string;
  businessId: string;
  buyer: BuyerIntentProfile;
  vendor: VendorReliabilityProfile;
  weights?: SmartMatchWeights;
  productCategories?: string[];
  isPremium?: boolean;
  premiumBonus?: number;
  premiumMinScore?: number;
}): ProductMatchResult {
  const score = computeMatchScore(args);
  const label = scoreToLabel(score.total);
  const reason = buildMatchReason(score, args.vendor, args.weights);

  return {
    productId: args.productId,
    businessId: args.businessId,
    score,
    label,
    reason,
  };
}