/**
 * Safely divide two numbers, preventing division by zero.
 * Returns 0 if denominator is 0.
 */
export function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) {
    if (numerator > 0) return 100;
    return 0;
  }
  return numerator / denominator;
}

/**
 * Safely calculate percentage.
 * Returns a number between 0 and 100 (or negative for decline).
 */
export function safePercentage(part: number, whole: number): number {
  if (whole === 0) {
    if (part > 0) return 100;
    return 0;
  }
  return (part / whole) * 100;
}