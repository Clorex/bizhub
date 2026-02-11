/**
 * Analytics Adapter
 * Transforms your existing /api/vendor/analytics response
 * into the shapes expected by the new chart/section components.
 */

import {
  AnalyticsSummary,
  SalesGrowthData,
  RevenueBreakdownData,
  ConversionData,
  TopProductsData,
  TopProduct,
  EngagementData,
  DailySalesPoint,
  ProductRevenue,
} from '@/types/analytics';

/**
 * Your existing API response shape from /api/vendor/analytics
 */
export interface VendorAnalyticsResponse {
  ok: boolean;
  meta: {
    requestedRange: string;
    usedRange: string;
    requestedMonth: string | null;
    usedMonth: string | null;
    notice: string | null;
    access: {
      planKey: string;
      source: string;
      tier: number;
      features: {
        canUseMonthRange: boolean;
        canUseMonthHistory: boolean;
        canUseDeepInsights: boolean;
        canUseAdvanced: boolean;
      };
      entitlementExpiresAtMs: number | null;
    };
    viewer: {
      role: string;
      staffNudgesEnabled: boolean;
      staffPushEnabled: boolean;
    };
    ai: {
      dayKey: string;
    };
  };
  overview: {
    totalRevenue: number;
    orders: number;
    paystackOrders: number;
    directOrders: number;
    chatOrders: number;
    disputedOrders: number;
    awaitingConfirmOrders: number;
    revenueHeld?: number;
    revenueReleased?: number;
    revenueDirect?: number;
    productsSold?: number;
    customers?: number;
    visits?: number;
    leads?: number;
    views?: number;
  };
  chartDays: {
    dayKey: string;
    label: string;
    revenue: number;
  }[];
  todo: {
    outOfStockCount: number;
    lowStockCount: number;
    awaitingConfirmCount: number;
    disputedCount: number;
  };
  insights: {
    aov: number;
    conversionOrders: number;
    leadRate: number;
    bestDay: { dayKey: string; label: string; revenue: number } | null;
    repeatBuyers: number;
    topProducts: {
      productId: string;
      name: string;
      qty: number;
      revenue: number;
    }[];
  } | null;
  comparisons: {
    previousWindow: {
      startMs: number;
      endMs: number;
      revenue: number;
      orders: number;
    };
    deltas: {
      revenueDelta: number;
      revenueDeltaPct: number | null;
      ordersDelta: number;
      ordersDeltaPct: number | null;
    };
  } | null;
  recentOrders: any[];
  checkin: any;
  nudges: any[];
}

// ===========================
// CURRENCY HELPERS
// ===========================
function fmtNaira(n: number): string {
  if (typeof n !== 'number' || isNaN(n)) return '₦0';
  return `₦${n.toLocaleString('en-NG')}`;
}

// ===========================
// INSIGHT GENERATORS (Naira-aware)
// ===========================
function generateSalesInsight(growthPct: number | null, totalRevenue: number): string {
  if (growthPct === null || growthPct === undefined) {
    if (totalRevenue > 0) return 'You are making sales. Upgrade to see growth trends.';
    return 'No sales data yet. Share your store link to start selling.';
  }
  if (growthPct > 20) return 'Your sales are growing strongly. Keep the momentum!';
  if (growthPct >= 0) return 'You are growing steadily. Small improvements add up.';
  if (growthPct >= -10) return 'Slight dip in sales. Try improving product photos or sharing your link more.';
  return 'Sales have declined. Consider running a promotion or updating your product listings.';
}

function generateConversionInsight(rate: number): string {
  if (rate > 0.5) return 'Your store converts visitors very well.';
  if (rate >= 0.2) return 'Your conversion rate is average. Improve product descriptions to boost it.';
  if (rate > 0) return 'Low conversion — try better photos, clearer pricing, or adding more products.';
  return 'No conversions yet. Focus on getting traffic to your store.';
}

