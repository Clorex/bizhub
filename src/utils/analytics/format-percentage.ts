/**
 * Format a number as a percentage string.
 * e.g., 23.456 → "+23.5%"
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  const rounded = Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded.toFixed(decimals)}%`;
}

/**
 * Format percentage without sign prefix.
 * e.g., 23.456 → "23.5%"
 */
export function formatPercentageClean(value: number, decimals: number = 1): string {
  const rounded = Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
  return `${rounded.toFixed(decimals)}%`;
}

/**
 * Format percentage for the large display number.
 * e.g., 23.456 → "+23%"
 */
export function formatPercentageLarge(value: number): string {
  const rounded = Math.round(value);
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded}%`;
}

/**
 * Determine color class based on percentage value.
 */
export function getPercentageColor(value: number): string {
  if (value > 0) return 'text-green-500';
  if (value < 0) return 'text-red-500';
  return 'text-gray-500';
}

/**
 * Determine background color class based on percentage value.
 */
export function getPercentageBgColor(value: number): string {
  if (value > 0) return 'bg-green-50';
  if (value < 0) return 'bg-red-50';
  return 'bg-gray-50';
}