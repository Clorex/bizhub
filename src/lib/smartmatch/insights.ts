// FILE: src/lib/smartmatch/insights.ts

import type {
  VendorReliabilityProfile,
  VendorMatchInsight,
  FactorStatus,
} from "./types";
import {
  DELIVERY_THRESHOLDS,
  FULFILLMENT_THRESHOLDS,
  DISPUTE_THRESHOLDS,
} from "./config";

/**
 * Build vendor-facing insights showing what affects their visibility.
 * Used on the vendor dashboard.
 */
export function buildVendorInsights(
  profile: VendorReliabilityProfile
): VendorMatchInsight[] {
  const insights: VendorMatchInsight[] = [];

    // ✅ ADDED: Flagged vendor warning (shown first)
  if (profile.flagged) {
    insights.push({
      factor: "flagged",
      label: "Account Flagged",
      status: "bad",
      value: "Flagged by admin",
      tip: "Your account has been flagged for potential Smart Match abuse. Your visibility is severely reduced. Contact support if you believe this is an error.",
    });
  }
  // --- Fulfillment Rate ---
  {
    let status: FactorStatus;
    let value: string;
    let tip: string;

    if (profile.totalCompletedOrders === 0) {
      status = "improve";
      value = "No orders yet";
      tip = "Complete your first orders to build your fulfillment score.";
    } else if (profile.fulfillmentRate >= FULFILLMENT_THRESHOLDS.excellent) {
      status = "good";
      value = `${profile.fulfillmentRate}%`;
      tip = "Excellent! Keep maintaining this high fulfillment rate.";
    } else if (profile.fulfillmentRate >= FULFILLMENT_THRESHOLDS.good) {
      status = "improve";
      value = `${profile.fulfillmentRate}%`;
      tip = "Good, but aim for 95%+ to rank higher in search results.";
    } else {
      status = "bad";
      value = `${profile.fulfillmentRate}%`;
      tip = "This is hurting your visibility. Fulfill orders promptly and avoid cancellations.";
    }

    insights.push({
      factor: "fulfillment_rate",
      label: "Fulfillment Rate",
      status,
      value,
      tip,
    });
  }

  // --- Delivery Speed ---
  {
    let status: FactorStatus;
    let value: string;
    let tip: string;

    if (profile.avgDeliveryHours <= 0 || profile.totalCompletedOrders === 0) {
      status = "improve";
      value = "No data";
      tip = "Mark orders as delivered to build your delivery speed score.";
    } else if (profile.avgDeliveryHours <= DELIVERY_THRESHOLDS.fast) {
      status = "good";
      value = `~${Math.round(profile.avgDeliveryHours)}h avg`;
      tip = "Great delivery speed! This boosts your visibility significantly.";
    } else if (profile.avgDeliveryHours <= DELIVERY_THRESHOLDS.moderate) {
      status = "improve";
      value = `~${Math.round(profile.avgDeliveryHours)}h avg`;
      tip = "Try to deliver within 24 hours when possible for maximum visibility.";
    } else {
      status = "bad";
      value = `~${Math.round(profile.avgDeliveryHours)}h avg`;
      tip = "Slow delivery reduces your ranking. Ship orders faster.";
    }

    insights.push({
      factor: "delivery_speed",
      label: "Delivery Speed",
      status,
      value,
      tip,
    });
  }

  // --- Dispute Rate ---
  {
    let status: FactorStatus;
    let value: string;
    let tip: string;

    if (profile.totalCompletedOrders === 0) {
      status = "good";
      value = "No disputes";
      tip = "Keep it this way! Low disputes build trust.";
    } else if (profile.disputeRate < DISPUTE_THRESHOLDS.excellent) {
      status = "good";
      value = `${profile.disputeRate}%`;
      tip = "Excellent dispute rate. Buyers trust you.";
    } else if (profile.disputeRate < DISPUTE_THRESHOLDS.acceptable) {
      status = "improve";
      value = `${profile.disputeRate}%`;
      tip = "Try to reduce disputes by communicating clearly with buyers.";
    } else {
      status = "bad";
      value = `${profile.disputeRate}%`;
      tip = "High dispute rate seriously hurts your visibility. Resolve issues proactively.";
    }

    insights.push({
      factor: "dispute_rate",
      label: "Dispute Rate",
      status,
      value,
      tip,
    });
  }

  // --- Verification ---
  {
    let status: FactorStatus;
    let value: string;
    let tip: string;

    if (profile.apexBadgeActive) {
      status = "good";
      value = "Apex verified";
      tip = "Maximum trust level. You rank highest for trust signals.";
    } else if (profile.verificationTier >= 3) {
      status = "good";
      value = "Address verified";
      tip = "Strong verification. Consider earning the Apex badge for even more trust.";
    } else if (profile.verificationTier >= 2) {
      status = "improve";
      value = "ID verified";
      tip = "Verify your address to unlock higher rankings.";
    } else if (profile.verificationTier >= 1) {
      status = "improve";
      value = "Basic verified";
      tip = "Complete ID and address verification to rank higher.";
    } else {
      status = "bad";
      value = "Not verified";
      tip = "Unverified sellers rank lowest. Start verification now.";
    }

    insights.push({
      factor: "verification",
      label: "Verification",
      status,
      value,
      tip,
    });
  }

  // --- Payment Options ---
  {
    const methods: string[] = [];
    if (profile.supportsCard) methods.push("Card");
    if (profile.supportsBankTransfer) methods.push("Bank transfer");
    if (profile.supportsChat) methods.push("Chat");

    let status: FactorStatus;
    let tip: string;

    if (methods.length >= 2) {
      status = "good";
      tip = "Multiple payment options help you match with more buyers.";
    } else if (methods.length === 1) {
      status = "improve";
      tip = "Add more payment options to match with more buyers.";
    } else {
      status = "bad";
      tip = "No payment methods detected. Complete orders to build your payment profile.";
    }

    insights.push({
      factor: "payment_options",
      label: "Payment Options",
      status,
      value: methods.length > 0 ? methods.join(", ") : "None detected",
      tip,
    });
  }

  // --- Stock Accuracy ---
  {
    let status: FactorStatus;
    let value: string;
    let tip: string;

    if (profile.stockAccuracyRate >= 90) {
      status = "good";
      value = `${profile.stockAccuracyRate}%`;
      tip = "Your stock levels are accurate. Buyers see reliable availability.";
    } else if (profile.stockAccuracyRate >= 70) {
      status = "improve";
      value = `${profile.stockAccuracyRate}%`;
      tip = "Update out-of-stock products to improve accuracy.";
    } else {
      status = "bad";
      value = `${profile.stockAccuracyRate}%`;
      tip = "Many products show 0 stock. Update your inventory to avoid ranking penalties.";
    }

    insights.push({
      factor: "stock_accuracy",
      label: "Stock Accuracy",
      status,
      value,
      tip,
    });
  }

  return insights;
}