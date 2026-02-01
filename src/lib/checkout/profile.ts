export type CheckoutProfile = {
  email: string;
  fullName: string;
  phone: string;
  address: string;
};

const KEY = "bizhub_checkout_profile_v1";

function safeParse(raw: string | null): CheckoutProfile | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (!v || typeof v !== "object") return null;
    return {
      email: String(v.email || ""),
      fullName: String(v.fullName || ""),
      phone: String(v.phone || ""),
      address: String(v.address || ""),
    };
  } catch {
    return null;
  }
}

export function loadCheckoutProfile(): CheckoutProfile {
  if (typeof window === "undefined") return { email: "", fullName: "", phone: "", address: "" };
  const v = safeParse(localStorage.getItem(KEY));
  return v || { email: "", fullName: "", phone: "", address: "" };
}

export function saveCheckoutProfile(p: CheckoutProfile) {
  if (typeof window === "undefined") return;
  localStorage.setItem(
    KEY,
    JSON.stringify({
      email: p.email || "",
      fullName: p.fullName || "",
      phone: p.phone || "",
      address: p.address || "",
    })
  );
}