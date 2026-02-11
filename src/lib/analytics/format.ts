/**
 * Naira-aware formatting utilities for analytics display.
 * Replaces the USD-based formatters for your Nigerian market.
 */

/**
 * Format number as Naira currency.
 */
export function formatNaira(amount: number): string {
  if (typeof amount !== 'number' || isNaN(amount)) return '₦0';
  return `₦${amount.toLocaleString('en-NG', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

/**
 * Format Naira in compact form for charts.
 * e.g., 1500 → "₦1.5K", 1200000 → "₦1.2M"
 */
export function formatNairaCompact(amount: number): string {
  if (typeof amount !== 'number' || isNaN(amount) || amount <= 0) return '₦0';
  if (amount >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `₦${(amount / 1_000).toFixed(0)}k`;
  return `₦${amount.toFixed(0)}`;
}

/**
 * Format number with locale.
 */
export function formatNumber(n: number): string {
  if (typeof n !== 'number' || isNaN(n)) return '0';
  return n.toLocaleString('en-NG');
}

/**
 * Format percentage with sign.
 * e.g., 23.456 → "+23.5%"
 */
export function formatPercentageWithSign(value: number, decimals: number = 1): string {
  if (typeof value !== 'number' || isNaN(value)) return '0%';
  const rounded = Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded.toFixed(decimals)}%`;
}

/**
 * Format percentage without sign.
 */
export function formatPercentageClean(value: number, decimals: number = 1): string {
  if (typeof value !== 'number' || isNaN(value)) return '0%';
  const rounded = Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
  return `${rounded.toFixed(decimals)}%`;
}

/**
 * Format a date string for chart display.
 * Handles "YYYY-MM-DD" format.
 */
export function formatChartDate(dateStr: string): string {
  if (!dateStr) return '';
  if (dateStr.startsWith('Wk')) return dateStr;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      const parts = dateStr.split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
      return dateStr.slice(-2);
    }
    return date.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr.slice(-5);
  }
}

/**
 * Format peak day for display.
 */
export function formatPeakDay(dateStr: string, revenue: number): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    const dayName = date.toLocaleDateString('en-NG', { weekday: 'long' });
    const formatted = date.toLocaleDateString('en-NG', { month: 'short', day: 'numeric' });
    return `Best day: ${dayName}, ${formatted} with ${formatNaira(revenue)} in sales.`;
  } catch {
    return `Best day: ${dateStr} with ${formatNaira(revenue)} in sales.`;
  }
}