import { ANALYTICS_CONFIG } from '@/config/analytics.config';

/**
 * Truncate text to a maximum length with ellipsis.
 * Default max: 15 characters (from spec).
 */
export function truncateText(
  text: string,
  maxLength: number = ANALYTICS_CONFIG.PRODUCT_NAME_MAX_LENGTH
): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.substring(0, maxLength)}…`;
}

/**
 * Truncate product name for chart labels.
 */
export function truncateProductName(name: string): string {
  return truncateText(name, ANALYTICS_CONFIG.PRODUCT_NAME_MAX_LENGTH);
}

/**
 * Truncate with word boundary awareness.
 * Won't cut in the middle of a word if possible.
 */
export function truncateAtWord(text: string, maxLength: number = 15): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;

  const truncated = text.substring(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');

  if (lastSpace > maxLength * 0.6) {
    return `${truncated.substring(0, lastSpace)}…`;
  }

  return `${truncated}…`;
}