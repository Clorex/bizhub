import { UpgradeOption } from '@/types/subscription';

export const SUBSCRIPTION_TIERS: Record<string, UpgradeOption> = {
  basic: {
    tier: 'basic',
    name: 'Basic',
    price: 9.99,
    features: [
      'Sales Growth Analytics',
      'Revenue Breakdown',
      '30-day History',
      'Email Support',
    ],
    is_popular: false,
  },
  premium: {
    tier: 'premium',
    name: 'Premium',
    price: 24.99,
    features: [
      'Everything in Basic',
      'Conversion Analytics',
      'Top Products Ranking',
      'Customer Engagement',
      'Priority Support',
    ],
    is_popular: true,
  },
  pro: {
    tier: 'pro',
    name: 'Pro',
    price: 49.99,
    features: [
      'Everything in Premium',
      'Advanced Insights',
      'Export Reports',
      'API Access',
      'Dedicated Support',
    ],
    is_popular: false,
  },
};

export const FEATURE_ACCESS: Record<string, string[]> = {
  basic: ['sales_growth', 'revenue_breakdown'],
  premium: ['sales_growth', 'revenue_breakdown', 'conversion', 'top_products', 'engagement'],
  pro: ['sales_growth', 'revenue_breakdown', 'conversion', 'top_products', 'engagement', 'export', 'api'],
};

export const FREE_TRIAL_DAYS = 14;