// FILE: src/lib/smartmatch/score.ts
import type {
  BuyerIntentProfile,
  VendorReliabilityProfile,
  MatchScoreBreakdown,
  ProductMatchResult,
  SmartMatchWeights,
} from "./types";
import { DEFAULT_WEIGHTS, scoreToLabel } from "./config";

function clamp100(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function norm(s: any): string {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s>/:-]/g, "")
    .trim();
}

/** category_match (0/60/100). Non-matching categories should be excluded before ranking. */
function scoreCategoryMatch(buyer: BuyerIntentProfile, productCategories?: string[]) {
  const buyerCat = norm(buyer.category);
  const cats = Array.isArray(productCategories) ? productCategories.map(norm).filter(Boolean) : [];

  // If buyer didn't filter category, treat as neutral match
  if (!buyerCat) return { score: 100, excluded: false };

  if (cats.includes(buyerCat)) return { score: 100, excluded: false };

  // "Related": same top-level segment (supports keys like "fashion>shoes" or "fashion/shoes")
  const buyerTop = buyerCat.split(/[>/:-]/)[0]?.trim();
  const related =
    buyerTop &&
    cats.some((c) => {
      const top = c.split(/[>/:-]/)[0]?.trim();
      return top && top === buyerTop;
    });

  if (related) return { score: 60, excluded: false };

  return { score: 0, excluded: true };
}

/**
 * location_proximity (0–100)
 * Same city=100, Same state=70, Nearby state=40, Far=10
 * If nationwide_delivery enabled, allow far but cap at 50 (we treat far-with-nationwide as 50).
 */
function scoreLocationProximity(buyer: BuyerIntentProfile, vendor: VendorReliabilityProfile): number {
  const buyerState = norm(buyer.state);
  const buyerCity = norm(buyer.city);
  const vendorState = norm(vendor.state);
  const vendorCity = norm(vendor.city);

  // If buyer has no location preference, neutral
  if (!buyerState && !buyerCity) return 50;

  if (buyerCity && vendorCity && buyerCity === vendorCity) return 100;

  if (buyerState && vendorState && buyerState === vendorState) return 70;

  // If vendor can deliver nationwide, allow out-of-state with cap 50
  if (vendor.nationwideDelivery && buyerState && vendorState && buyerState !== vendorState) {
    return 50;
  }

  // "Nearby state" — you don’t have state adjacency data yet, so we treat any different state as "nearby"
  if (buyerState && vendorState && buyerState !== vendorState) return 40;

  // Missing vendor location but buyer wants one
  if (!vendorState && !vendorCity) return 10;

  return 10;
}

/**
 * reliability_score (0–100)
 * Derived from fulfillmentRate, disputeRate, verificationTier (+ apexBadge).
 */
function scoreReliabilityScore(vendor: VendorReliabilityProfile): number {
  const orders = vendor.totalCompletedOrders || 0;

  const completion = orders > 0 ? clamp100(vendor.fulfillmentRate) : 50;

  // disputeRate is 0–100, where lower is better → convert to "goodness"
  const disputeGoodness = orders > 0 ? clamp100(100 - (vendor.disputeRate || 0)) : 50;

  let verification = 20;
  if (vendor.apexBadgeActive) verification = 100;
  else if (vendor.verificationTier >= 3) verification = 90;
  else if (vendor.verificationTier >= 2) verification = 70;
  else if (vendor.verificationTier >= 1) verification = 40;

  // Weighted blend (internal)
  const total = Math.round(completion * 0.5 + disputeGoodness * 0.25 + verification * 0.25);
  return clamp100(total);
}

/**
 * activity_score (0–100)
 * Based on recency and optional response time.
 * If you don’t store activity, we return neutral=50.
 */
function scoreActivityScore(vendor: VendorReliabilityProfile): number {
  const now = Date.now();

  // Recency bucket
  let recency = 50;
  const last = vendor.lastActiveAtMs ?? null;
  if (typeof last === "number" && last > 0) {
    const days = (now - last) / (24 * 3600_000);
    if (days <= 1) recency = 100;
    else if (days <= 3) recency = 80;
    else if (days <= 7) recency = 60;
    else if (days <= 14) recency = 40;
    else recency = 20;
  }

  // Response time (optional)
  let response = 50;
  const rt = vendor.responseTimeAvgMin ?? null;
  if (typeof rt === "number" && rt >= 0) {
    if (rt <= 10) response = 100;
    else if (rt <= 60) response = 70;
    else if (rt <= 240) response = 40;
    else response = 20;
  }

  // Blend
  return clamp100(Math.round(recency * 0.7 + response * 0.3));
}

