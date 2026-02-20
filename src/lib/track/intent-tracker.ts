// FILE: src/lib/track/intent-tracker.ts
// Client-side helper to fire buyer intent events.
// Called from product pages and storefront components.
// Privacy-safe: uses sessionId, never exposes buyer identity to seller.

function getSessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let sid = sessionStorage.getItem("_bih_sid");
  if (!sid) {
    sid = `s_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    sessionStorage.setItem("_bih_sid", sid);
  }
  return sid;
}

async function fireIntent(
  type: string,
  params: {
    productId: string;
    businessId: string;
    durationSeconds?: number;
  }
) {
  try {
    await fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: `intent_${type}`,
        productId: params.productId,
        businessId: params.businessId,
        sessionId: getSessionId(),
        durationSeconds: params.durationSeconds || 0,
      }),
    });
  } catch {
    // Non-fatal — never block UI for tracking
  }
}

export const intentTracker = {
  /** Track a product page view */
  productView(productId: string, businessId: string) {
    fireIntent("product_view", { productId, businessId });
  },

  /** Track a repeat view (same session, >1 view) */
  repeatView(productId: string, businessId: string) {
    fireIntent("repeat_view", { productId, businessId });
  },

  /** Track time spent on product page (fire on unmount/leave) */
  timeSpent(productId: string, businessId: string, seconds: number) {
    if (seconds < 5) return; // Ignore very short visits
    fireIntent("time_spent", { productId, businessId, durationSeconds: Math.min(seconds, 600) });
  },

  /** Track add to cart */
  addToCart(productId: string, businessId: string) {
    fireIntent("add_to_cart", { productId, businessId });
  },

  /** Track save/favorite */
  save(productId: string, businessId: string) {
    fireIntent("save", { productId, businessId });
  },

  /** Track contact/WhatsApp/chat click */
  contactClick(productId: string, businessId: string) {
    fireIntent("contact_click", { productId, businessId });
  },

  /** Track checkout start */
  checkoutStart(productId: string, businessId: string) {
    fireIntent("checkout_start", { productId, businessId });
  },

  /** Track store page revisit */
  storeRevisit(productId: string, businessId: string) {
    fireIntent("store_revisit", { productId, businessId });
  },
};
