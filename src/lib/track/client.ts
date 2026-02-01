export type TrackEvent = {
  type:
    | "store_visit"
    | "product_view"
    | "market_click"
    | "market_impression"
    | "store_product_click";
  businessId: string;
  businessSlug?: string;
  productId?: string;
  count?: number; // allow batching (default 1)
};

export async function track(ev: TrackEvent) {
  try {
    const payload = { ...ev, count: Number(ev.count || 1) };

    // best effort: don’t block UI
    if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
      (navigator as any).sendBeacon("/api/track", blob);
      return;
    }

    fetch("/api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {
    // ignore
  }
}

/**
 * Batch helper (best-effort).
 * Groups identical events and sends them with `count`.
 */
export async function trackBatch(events: TrackEvent[]) {
  try {
    if (!Array.isArray(events) || events.length === 0) return;

    const grouped = new Map<string, TrackEvent & { count: number }>();

    for (const e of events) {
      if (!e?.type || !e?.businessId) continue;

      const key = [
        e.type,
        e.businessId,
        e.businessSlug || "",
        e.productId || "",
      ].join("|");

      const cur = grouped.get(key);
      if (cur) {
        cur.count = Math.min(500, (cur.count || 1) + (Number(e.count || 1) || 1));
      } else {
        grouped.set(key, { ...e, count: Math.min(500, Number(e.count || 1) || 1) });
      }
    }

    // Send grouped events
    for (const ev of grouped.values()) {
      track(ev);
    }
  } catch {
    // ignore
  }
}