// FILE: src/lib/whatsapp/buildWhatsAppLink.ts

/**
 * Shared WhatsApp link builder.
 * Sanitizes phone number and encodes message.
 * Returns a https://wa.me/ URL that opens only on user click (no popup issues).
 */
export function sanitizeWhatsAppNumber(phone: string): string {
  // Strip everything except digits
  let digits = String(phone || "").replace(/[^\d]/g, "");

  // Convert Nigerian local format (080..., 070..., 090..., 081...) to international
  if (/^0[789][01]\d{8}$/.test(digits)) {
    digits = "234" + digits.slice(1);
  }

  return digits;
}

export function buildWhatsAppLink(phone: string, message: string): string {
  const digits = sanitizeWhatsAppNumber(phone);
  if (!digits) return "";
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${digits}?text=${encoded}`;
}

/**
 * Check if a WhatsApp number is valid (has enough digits).
 */
export function isValidWhatsAppNumber(phone: string): boolean {
  const digits = sanitizeWhatsAppNumber(phone);
  return digits.length >= 10;
}
