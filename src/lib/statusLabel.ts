// FILE: src/lib/statusLabel.ts
// Single source of truth for all human-readable status/payment labels

const OPS_STATUS_MAP: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  paid: "Paid",
  in_transit: "In Transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
  disputed: "Disputed",
  accepted: "Accepted",
  processing: "Processing",
};

const ORDER_STATUS_MAP: Record<string, string> = {
  paid_held: "Payment Held",
  released_to_vendor_wallet: "Payment Released",
  released_to_vendor: "Payment Released",
  refunded: "Refunded",
  awaiting_vendor_confirmation: "Awaiting Confirmation",
  awaiting_confirmation: "Awaiting Confirmation",
  disputed: "Disputed",
  processing: "Processing",
};

const PAYMENT_TYPE_MAP: Record<string, string> = {
  direct_transfer: "Bank Transfer",
  paystack_escrow: "Card Payment",
  card: "Card Payment",
  paystack: "Card Payment",
};

const ESCROW_STATUS_MAP: Record<string, string> = {
  held: "Held in Escrow",
  released: "Released",
  refunded: "Refunded",
  disputed: "Disputed",
  none: "None",
};

/** Never returns "[object Object]" */
function safeString(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return "";
}

/** Fallback: replace underscores + title-case */
function fallbackLabel(s: string): string {
  if (!s) return "\u2014";
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatOpsStatus(status: unknown): string {
  const s = safeString(status).toLowerCase().trim();
  if (!s) return "\u2014";
  return OPS_STATUS_MAP[s] || ORDER_STATUS_MAP[s] || fallbackLabel(s);
}

export function formatOrderStatus(status: unknown): string {
  const s = safeString(status).toLowerCase().trim();
  if (!s) return "\u2014";
  return ORDER_STATUS_MAP[s] || OPS_STATUS_MAP[s] || fallbackLabel(s);
}

export function formatPaymentType(type: unknown): string {
  const s = safeString(type).toLowerCase().trim();
  if (!s) return "\u2014";
  return PAYMENT_TYPE_MAP[s] || fallbackLabel(s);
}

export function formatEscrowStatus(status: unknown): string {
  const s = safeString(status).toLowerCase().trim();
  if (!s) return "\u2014";
  return ESCROW_STATUS_MAP[s] || fallbackLabel(s);
}

/** Generic: tries all maps */
export function formatStatusLabel(status: unknown): string {
  const s = safeString(status).toLowerCase().trim();
  if (!s) return "\u2014";
  return (
    OPS_STATUS_MAP[s] ||
    ORDER_STATUS_MAP[s] ||
    PAYMENT_TYPE_MAP[s] ||
    ESCROW_STATUS_MAP[s] ||
    fallbackLabel(s)
  );
}