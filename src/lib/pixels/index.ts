/* ──────────────────────────────────────────────────────────────
   Tracking Pixels — Facebook, GA4, TikTok, Twitter/X, Snapchat

   Add your pixel IDs in .env.local:
     NEXT_PUBLIC_FB_PIXEL_ID=
     NEXT_PUBLIC_GA4_MEASUREMENT_ID=
     NEXT_PUBLIC_TIKTOK_PIXEL_ID=
     NEXT_PUBLIC_TWITTER_PIXEL_ID=
     NEXT_PUBLIC_SNAPCHAT_PIXEL_ID=
   ────────────────────────────────────────────────────────────── */

const win = (): any => (typeof window !== "undefined" ? window : undefined);

// Pixel IDs
export const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID || "";
export const GA4_ID = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID || "";
export const TIKTOK_PIXEL_ID = process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID || "";
export const TWITTER_PIXEL_ID = process.env.NEXT_PUBLIC_TWITTER_PIXEL_ID || "";
export const SNAP_PIXEL_ID = process.env.NEXT_PUBLIC_SNAPCHAT_PIXEL_ID || "";

// Helpers — safe calls (no-op if script not loaded yet)
function fbq(...a: any[]) { win()?.fbq?.(...a); }
function gtag(...a: any[]) { win()?.gtag?.(...a); }
function twq(...a: any[]) { win()?.twq?.(...a); }
function snaptr(...a: any[]) { win()?.snaptr?.(...a); }
function ttq(): any { return win()?.ttq; }

/* ═══ PAGE VIEW — fires on every route change ═══ */
export function pixelPageView(url?: string) {
  const path = url || win()?.location?.pathname || "/";
  if (FB_PIXEL_ID)      fbq("track", "PageView");
  if (GA4_ID)           gtag("config", GA4_ID, { page_path: path });
  if (TIKTOK_PIXEL_ID)  ttq()?.page?.();
  if (TWITTER_PIXEL_ID) twq("track", "PageView");
  if (SNAP_PIXEL_ID)    snaptr("track", "PAGE_VIEW");
}

/* ═══ SIGN UP / COMPLETE REGISTRATION ═══ */
export function pixelSignUp(method = "email") {
  if (FB_PIXEL_ID)      fbq("track", "CompleteRegistration", { content_name: method });
  if (GA4_ID)           gtag("event", "sign_up", { method });
  if (TIKTOK_PIXEL_ID)  ttq()?.track?.("CompleteRegistration");
  if (TWITTER_PIXEL_ID) twq("track", "tw-signup-complete");
  if (SNAP_PIXEL_ID)    snaptr("track", "SIGN_UP");
}

/* ═══ LOGIN ═══ */
export function pixelLogin(method = "email") {
  if (FB_PIXEL_ID)      fbq("trackCustom", "Login", { method });
  if (GA4_ID)           gtag("event", "login", { method });
  if (TIKTOK_PIXEL_ID)  ttq()?.track?.("SubmitForm");
  if (SNAP_PIXEL_ID)    snaptr("track", "LOGIN");
}

/* ═══ VIEW CONTENT (product page) ═══ */
export function pixelViewContent(p: {
  id?: string; name?: string; value?: number; currency?: string;
}) {
  const c = p.currency || "NGN";
  if (FB_PIXEL_ID)      fbq("track", "ViewContent", { content_ids: p.id ? [p.id] : [], content_name: p.name, content_type: "product", value: p.value, currency: c });
  if (GA4_ID)           gtag("event", "view_item", { items: [{ item_id: p.id, item_name: p.name, price: p.value }], currency: c });
  if (TIKTOK_PIXEL_ID)  ttq()?.track?.("ViewContent", { content_id: p.id, content_name: p.name, value: p.value, currency: c });
  if (SNAP_PIXEL_ID)    snaptr("track", "VIEW_CONTENT", { item_ids: p.id ? [p.id] : [], price: p.value, currency: c });
}

/* ═══ ADD TO CART ═══ */
export function pixelAddToCart(p: {
  id?: string; name?: string; value?: number; currency?: string; quantity?: number;
}) {
  const c = p.currency || "NGN";
  const q = p.quantity || 1;
  if (FB_PIXEL_ID)      fbq("track", "AddToCart", { content_ids: p.id ? [p.id] : [], content_name: p.name, content_type: "product", value: p.value, currency: c, num_items: q });
  if (GA4_ID)           gtag("event", "add_to_cart", { items: [{ item_id: p.id, item_name: p.name, price: p.value, quantity: q }], currency: c, value: p.value });
  if (TIKTOK_PIXEL_ID)  ttq()?.track?.("AddToCart", { content_id: p.id, value: p.value, currency: c, quantity: q });
  if (SNAP_PIXEL_ID)    snaptr("track", "ADD_CART", { item_ids: p.id ? [p.id] : [], price: p.value, currency: c, number_items: q });
}

/* ═══ INITIATE CHECKOUT ═══ */
export function pixelInitiateCheckout(p: {
  value?: number; currency?: string; numItems?: number;
}) {
  const c = p.currency || "NGN";
  if (FB_PIXEL_ID)      fbq("track", "InitiateCheckout", { value: p.value, currency: c, num_items: p.numItems || 1 });
  if (GA4_ID)           gtag("event", "begin_checkout", { value: p.value, currency: c });
  if (TIKTOK_PIXEL_ID)  ttq()?.track?.("InitiateCheckout", { value: p.value, currency: c });
  if (SNAP_PIXEL_ID)    snaptr("track", "START_CHECKOUT", { price: p.value, currency: c, number_items: p.numItems || 1 });
}

/* ═══ PURCHASE ═══ */
export function pixelPurchase(p: {
  value?: number; currency?: string; orderId?: string;
}) {
  const c = p.currency || "NGN";
  if (FB_PIXEL_ID)      fbq("track", "Purchase", { value: p.value, currency: c, content_type: "product" });
  if (GA4_ID)           gtag("event", "purchase", { transaction_id: p.orderId, value: p.value, currency: c });
  if (TIKTOK_PIXEL_ID)  ttq()?.track?.("CompletePayment", { value: p.value, currency: c });
  if (TWITTER_PIXEL_ID) twq("track", "tw-purchase-complete");
  if (SNAP_PIXEL_ID)    snaptr("track", "PURCHASE", { price: p.value, currency: c, transaction_id: p.orderId });
}

/* ═══ CONTACT (e.g. WhatsApp click) ═══ */
export function pixelContact() {
  if (FB_PIXEL_ID)      fbq("track", "Contact");
  if (GA4_ID)           gtag("event", "contact");
  if (TIKTOK_PIXEL_ID)  ttq()?.track?.("Contact");
  if (SNAP_PIXEL_ID)    snaptr("track", "CUSTOM_EVENT_1");
}
