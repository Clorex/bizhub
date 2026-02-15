// Centralized currency formatting (NGN)
// - Sanitizes mis-decoded Naira symbol sequences in string inputs
// - Outputs consistent "₦50,000" style values
// - UI should format at render-time from numeric values

const NGN_FORMATTER = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 0,
});

function coerceNgnMajor(v: any): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;

  if (typeof v === "string") {
    // broken sequence for mis-decoded ₦ (written as unicode escapes to avoid encoding issues)
    const fixed = v.replace(/\u00E2\u201A\u00A6/g, "\u20A6");
    const numeric = fixed.replace(/[^0-9.\-]/g, "");
    const n = Number(numeric);
    return Number.isFinite(n) ? n : 0;
  }

  return 0;
}

function formatNgn(n: number): string {
  let s = NGN_FORMATTER.format(Number.isFinite(n) ? n : 0);
  // Some environments output "NGN" instead of "₦"
  s = s.replace(/^NGN\s?/i, "₦");
  return s;
}

export function formatMoneyNGN(amount: any): string {
  return formatNgn(coerceNgnMajor(amount));
}

export function formatMoneyNGNFromKobo(kobo: any): string {
  const k = coerceNgnMajor(kobo);
  return formatNgn(k / 100);
}