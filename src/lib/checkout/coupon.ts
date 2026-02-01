export type AppliedCoupon = {
  storeSlug: string;
  code: string;
  subtotalKobo: number;
  discountKobo: number;
  totalKobo: number;
  appliedAtMs: number;
};

const KEY = "bizhub_checkout_coupon_v1";

function safeParse(raw: string | null): AppliedCoupon | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== "object") return null;

    const storeSlug = String(v.storeSlug || "");
    const code = String(v.code || "").toUpperCase();
    const subtotalKobo = Number(v.subtotalKobo || 0);
    const discountKobo = Number(v.discountKobo || 0);
    const totalKobo = Number(v.totalKobo || 0);
    const appliedAtMs = Number(v.appliedAtMs || 0);

    if (!storeSlug || !code) return null;
    if (!Number.isFinite(subtotalKobo) || subtotalKobo <= 0) return null;
    if (!Number.isFinite(discountKobo) || discountKobo < 0) return null;
    if (!Number.isFinite(totalKobo) || totalKobo < 0) return null;

    return { storeSlug, code, subtotalKobo, discountKobo, totalKobo, appliedAtMs };
  } catch {
    return null;
  }
}

export function loadAppliedCoupon(): AppliedCoupon | null {
  if (typeof window === "undefined") return null;
  return safeParse(window.localStorage.getItem(KEY));
}

export function saveAppliedCoupon(c: AppliedCoupon) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(c));
}

export function clearAppliedCoupon() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

/**
 * Returns coupon only if it matches this store AND this subtotal.
 * If cart changed, coupon is considered stale.
 */
export function getCouponForCheckout(params: { storeSlug: string; subtotalKobo: number }) {
  const c = loadAppliedCoupon();
  if (!c) return null;
  if (c.storeSlug !== params.storeSlug) return null;
  if (c.subtotalKobo !== params.subtotalKobo) return null;
  return c;
}