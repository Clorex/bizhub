export type SubscriptionTier = 'basic' | 'premium' | 'pro';

export interface VendorSubscription {
  is_paid: boolean;
  subscription_tier: SubscriptionTier;
  subscription_expiry: Date;
}

export interface SubscriptionStatus {
  is_active: boolean;
  tier: SubscriptionTier;
  expires_at: string;
  days_remaining: number;
}

export interface UpgradeOption {
  tier: SubscriptionTier;
  name: string;
  price: number;
  features: string[];
  is_popular: boolean;
}