/**
 * customer_rating_score (0–100)
 * averageRating × 20
 * apply confidence threshold (few reviews => pull toward neutral 50)
 */
function scoreCustomerRatingScore(vendor: VendorReliabilityProfile): number {
  const minReviews = 5;

  const avg = Number(vendor.averageRating || 0);
  const count = Number(vendor.totalReviews || 0);

  const base = avg > 0 ? clamp100(avg * 20) : 50;

  if (count <= 0) return 50;

  const conf = Math.max(0, Math.min(1, count / minReviews));
  // confidence smoothing to avoid instant burying / abuse
  const smoothed = Math.round(50 * (1 - conf) + base * conf);

  return clamp100(smoothed);
}

/** Exact formula: sum(weights% * componentScore)/100 */
export function computeMatchScore(args: {
  buyer: BuyerIntentProfile;
  vendor: VendorReliabilityProfile;
  weights?: SmartMatchWeights;
  productCategories?: string[];
  isPremium?: boolean;
  premiumBonus?: number;
  premiumMinScore?: number;
}): MatchScoreBreakdown & { excluded?: boolean } {
  const {
    buyer,
    vendor,
    weights = DEFAULT_WEIGHTS,
    productCategories,
    isPremium = false,
    premiumBonus = 0,
    premiumMinScore = 70,
  } = args;

  const cat = scoreCategoryMatch(buyer, productCategories);
  const categoryMatch = cat.score;

  const locationProximity = scoreLocationProximity(buyer, vendor);
  const reliabilityScore = scoreReliabilityScore(vendor);
  const activityScore = scoreActivityScore(vendor);
  const customerRatingScore = scoreCustomerRatingScore(vendor);

  const sumW =
    weights.categoryMatch +
    weights.locationProximity +
    weights.reliabilityScore +
    weights.activityScore +
    weights.customerRatingScore;

  const denom = sumW > 0 ? sumW : 100;

  let rawTotal = Math.round(
    (weights.categoryMatch * categoryMatch +
      weights.locationProximity * locationProximity +
      weights.reliabilityScore * reliabilityScore +
      weights.activityScore * activityScore +
      weights.customerRatingScore * customerRatingScore) / denom
  );

  // Flagged vendor safeguard (your existing behavior)
  if (vendor.flagged) rawTotal = Math.min(rawTotal, 30);

  // Premium bonus (your existing behavior; set premiumBonus=0 to disable)
  if (isPremium && premiumBonus > 0 && rawTotal >= premiumMinScore && !vendor.flagged) {
    rawTotal = Math.min(100, rawTotal + premiumBonus);
  }

  const total = clamp100(rawTotal);

  return {
    categoryMatch,
    locationProximity,
    reliabilityScore,
    activityScore,
    customerRatingScore,
    total,
    excluded: cat.excluded,
  };
}

export function buildMatchReason(score: MatchScoreBreakdown): string {
  const parts: string[] = [];

  if (score.categoryMatch === 100) parts.push("exact category match");
  else if (score.categoryMatch >= 60) parts.push("related category");

  if (score.locationProximity >= 100) parts.push("same city");
  else if (score.locationProximity >= 70) parts.push("same state");
  else if (score.locationProximity >= 40) parts.push("near your state");

  if (score.reliabilityScore >= 80) parts.push("reliable seller");
  if (score.activityScore >= 80) parts.push("active recently");
  if (score.customerRatingScore >= 80) parts.push("highly rated");

  if (parts.length === 0) return "";
  const joined = parts.join(" · ");
  return joined.charAt(0).toUpperCase() + joined.slice(1);
}

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
  const scoreWithExcluded = computeMatchScore(args);
  const { excluded, ...score } = scoreWithExcluded;

  return {
    productId: args.productId,
    businessId: args.businessId,
    score,
    label: scoreToLabel(score.total),
    reason: buildMatchReason(score),
    excluded: !!excluded,
  };
}