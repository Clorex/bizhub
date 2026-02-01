export type CartLine = {
  lineId: string; // productId + selectedOptions signature
  productId: string;
  name: string;
  price: number;
  qty: number;

  imageUrl?: string;

  // selected options like Size/Color (display only)
  selectedOptions?: Record<string, string>;
};

export type CartState = {
  storeSlug: string | null;
  items: CartLine[];
};

const KEY = "bizhub_cart_v2";

export function loadCart(): CartState {
  if (typeof window === "undefined") return { storeSlug: null, items: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { storeSlug: null, items: [] };
    const parsed = JSON.parse(raw);
    return {
      storeSlug: parsed?.storeSlug ?? null,
      items: Array.isArray(parsed?.items) ? parsed.items : [],
    };
  } catch {
    return { storeSlug: null, items: [] };
  }
}

export function saveCart(cart: CartState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(cart));
}

export function calcSubtotal(items: CartLine[]) {
  return items.reduce((sum, i) => sum + i.price * i.qty, 0);
}

export function makeLineId(productId: string, selectedOptions?: Record<string, string>) {
  const entries = Object.entries(selectedOptions || {}).sort(([a], [b]) => a.localeCompare(b));
  const signature = entries.map(([k, v]) => `${k}=${v}`).join("|");
  return `${productId}__${signature}`;
}