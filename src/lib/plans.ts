export type PlanKey = "FREE" | "STARTER" | "PRO" | "GROWTH";
export type BillingCycle = "quarterly" | "biannually" | "yearly";

export const PLANS: Record<PlanKey, any> = {
  FREE: {
    name: "Free",
    hasTrial: true,
    trialDays: 14,
    price: { quarterly: 0, biannually: 0, yearly: 0 },
    features: {
      basicStorefront: true,
      listProducts: true,
      recordSalesOrders: true,
      invoicesReceipts: true,
      basicRecords: true,
      customization: "limited",
      analytics: "limited",
    },
  },
  STARTER: {
    name: "Starter",
    price: { quarterly: 15000, biannually: 28000, yearly: 55000 },
    features: {
      personalWebsite: true,
      domain: "purchased-separately",
      unlimitedProducts: true,
      messagingCreditsPerMonth: 100,
      unlimitedInvoicesReceipts: true,
      customerGroups: 5,
      customization: "full",
      analytics: "simple",
      shipbubbleFezApi: "yearly-only",
    },
  },
  PRO: {
    name: "Pro",
    price: { quarterly: 30000, biannually: 55000, yearly: 105000 },
    features: {
      freeComNgDomain: "yearly-only",
      messagingCreditsPerMonth: 200,
      customerGroups: 20,
      analytics: "advanced",
      compareAnalytics: true,
      staffAccounts: 3,
      shipbubbleFezApi: "flexible",
      automatedShippingTools: true,
    },
  },
  GROWTH: {
    name: "Growth",
    price: { quarterly: null, biannually: 150000, yearly: 250000 },
    features: {
      freeComNgDomain: true,
      messagingCreditsPerMonth: 1000,
      customerGroups: 100,
      staffAccounts: 5,
      pos: true,
      locations: 2,
      multiCurrency: true,
      assistedOnboarding: true,
    },
  },
};