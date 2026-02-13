// FILE: src/lib/mask.ts
// Utility to mask sensitive customer data (phone, email)

/**
 * Masks a phone number: "08012345678" → "080****5678"
 * Shows first 3 + last 4, masks middle with ****
 */
export function maskPhone(phone: string): string {
  const cleaned = String(phone || "").trim();
  if (cleaned.length < 7) return "****";
  const start = cleaned.slice(0, 3);
  const end = cleaned.slice(-4);
  return `${start}****${end}`;
}

/**
 * Masks an email: "cloudnine@gmail.com" → "clo***@gmail.com"
 * Shows first 3 chars of local part + *** + full domain
 */
export function maskEmail(email: string): string {
  const cleaned = String(email || "").trim();
  const atIndex = cleaned.indexOf("@");
  if (atIndex < 1) return "***@***";
  const local = cleaned.slice(0, atIndex);
  const domain = cleaned.slice(atIndex);
  const visible = local.slice(0, Math.min(3, local.length));
  return `${visible}***${domain}`;
}