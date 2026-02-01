const KEY = "bizhub_recent_order_ids";
const MAX = 20;

function safeParse(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export function getRecentOrderIds(): string[] {
  if (typeof window === "undefined") return [];
  return safeParse(window.localStorage.getItem(KEY));
}

export function addRecentOrderId(orderId: string) {
  if (typeof window === "undefined") return;
  const cur = getRecentOrderIds();
  const next = [orderId, ...cur.filter((id) => id !== orderId)].slice(0, MAX);
  window.localStorage.setItem(KEY, JSON.stringify(next));
}

export function removeRecentOrderId(orderId: string) {
  if (typeof window === "undefined") return;
  const cur = getRecentOrderIds();
  const next = cur.filter((id) => id !== orderId);
  window.localStorage.setItem(KEY, JSON.stringify(next));
}

export function clearRecentOrderIds() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}