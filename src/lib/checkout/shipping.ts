export type AppliedShipping = {
  storeSlug: string;
  optionId: string | null;
  type: "pickup" | "delivery";
  name: string;
  feeKobo: number;
  selectedAtMs: number;
};

const KEY = "bizhub_checkout_shipping_v1";

function safeParse(raw: string | null): AppliedShipping | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== "object") return null;

    const storeSlug = String(v.storeSlug || "");
    const optionId = v.optionId != null ? String(v.optionId) : null;
    const type = String(v.type || "delivery") === "pickup" ? "pickup" : "delivery";
    const name = String(v.name || "").slice(0, 60) || (type === "pickup" ? "Pickup" : "Delivery");
    const feeKobo = Math.max(0, Math.floor(Number(v.feeKobo || 0)));
    const selectedAtMs = Number(v.selectedAtMs || 0);

    if (!storeSlug) return null;
    if (!Number.isFinite(feeKobo)) return null;

    return { storeSlug, optionId, type, name, feeKobo, selectedAtMs };
  } catch {
    return null;
  }
}

export function loadAppliedShipping(): AppliedShipping | null {
  if (typeof window === "undefined") return null;
  return safeParse(window.localStorage.getItem(KEY));
}

export function saveAppliedShipping(s: AppliedShipping) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(s));
}

export function clearAppliedShipping() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}

export function getShippingForCheckout(params: { storeSlug: string }) {
  const s = loadAppliedShipping();
  if (!s) return null;
  if (s.storeSlug !== params.storeSlug) return null;
  return s;
}