// FILE: src/lib/buyers/key.ts
export type BuyerKeyInput = {
  phone?: string | null;
  email?: string | null;
};

function cleanPhone(raw: string) {
  // keep digits only (Nigeria-friendly). Allows "234..." or "0..."
  const d = String(raw || "").replace(/[^\d]/g, "");
  return d.length >= 7 ? d : "";
}

function cleanEmail(raw: string) {
  const e = String(raw || "").trim().toLowerCase();
  if (!e.includes("@") || e.length < 5) return "";
  return e;
}

/**
 * BuyerKey priority: phone > email.
 * This is INTERNAL only (used for risk tagging & freezing).
 */
export function buyerKeyFrom(params: BuyerKeyInput) {
  const phone = params.phone ? cleanPhone(params.phone) : "";
  const email = params.email ? cleanEmail(params.email) : "";

  const key = phone ? `phone:${phone}` : email ? `email:${email}` : "";
  return { key, phone: phone || null, email: email || null };
}