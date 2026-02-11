import { SubscriptionTier } from './subscription';

export interface Vendor {
  id: string;
  name: string;
  email: string;
  store_name: string;
  is_paid: boolean;
  subscription_tier: SubscriptionTier;
  subscription_expiry: Date;
  created_at: Date;
  updated_at: Date;
}

export interface VendorSession {
  vendor_id: string;
  email: string;
  store_name: string;
  is_paid: boolean;
  subscription_tier: SubscriptionTier;
  subscription_expiry: string;
}