function generateEngagementInsight(
  visits: number,
  leads: number,
  orders: number
): string {
  if (visits === 0 && leads === 0) return 'No engagement data yet. Share your store link to start getting visitors.';
  if (visits > 0 && orders === 0) return 'You have visitors but no orders. Review your pricing and product images.';
  if (leads > 0 && orders === 0) return 'Customers are interested but not buying. Follow up with leads quickly.';
  if (visits > 0 && orders > 0) {
    const rate = orders / visits;
    if (rate > 0.3) return 'Strong engagement — visitors are converting to buyers.';
    return 'Moderate engagement. Try improving your store page to convert more visitors.';
  }
  return 'Keep promoting your store to build engagement.';
}

function generateRevenueInsight(
  topProductName: string,
  topProductPct: number
): string {
  if (!topProductName) return 'No revenue data available yet.';
  const rounded = Math.round(topProductPct);
  if (rounded >= 50) return `${topProductName} generates ${rounded}% of your revenue. Consider adding more products to diversify.`;
  return `${topProductName} generates ${rounded}% of your revenue.`;
}

// ===========================
// ADAPTERS
// ===========================

/**
 * Adapt API response → AnalyticsSummary (dashboard card)
 */
export function adaptToSummary(data: VendorAnalyticsResponse): AnalyticsSummary {
  const growthPct = data.comparisons?.deltas?.revenueDeltaPct ?? null;
  const displayPct = growthPct !== null ? Math.round(growthPct * 100) / 100 : 0;

  const dailySales: DailySalesPoint[] = (data.chartDays || []).map((d) => ({
    date: d.dayKey || d.label,
    revenue: Number(d.revenue) || 0,
    orders: 0,
  }));

  return {
    sales_growth_percentage: displayPct,
    daily_sales: dailySales,
    insight: generateSalesInsight(growthPct, data.overview?.totalRevenue || 0),
  };
}

/**
 * Adapt API response → SalesGrowthData (Section 1)
 */
export function adaptToSalesGrowth(data: VendorAnalyticsResponse): SalesGrowthData {
  const currentTotal = data.overview?.totalRevenue || 0;
  const previousTotal = data.comparisons?.previousWindow?.revenue ?? 0;
  const growthPct = data.comparisons?.deltas?.revenueDeltaPct ?? 0;

  const dailySales: DailySalesPoint[] = (data.chartDays || []).map((d) => ({
    date: d.dayKey || d.label,
    revenue: Number(d.revenue) || 0,
    orders: 0,
  }));

  // Find peak day
  let peakDay: DailySalesPoint | null = null;
  if (data.insights?.bestDay) {
    peakDay = {
      date: data.insights.bestDay.dayKey || data.insights.bestDay.label,
      revenue: Number(data.insights.bestDay.revenue) || 0,
      orders: 0,
    };
  } else if (dailySales.length > 0) {
    peakDay = dailySales.reduce((best, day) =>
      day.revenue > (best?.revenue || 0) ? day : best
    , dailySales[0]);
  }

  return {
    current_period_total: currentTotal,
    previous_period_total: previousTotal,
    growth_percentage: growthPct ?? 0,
    daily_sales: dailySales,
    peak_day: peakDay,
    insight: generateSalesInsight(growthPct, currentTotal),
  };
}

/**
 * Adapt API response → RevenueBreakdownData (Section 2)
 */
export function adaptToRevenueBreakdown(data: VendorAnalyticsResponse): RevenueBreakdownData | null {
  if (!data.insights?.topProducts || data.insights.topProducts.length === 0) {
    return null;
  }

  const totalRevenue = data.overview?.totalRevenue || 0;

  const topProducts: ProductRevenue[] = data.insights.topProducts.map((p) => {
    const pct = totalRevenue > 0 ? (p.revenue / totalRevenue) * 100 : 0;
    // Truncate name at 15 characters per spec
    const name = p.name.length > 15 ? p.name.substring(0, 15) + '…' : p.name;
    return {
      product_id: p.productId,
      product_name: name,
      revenue: p.revenue,
      percentage: Math.round(pct * 10) / 10,
    };
  });

  const topProduct = topProducts[0];
  const insight = topProduct
    ? generateRevenueInsight(topProduct.product_name, topProduct.percentage)
    : 'No revenue data available yet.';

  return {
    top_products: topProducts,
    total_revenue: totalRevenue,
    insight,
  };
}

