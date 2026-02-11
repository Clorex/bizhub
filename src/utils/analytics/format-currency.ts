/**
 * Format a number as currency string.
 * Default: USD
 */
export function formatCurrency(
  amount: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format currency in compact form for charts.
 * e.g., 1500 → "$1.5K", 1200000 → "$1.2M"
 */
export function formatCurrencyCompact(
  amount: number,
  currency: string = 'USD',
  locale: string = 'en-US'
): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(1)}K`;
  }
  return formatCurrency(amount, currency, locale);
}

/**
 * Format revenue for display in product lists.
 */
export function formatRevenue(amount: number): string {
  if (amount === 0) return '$0.00';
  return formatCurrency(amount);
}