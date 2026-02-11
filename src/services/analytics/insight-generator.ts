import { ANALYTICS_CONFIG } from '@/config/analytics.config';

/**
 * Insight Generator
 * Produces human-readable insight strings based on data.
 * All insight logic from the spec is centralized here.
 */

// ===========================
// SALES GROWTH INSIGHTS
// ===========================
export function generateSalesGrowthInsight(growthPercentage: number): string {
  if (growthPercentage > ANALYTICS_CONFIG.GROWTH_STRONG_THRESHOLD) {
    return 'Your sales are growing strongly.';
  }

  if (growthPercentage >= ANALYTICS_CONFIG.GROWTH_STEADY_THRESHOLD) {
    return 'You are growing steadily.';
  }

  return 'Your sales declined. Consider improving product images or pricing.';
}

// ===========================
// REVENUE BREAKDOWN INSIGHTS
// ===========================
export function generateRevenueBreakdownInsight(
  topProductName: string,
  topProductPercentage: number
): string {
  if (!topProductName) {
    return 'No revenue data available yet.';
  }

  const rounded = Math.round(topProductPercentage);

  if (rounded >= 50) {
    return `${topProductName} generates ${rounded}% of your revenue. Consider diversifying.`;
  }

  return `${topProductName} generates ${rounded}% of your revenue.`;
}

// ===========================
// CONVERSION INSIGHTS
// ===========================
export function generateConversionInsight(conversionRate: number): string {
  if (conversionRate > ANALYTICS_CONFIG.CONVERSION_GOOD_THRESHOLD) {
    return 'Your product pages convert very well.';
  }

  if (conversionRate >= ANALYTICS_CONFIG.CONVERSION_AVERAGE_THRESHOLD) {
    return 'Your conversion rate is average.';
  }

  return 'Improve product photos or descriptions.';
}

// ===========================
// ENGAGEMENT INSIGHTS
// ===========================
export function generateEngagementInsight(
  saves: number,
  purchases: number,
  cartAdds: number
): string {
  // High saves but low purchases
  if (saves > 0 && purchases > 0) {
    const saveToConversion = purchases / saves;

    if (saveToConversion < 0.3) {
      return 'Customers are interested but not converting. Review pricing.';
    }

    if (saveToConversion >= 0.3 && saveToConversion < 0.6) {
      return 'Moderate interest converting to sales. Keep optimizing.';
    }

    return 'Strong engagement leading to purchases.';
  }

  if (saves > 0 && purchases === 0) {
    return 'Customers are interested but not converting. Review pricing.';
  }

  if (cartAdds > 0 && purchases === 0) {
    return 'Products are being added to cart but not purchased. Review checkout flow.';
  }

  if (saves === 0 && cartAdds === 0 && purchases === 0) {
    return 'No engagement data yet. Promote your products to gain visibility.';
  }

  return 'Your engagement metrics are building. Keep it up.';
}

// ===========================
// SUMMARY INSIGHT (Dashboard Card)
// ===========================
export function generateSummaryInsight(growthPercentage: number): string {
  if (growthPercentage > ANALYTICS_CONFIG.GROWTH_STRONG_THRESHOLD) {
    return 'Strong growth this month — keep the momentum going!';
  }

  if (growthPercentage >= ANALYTICS_CONFIG.GROWTH_STEADY_THRESHOLD) {
    return 'Steady performance this month.';
  }

  if (growthPercentage >= -10) {
    return 'Slight dip in sales. Small adjustments can help.';
  }

  return 'Sales have declined. Review your listings and pricing.';
}

// ===========================
// PEAK DAY INSIGHT
// ===========================
export function generatePeakDayInsight(
  peakDate: string,
  peakRevenue: number
): string {
  if (!peakDate) return '';

  const date = new Date(peakDate);
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
  const formattedDate = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return `Best day: ${dayName}, ${formattedDate} with $${peakRevenue.toFixed(2)} in sales.`;
}

// ===========================
// TOP PRODUCT INSIGHT
// ===========================
export function generateTopProductInsight(
  productName: string,
  unitsSold: number,
  trend: 'up' | 'down' | 'neutral'
): string {
  if (trend === 'up') {
    return `${productName} is trending up with ${unitsSold} units sold.`;
  }

  if (trend === 'down') {
    return `${productName} sales are declining. Consider a promotion.`;
  }

  return `${productName} has sold ${unitsSold} units this period.`;
}