// FILE: src/lib/money.ts

const NGN_FORMATTER = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
});

/**
 * Formats a value as Nigerian Naira using a single consistent formatter.
 * Example: formatMoneyNGN(1000) -> "₦1,000.00"
 */
export function formatMoneyNGN(amount: number): string {
  const n = Number(amount);
  return NGN_FORMATTER.format(Number.isFinite(n) ? n : 0);
}

/**
 * Convenience helper for values stored in Kobo.
 * Example: formatMoneyNGNFromKobo(150000) -> "₦1,500.00"
 */
export function formatMoneyNGNFromKobo(kobo: number): string {
  const n = Number(kobo);
  return formatMoneyNGN(Number.isFinite(n) ? n / 100 : 0);
}