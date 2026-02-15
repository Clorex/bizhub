// NOTE: Centralized currency formatting (NGN)
// - Fixes UTF-8 mis-decoding cases like "₦50,000"
// - Ensures consistent output like "₦50,000"
// - Always format from numeric values at render time

const __NGN_FORMATTER = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 0,
});

function coerceNgnAmount(v: any): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;

  if (typeof v === "string") {
    // Fix common corrupted symbol then strip to numeric
    const fixed = v.replace(/\u00E2\u201A\u00A6/g, "\u20A6");
    const numeric = fixed.replace(/[^0-9.\-]/g, "");
    const n = Number(numeric);
    return Number.isFinite(n) ? n : 0;
  }

  // Firestore Timestamp etc -> not a number
  return 0;
}

function formatNgnIntl(amount: any): string {
  const n = coerceNgnAmount(amount);
  let s = __NGN_FORMATTER.format(n);

  // Some runtimes may output "NGN" instead of "₦"
  s = s.replace(/^NGN\s?/i, "₦");
  return s;
}
// FILE: src/lib/money.ts

const NGN_FORMATTER = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
});

/**
 * Formats a value as Nigerian Naira using a single consistent formatter.
 * Example: formatMoneyNGN(1000) -> "₦1,000.00"
 */
export function formatMoneyNGN(amount: any): string {
  return formatNgnIntl(amount);
}

/**
 * Convenience helper for values stored in Kobo.
 * Example: formatMoneyNGNFromKobo(150000) -> "₦1,500.00"
 */
export function formatMoneyNGNFromKobo(kobo: any): string {
  const k = coerceNgnAmount(kobo);
  const ngn = Number.isFinite(k) ? k / 100 : 0;
  return formatNgnIntl(ngn);
}