/**
 * Adapt API response → ConversionData (Section 3)
 */
export function adaptToConversion(data: VendorAnalyticsResponse): ConversionData {
  const views = Number(data.overview?.views || data.overview?.visits || 0);
  const leads = Number(data.overview?.leads || 0);
  const orders = Number(data.overview?.orders || 0);

  const conversionRate = data.insights?.conversionOrders ?? (views > 0 ? orders / views : 0);
  const displayRate = Math.round(conversionRate * 10000) / 100; // Convert to percentage

  return {
    profile_views: views,
    product_clicks: leads,
    purchases: orders,
    conversion_rate: displayRate,
    insight: generateConversionInsight(conversionRate),
  };
}

/**
 * Adapt API response → TopProductsData (Section 4)
 */
export function adaptToTopProducts(data: VendorAnalyticsResponse): TopProductsData | null {
  if (!data.insights?.topProducts || data.insights.topProducts.length === 0) {
    return null;
  }

  const products: TopProduct[] = data.insights.topProducts.map((p, index) => ({
    product_id: p.productId,
    product_name: p.name,
    product_image: '', // Firestore products don't have image in analytics response
    units_sold: p.qty,
    revenue: p.revenue,
    growth_percentage: 0, // Not available in current API, would need per-product comparison
    trend: 'neutral' as const,
  }));

  return { products };
}

/**
 * Adapt API response → EngagementData (Section 5)
 */
export function adaptToEngagement(data: VendorAnalyticsResponse): EngagementData {
  const visits = Number(data.overview?.visits || 0);
  const leads = Number(data.overview?.leads || 0);
  const views = Number(data.overview?.views || 0);
  const orders = Number(data.overview?.orders || 0);

  return {
    saves: views, // Using views as "interest" metric
    cart_adds: leads, // Using leads as "intent" metric
    shares: 0, // Not tracked in current system
    insight: generateEngagementInsight(visits, leads, orders),
  };
}

/**
 * Check if the vendor has access to premium analytics sections
 */
export function getAnalyticsAccess(data: VendorAnalyticsResponse) {
  const tier = data.meta?.access?.tier ?? 0;
  const features = data.meta?.access?.features;

  return {
    tier,
    planKey: data.meta?.access?.planKey || 'FREE',
    source: data.meta?.access?.source || 'free',
    isPaid: tier >= 1,
    canSeeBasicChart: true, // Everyone gets basic chart
    canSeeInsights: features?.canUseDeepInsights ?? tier >= 2,
    canSeeComparisons: features?.canUseAdvanced ?? tier >= 3,
    canSeeTopProducts: features?.canUseDeepInsights ?? tier >= 2,
    canSeeConversion: features?.canUseDeepInsights ?? tier >= 2,
    canSeeEngagement: features?.canUseDeepInsights ?? tier >= 2,
    canSeeMonthRange: features?.canUseMonthRange ?? tier >= 1,
    expiresAtMs: data.meta?.access?.entitlementExpiresAtMs || null,
  };
}

/**
 * Get the tier display name
 */
export function getTierDisplayName(planKey: string): string {
  const key = String(planKey || 'FREE').toUpperCase();
  switch (key) {
    case 'APEX': return 'Apex';
    case 'MOMENTUM': return 'Momentum';
    case 'LAUNCH': return 'Launch';
    default: return 'Free';
  }
}

/**
 * Map your tier to subscription_tier for components that expect it
 */
export function mapTierToSubscriptionTier(planKey: string): string {
  const key = String(planKey || 'FREE').toUpperCase();
  switch (key) {
    case 'APEX': return 'pro';
    case 'MOMENTUM': return 'premium';
    case 'LAUNCH': return 'basic';
    default: return 'basic';
  }
}