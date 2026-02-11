import { BASE_URL } from '../setup';
import {
  checkSubscriptionAccess,
  getSubscriptionDaysRemaining,
  isSubscriptionExpiringSoon,
} from '@/lib/auth/subscription-guard';
import { Vendor } from '@/types/vendor';

function createVendor(overrides: Partial<Vendor> = {}): Vendor {
  return {
    id: 'test-vendor-1',
    name: 'Test Vendor',
    email: 'test@bizhub.com',
    store_name: 'Test Store',
    is_paid: true,
    subscription_tier: 'premium',
    subscription_expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  };
}

describe('checkSubscriptionAccess', () => {
  it('should allow paid vendor with valid subscription', () => {
    const vendor = createVendor();
    const result = checkSubscriptionAccess(vendor);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeNull();
  });

  it('should block unpaid vendor', () => {
    const vendor = createVendor({ is_paid: false });
    const result = checkSubscriptionAccess(vendor);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Subscription required');
  });

  it('should block expired subscription', () => {
    const vendor = createVendor({
      subscription_expiry: new Date('2020-01-01'),
    });
    const result = checkSubscriptionAccess(vendor);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('expired');
  });

  it('should block vendor with is_paid=false even if not expired', () => {
    const vendor = createVendor({
      is_paid: false,
      subscription_expiry: new Date(Date.now() + 86400000),
    });
    const result = checkSubscriptionAccess(vendor);
    expect(result.allowed).toBe(false);
  });
});

describe('getSubscriptionDaysRemaining', () => {
  it('should return positive days for active subscription', () => {
    const vendor = createVendor({
      subscription_expiry: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
    });
    const days = getSubscriptionDaysRemaining(vendor);
    expect(days).toBeGreaterThanOrEqual(9);
    expect(days).toBeLessThanOrEqual(11);
  });

  it('should return 0 for expired subscription', () => {
    const vendor = createVendor({
      subscription_expiry: new Date('2020-01-01'),
    });
    const days = getSubscriptionDaysRemaining(vendor);
    expect(days).toBe(0);
  });
});

describe('isSubscriptionExpiringSoon', () => {
  it('should return true within 7 days', () => {
    const vendor = createVendor({
      subscription_expiry: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
    });
    expect(isSubscriptionExpiringSoon(vendor)).toBe(true);
  });

  it('should return false with 30 days remaining', () => {
    const vendor = createVendor({
      subscription_expiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    expect(isSubscriptionExpiringSoon(vendor)).toBe(false);
  });

  it('should return false for expired subscription', () => {
    const vendor = createVendor({
      subscription_expiry: new Date('2020-01-01'),
    });
    expect(isSubscriptionExpiringSoon(vendor)).toBe(false);
  });
});
export {}
