// FILE: src/lib/smartmatch/vendorProfile.ts

import type { VendorReliabilityProfile } from "./types";

/**
 * Compute a VendorReliabilityProfile from raw Firestore data.
 *
 * This runs server-side (in an API route or cron job).
 * It reads from orders + disputes + business doc to build the profile.
 *
 * The result is stored on the business doc as `smartMatch.profile`
 * for fast client-side reads.
 */

type OrderDoc = {
  id: string;
  businessId: string;
  orderStatus?: string;
  opsStatus?: string;
  paymentStatus?: string;
  paymentType?: string;
  escrowStatus?: string;
  createdAt?: any;
  createdAtMs?: number;
  updatedAt?: any;
  updatedAtMs?: number;
  deliveredAtMs?: number;
  deliveryDurationHours?: number;
};

type DisputeDoc = {
  id: string;
  orderId: string;
  businessId?: string;
  status?: string;
};

type BusinessDoc = {
  id: string;
  slug?: string;
  name?: string;
  state?: string;
  city?: string;
  whatsapp?: string;
  verificationTier?: number;
  apexBadgeActive?: boolean;
  continueInChatEnabled?: boolean;
  subscription?: {
    planKey?: string;
    expiresAtMs?: number;
  };
  // ✅ Review summary from business doc
  reviewSummary?: {
    averageRating: number;
    totalReviews: number;
    ratingScore: number;
    recentTrend: "improving" | "stable" | "declining";
  } | null;
};

type ProductDoc = {
  id: string;
  businessId: string;
  stock?: number;
  listingType?: string;
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

/**
 * Determine if an order counts as "completed/fulfilled".
 */
function isOrderFulfilled(o: OrderDoc): boolean {
  const status = String(o.orderStatus || o.opsStatus || "").toLowerCase();
  const escrow = String(o.escrowStatus || "").toLowerCase();

  const fulfilledStatuses = [
    "released_to_vendor_wallet",
    "delivered",
    "completed",
    "fulfilled",
    "paid",
  ];
  const fulfilledEscrow = ["released"];

  return (
    fulfilledStatuses.includes(status) || fulfilledEscrow.includes(escrow)
  );
}

/**
 * Determine if an order counts as "attempted" (i.e., was a real order).
 * Excludes cancelled-before-payment, etc.
 */
function isOrderAttempted(o: OrderDoc): boolean {
  const status = String(o.orderStatus || o.opsStatus || "").toLowerCase();

  const excludeStatuses = ["draft", "abandoned", "expired"];
  if (excludeStatuses.includes(status)) return false;

  return true;
}

/**
 * Estimate delivery duration in hours from order data.
 */
function estimateDeliveryHours(o: OrderDoc): number | null {
  if (typeof o.deliveryDurationHours === "number" && o.deliveryDurationHours > 0) {
    return o.deliveryDurationHours;
  }

  if (o.deliveredAtMs) {
    const created = toMs(o.createdAt) || o.createdAtMs || 0;
    if (created > 0 && o.deliveredAtMs > created) {
      return (o.deliveredAtMs - created) / (1000 * 60 * 60);
    }
  }

  return null;
}

/**
 * Compute the vendor reliability profile from raw data.
 */
export function computeVendorProfile(args: {
  business: BusinessDoc;
  orders: OrderDoc[];
  disputes: DisputeDoc[];
  products: ProductDoc[];
}): VendorReliabilityProfile {
  const { business, orders, disputes, products } = args;

  // --- Order stats ---
  const attemptedOrders = orders.filter(isOrderAttempted);
  const fulfilledOrders = attemptedOrders.filter(isOrderFulfilled);

  const totalAttempted = attemptedOrders.length;
  const totalFulfilled = fulfilledOrders.length;

  const fulfillmentRate =
    totalAttempted > 0
      ? Math.round((totalFulfilled / totalAttempted) * 100)
      : 0;

  // --- Delivery speed ---
  const deliveryHours: number[] = [];
  for (const o of fulfilledOrders) {
    const h = estimateDeliveryHours(o);
    if (h !== null && h > 0 && h < 720) {
      deliveryHours.push(h);
    }
  }

  const avgDeliveryHours =
    deliveryHours.length > 0
      ? Math.round(
          deliveryHours.reduce((s, h) => s + h, 0) / deliveryHours.length
        )
      : 0;

  // --- Dispute stats ---
  const vendorDisputes = disputes.filter(
    (d) => String(d.businessId || "") === business.id
  );
  const totalDisputes = vendorDisputes.length;
  const disputeRate =
    totalAttempted > 0
      ? Math.round((totalDisputes / totalAttempted) * 100 * 10) / 10
      : 0;

  // --- Verification ---
  const verificationTier = Number(business.verificationTier || 0);
  const isVerified = verificationTier >= 1;
  const apexBadgeActive = business.apexBadgeActive === true;

  // --- Location ---
  const state = String(business.state || "").trim();
  const city = String(business.city || "").trim();

  // --- Payment methods ---
  const hasActiveSubscription = !!(
    business.subscription?.planKey &&
    Number(business.subscription?.expiresAtMs || 0) > Date.now()
  );

  const paymentTypes = new Set(
    orders.map((o) => String(o.paymentType || "")).filter(Boolean)
  );

  const supportsCard =
    paymentTypes.has("paystack_escrow") || paymentTypes.has("flutterwave");
  const supportsBankTransfer = paymentTypes.has("direct_transfer");
  const supportsChat =
    business.continueInChatEnabled === true && hasActiveSubscription;

  // --- Stock accuracy ---
  const physicalProducts = products.filter(
    (p) => String(p.listingType || "product") === "product"
  );
  const productsWithStock = physicalProducts.filter(
    (p) => Number(p.stock ?? 0) > 0
  );
  const stockAccuracyRate =
    physicalProducts.length > 0
      ? Math.round((productsWithStock.length / physicalProducts.length) * 100)
      : 100;

  // --- Review data (from precomputed reviewSummary on business doc) ---
  const reviewSummary = business.reviewSummary;
  const averageRating = reviewSummary?.averageRating ?? 0;
  const totalReviews = reviewSummary?.totalReviews ?? 0;
  const ratingScore = reviewSummary?.ratingScore ?? 0;
  const reviewTrend = reviewSummary?.recentTrend ?? "stable";

  return {
    businessId: business.id,
    fulfillmentRate,
    avgDeliveryHours,
    disputeRate,
    totalCompletedOrders: totalFulfilled,
    totalDisputes,
    isVerified,
    verificationTier,
    apexBadgeActive,
    state,
    city,
    supportsCard,
    supportsBankTransfer,
    supportsChat,
    stockAccuracyRate,

    // ✅ Review fields
    averageRating,
    totalReviews,
    ratingScore,
    reviewTrend,

    computedAtMs: Date.now(),
    flagged: !!(business as any)?.smartMatch?.flagged,
  };
}