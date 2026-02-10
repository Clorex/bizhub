"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Store,
  Trash2,
  ShoppingBag,
  AlertCircle,
} from "lucide-react";

import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { useCart } from "@/lib/cart/CartContext";
import { toast } from "@/lib/ui/toast";

import { CartItem } from "@/components/cart/CartItem";
import { CartSummary } from "@/components/cart/CartSummary";
import { EmptyCart } from "@/components/cart/EmptyCart";

function fmtNaira(n: number) {
  return `₦${Number(n || 0).toLocaleString("en-NG")}`;
}

function digitsOnlyPhone(v: string) {
  return String(v || "").replace(/[^\d]/g, "");
}

function waLink(wa: string, text: string) {
  const digits = digitsOnlyPhone(wa);
  const t = encodeURIComponent(text);
  return `https://wa.me/${digits}?text=${t}`;
}

function makeClientOrderId() {
  try {
    const c = globalThis.crypto;
    if (c?.randomUUID) return String(c.randomUUID());
  } catch {}
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

type ChatAvailability = {
  ok: boolean;
  enabled: boolean;
  whatsapp: string | null;
  storeName: string | null;
};

export default function CartPage() {
  const router = useRouter();
  const { cart, subtotal, setQty, removeFromCart, clearCart } = useCart();

  const [chatAvail, setChatAvail] = useState<ChatAvailability | null>(null);
  const [chatLoading, setChatLoading] = useState(false);

  const storeSlug = cart.storeSlug ?? "";
  const itemCount = cart.items.reduce((sum, item) => sum + item.qty, 0);
  const isEmpty = cart.items.length === 0;

  // Load chat availability
  useEffect(() => {
    if (!storeSlug) {
      setChatAvail(null);
      return;
    }

    let mounted = true;

    async function loadAvail() {
      try {
        const r = await fetch(
          `/api/vendor/chat/availability?storeSlug=${encodeURIComponent(storeSlug)}`
        );
        const data = await r.json().catch(() => ({}));

        if (!mounted) return;

        if (r.ok && data?.ok) {
          setChatAvail(data);
        } else {
          setChatAvail(null);
        }
      } catch {
        if (mounted) setChatAvail(null);
      }
    }

    loadAvail();
    return () => {
      mounted = false;
    };
  }, [storeSlug]);

  const canChat = useMemo(() => {
    return !!(chatAvail?.ok && chatAvail?.enabled && chatAvail?.whatsapp);
  }, [chatAvail]);

  const handleUpdateQty = useCallback(
    (lineId: string, qty: number) => {
      if (qty < 1) return;
      setQty(lineId, qty);
    },
    [setQty]
  );

  const handleRemove = useCallback(
    (lineId: string) => {
      removeFromCart(lineId);
      toast.info("Item removed from cart");
    },
    [removeFromCart]
  );

  const handleClearCart = useCallback(() => {
    clearCart();
    toast.info("Cart cleared");
  }, [clearCart]);

  const handleCheckout = useCallback(() => {
    if (!storeSlug) return;
    router.push(`/b/${storeSlug}/checkout`);
  }, [router, storeSlug]);

  const handleContinueShopping = useCallback(() => {
    if (storeSlug) {
      router.push(`/b/${storeSlug}`);
    } else {
      router.push("/market");
    }
  }, [router, storeSlug]);

  const handleContinueInChat = useCallback(async () => {
    if (!storeSlug || !canChat || !chatAvail?.whatsapp) return;

    setChatLoading(true);

    try {
      const clientOrderId = makeClientOrderId();
      const payload = {
        storeSlug,
        clientOrderId,
        items: cart.items,
      };

      // Fire and forget order creation
      try {
        if (navigator?.sendBeacon) {
          const blob = new Blob([JSON.stringify(payload)], {
            type: "application/json",
          });
          navigator.sendBeacon("/api/orders/chat/create", blob);
        } else {
          fetch("/api/orders/chat/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            keepalive: true,
          }).catch(() => {});
        }
      } catch {}

      // Build WhatsApp message
      const storeName = chatAvail.storeName || storeSlug;
      const refShort = clientOrderId.slice(0, 8);

      const lines: string[] = [
        `Hello ${storeName}! 👋`,
        ``,
        `I'd like to order the following from your myBizHub store:`,
        ``,
      ];

      for (const item of cart.items) {
        const opts =
          item.selectedOptions && Object.keys(item.selectedOptions).length
            ? ` (${Object.entries(item.selectedOptions)
                .map(([k, v]) => `${k}: ${v}`)
                .join(", ")})`
            : "";
        lines.push(`• ${item.qty}× ${item.name}${opts} — ${fmtNaira(item.price * item.qty)}`);
      }

      lines.push(``);
      lines.push(`💰 Subtotal: ${fmtNaira(subtotal)}`);
      lines.push(``);
      lines.push(`📋 Order ref: ${refShort}`);

      const text = lines.join("\n");
      window.open(waLink(chatAvail.whatsapp, text), "_blank");

      toast.success("Opening WhatsApp...");
    } catch (e: any) {
      toast.error(e?.message || "Failed to open chat");
    } finally {
      setChatLoading(false);
    }
  }, [storeSlug, canChat, chatAvail, cart.items, subtotal]);

  return (
    <div className="min-h-screen bg-gray-50">
      <GradientHeader
        title="Shopping Cart"
        subtitle={isEmpty ? "Your cart is empty" : `${itemCount} item${itemCount !== 1 ? "s" : ""}`}
        showBack={true}
      />

      {/* Increased bottom padding to account for fixed summary + bottom nav */}
      <div className="px-4 pb-72">
        {/* Store info */}
        {storeSlug && !isEmpty && (
          <Card className="p-4 mb-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
                  <Store className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">
                    Shopping from
                  </p>
                  <Link
                    href={`/b/${storeSlug}`}
                    className="text-xs text-orange-600 font-medium hover:underline"
                  >
                    @{storeSlug}
                  </Link>
                </div>
              </div>
              <button
                onClick={handleClearCart}
                className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600 transition px-3 py-2 rounded-lg hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Clear
              </button>
            </div>
          </Card>
        )}

        {/* Empty state */}
        {isEmpty ? (
          <div className="mt-4">
            <Card className="overflow-hidden">
              <EmptyCart storeSlug={storeSlug} />
            </Card>
          </div>
        ) : (
          <>
            {/* Cart items */}
            <div className="space-y-3 mt-4">
              {cart.items.map((item) => (
                <CartItem
                  key={item.lineId}
                  item={item}
                  onUpdateQty={handleUpdateQty}
                  onRemove={handleRemove}
                />
              ))}
            </div>

            {/* Info banner */}
            <div className="mt-4 rounded-xl bg-blue-50 border border-blue-100 p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">
                  Secure checkout
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  Your payment is protected. We support card payments and bank transfers.
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Fixed bottom summary - positioned above bottom nav */}
      {!isEmpty && storeSlug && (
        <div className="fixed bottom-16 left-0 right-0 z-40">
          <div className="mx-auto w-full max-w-[430px]">
            <CartSummary
              subtotal={subtotal}
              itemCount={itemCount}
              storeSlug={storeSlug}
              canChat={canChat}
              chatLoading={chatLoading}
              onCheckout={handleCheckout}
              onContinueInChat={handleContinueInChat}
              onContinueShopping={handleContinueShopping}
            />
          </div>
        </div>
      )}
    </div>
  );
}