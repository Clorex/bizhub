import { NextResponse } from 'next/server';
import { Vendor } from '@/types/vendor';
import { FEATURE_ACCESS } from '@/config/subscription-tiers.config';

/**
 * Check if a vendor has an active paid subscription.
 * 
 * MANDATORY backend enforcement per spec:
 * - is_paid must be true
 * - subscription_expiry must be >= current date
 * 
 * If either fails → 403 Forbidden
 */
export function checkSubscriptionAccess(vendor: Vendor): {
  allowed: boolean;
  reason: string | null;
} {
  // Check 1: is_paid must be true
  if (!vendor.is_paid) {
    return {
      allowed: false,
      reason: 'Subscription required. Please upgrade to access analytics.',
    };
  }

  // Check 2: subscription must not be expired
  const now = new Date();
  const expiry = new Date(vendor.subscription_expiry);

  if (expiry < now) {
    return {
      allowed: false,
      reason: 'Your subscription has expired. Please renew to access analytics.',
    };
  }

  return { allowed: true, reason: null };
}

/**
 * Check if a vendor has access to a specific analytics feature
 * based on their subscription tier.
 */
export function checkFeatureAccess(
  vendor: Vendor,
  feature: string
): { allowed: boolean; reason: string | null } {
  // First check subscription is active
  const subscriptionCheck = checkSubscriptionAccess(vendor);
  if (!subscriptionCheck.allowed) {
    return subscriptionCheck;
  }

  // Then check feature access for tier
  const allowedFeatures = FEATURE_ACCESS[vendor.subscription_tier] || [];

  if (!allowedFeatures.includes(feature)) {
    return {
      allowed: false,
      reason: `This feature requires a higher subscription tier. Current: ${vendor.subscription_tier}`,
    };
  }

  return { allowed: true, reason: null };
}

/**
 * Create a 403 Forbidden response for blocked analytics access.
 */
export function forbiddenResponse(
  reason: string = 'Subscription required'
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: reason,
      cached: false,
    },
    { status: 403 }
  );
}

/**
 * Combined guard: authenticate vendor + check subscription.
 * Use this in API routes for one-line protection.
 */
export async function requirePaidVendor(
  vendor: Vendor | null,
  feature?: string
): Promise<{
  allowed: boolean;
  response: NextResponse | null;
}> {
  // No vendor found
  if (!vendor) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          success: false,
          data: null,
          error: 'Authentication required',
          cached: false,
        },
        { status: 401 }
      ),
    };
  }

  // Check subscription
  if (feature) {
    const featureCheck = checkFeatureAccess(vendor, feature);
    if (!featureCheck.allowed) {
      return {
        allowed: false,
        response: forbiddenResponse(featureCheck.reason!),
      };
    }
  } else {
    const subCheck = checkSubscriptionAccess(vendor);
    if (!subCheck.allowed) {
      return {
        allowed: false,
        response: forbiddenResponse(subCheck.reason!),
      };
    }
  }

  return { allowed: true, response: null };
}

/**
 * Get the number of days remaining on a subscription.
 */
export function getSubscriptionDaysRemaining(vendor: Vendor): number {
  const now = new Date();
  const expiry = new Date(vendor.subscription_expiry);
  const diff = expiry.getTime() - now.getTime();

  if (diff <= 0) return 0;

  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Check if subscription is expiring soon (within 7 days).
 */
export function isSubscriptionExpiringSoon(vendor: Vendor): boolean {
  const daysRemaining = getSubscriptionDaysRemaining(vendor);
  return daysRemaining > 0 && daysRemaining <= 7;
}