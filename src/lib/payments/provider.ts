// FILE: src/lib/payments/provider.ts
export type PaymentsProvider = "flutterwave" | "paystack";

/**
 * Controls which provider is used at runtime.
 * - Set PAYMENTS_PROVIDER=flutterwave (default)
 * - Set PAYMENTS_PROVIDER=paystack to switch back later
 */
export function paymentsProvider(): PaymentsProvider {
  const v = String(process.env.PAYMENTS_PROVIDER || process.env.PAYMENT_PROVIDER || "flutterwave").toLowerCase();
  return v === "paystack" ? "paystack" : "flutterwave";
}