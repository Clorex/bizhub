"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { CartLine, CartState } from "@/lib/cart/store";
import { calcSubtotal, loadCart, makeLineId, saveCart } from "@/lib/cart/store";

type CartContextValue = {
  cart: CartState;
  subtotal: number;

  addToCart: (
    storeSlug: string,
    item: Omit<CartLine, "lineId" | "qty">,
    qty?: number
  ) => void;

  removeFromCart: (lineId: string) => void;
  setQty: (lineId: string, qty: number) => void;
  clearCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartState>({ storeSlug: null, items: [] });

  useEffect(() => {
    setCart(loadCart());
  }, []);

  useEffect(() => {
    saveCart(cart);
  }, [cart]);

  const subtotal = useMemo(() => calcSubtotal(cart.items), [cart.items]);

  function addToCart(storeSlug: string, item: Omit<CartLine, "lineId" | "qty">, qty = 1) {
    setCart((prev) => {
      const base: CartState =
        prev.storeSlug && prev.storeSlug !== storeSlug
          ? { storeSlug, items: [] }
          : { ...prev, storeSlug };

      const lineId = makeLineId(item.productId, item.selectedOptions);
      const existing = base.items.find((x) => x.lineId === lineId);

      if (existing) {
        return {
          ...base,
          items: base.items.map((x) => (x.lineId === lineId ? { ...x, qty: x.qty + qty } : x)),
        };
      }

      return { ...base, items: [...base.items, { ...item, lineId, qty }] };
    });
  }

  function removeFromCart(lineId: string) {
    setCart((prev) => {
      const items = prev.items.filter((x) => x.lineId !== lineId);
      return { storeSlug: items.length ? prev.storeSlug : null, items };
    });
  }

  function setQty(lineId: string, qty: number) {
    const q = Math.max(1, qty);
    setCart((prev) => ({
      ...prev,
      items: prev.items.map((x) => (x.lineId === lineId ? { ...x, qty: q } : x)),
    }));
  }

  function clearCart() {
    setCart({ storeSlug: null, items: [] });
  }

  const value: CartContextValue = { cart, subtotal, addToCart, removeFromCart, setQty, clearCart };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}