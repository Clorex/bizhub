import { SubscriptionStatus } from '@/types/subscription';
import { Vendor } from '@/types/vendor';
import { VendorRepository } from '@/repositories/vendor.repository';
import {
  checkSubscriptionAccess,
  getSubscriptionDaysRemaining,
  isSubscriptionExpiringSoon,
} from '@/lib/auth/subscription-guard';
import { SUBSCRIPTION_TIERS } from '@/config/subscription-tiers.config';

/**
 * Subscription Service
 * Business logic for vendor subscription management.
 */
export class SubscriptionService {
  /**
   * Get the current subscription status for a vendor.
   */
  static async getSubscriptionStatus(
    vendorId: string
  ): Promise<SubscriptionStatus | null> {
    const vendor = await VendorRepository.findById(vendorId);
    if (!vendor) return null;

    const { allowed } = checkSubscriptionAccess(vendor);
    const daysRemaining = getSubscriptionDaysRemaining(vendor);

    return {
      is_active: allowed,
      tier: vendor.subscription_tier,
      expires_at: vendor.subscription_expiry.toISOString(),
      days_remaining: daysRemaining,
    };
  }

  /**
   * Check if a vendor can access analytics.
   */
  static async canAccessAnalytics(vendorId: string): Promise<{
    allowed: boolean;
    reason: string | null;
    vendor: Vendor | null;
  }> {
    const vendor = await VendorRepository.findById(vendorId);

    if (!vendor) {
      return {
        allowed: false,
        reason: 'Vendor not found',
        vendor: null,
      };
    }

    const { allowed, reason } = checkSubscriptionAccess(vendor);

    return { allowed, reason, vendor };
  }

  /**
   * Upgrade a vendor's subscription.
   * In production, this would integrate with payment processor.
   */
  static async upgradeSubscription(
    vendorId: string,
    tier: string
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    // Validate tier
    const tierConfig = SUBSCRIPTION_TIERS[tier];
    if (!tierConfig) {
      return {
        success: false,
        message: `Invalid subscription tier: ${tier}`,
      };
    }

    // Calculate expiry (30 days from now)
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 30);

    // Update vendor
    const updated = await VendorRepository.updateSubscription(vendorId, {
      is_paid: true,
      subscription_tier: tier,
      subscription_expiry: expiry,
    });

    if (!updated) {
      return {
        success: false,
        message: 'Failed to update subscription',
      };
    }

    return {
      success: true,
      message: `Successfully upgraded to ${tierConfig.name} plan`,
    };
  }

  /**
   * Check if subscription is expiring soon and return warning.
   */
  static async getExpiryWarning(
    vendorId: string
  ): Promise<string | null> {
    const vendor = await VendorRepository.findById(vendorId);
    if (!vendor) return null;

    if (!isSubscriptionExpiringSoon(vendor)) return null;

    const days = getSubscriptionDaysRemaining(vendor);

    if (days === 1) {
      return 'Your subscription expires tomorrow. Renew now to keep access.';
    }

    return `Your subscription expires in ${days} days. Renew to keep access.`;
  }

  /**
   * Get available upgrade options for a vendor.
   */
  static getUpgradeOptions(currentTier: string) {
    const tiers = Object.values(SUBSCRIPTION_TIERS);

    return tiers.map((tier) => ({
      ...tier,
      is_current: tier.tier === currentTier,
      is_upgrade: this.getTierLevel(tier.tier) > this.getTierLevel(currentTier),
    }));
  }

  /**
   * Get numeric level for tier comparison.
   */
  private static getTierLevel(tier: string): number {
    switch (tier) {
      case 'basic':
        return 1;
      case 'premium':
        return 2;
      case 'pro':
        return 3;
      default:
        return 0;
    }
  }
}