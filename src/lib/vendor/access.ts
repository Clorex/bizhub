// FILE: src/lib/vendor/access.ts
/**
 * Batch 8 change:
 * - NO time-based lock.
 * - Free is unlimited time, but restricted via planConfig.
 *
 * Batch 10 change:
 * - No time-based trial for now (ignore trial fields even if they exist in DB).
 */
export type VendorAccessState = {
  locked: boolean;
  reason: "active_subscription" | "free";
  freeEndsAtMs: number | null;
  trialEndsAtMs: number | null;
  subscriptionExpiresAtMs: number | null;
  hasActiveSubscription: boolean;
  trialActive: boolean;
};

export function computeVendorAccessState(biz: any | null): VendorAccessState {
  const now = Date.now();

  const subscriptionExpiresAtMs = Number(biz?.subscription?.expiresAtMs || 0) || null;
  const hasActiveSubscription = !!(biz?.subscription?.planKey && subscriptionExpiresAtMs && subscriptionExpiresAtMs > now);

  return {
    locked: false,
    reason: hasActiveSubscription ? "active_subscription" : "free",
    freeEndsAtMs: null,

    // ✅ ignore trial completely
    trialEndsAtMs: null,
    trialActive: false,

    subscriptionExpiresAtMs,
    hasActiveSubscription,
  };
}