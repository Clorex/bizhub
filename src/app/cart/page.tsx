"use client";

import Link from "next/link";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { useCart } from "@/lib/cart/CartContext";
import { Button } from "@/components/ui/Button";
import { useEffect, useMemo, useState } from "react";

function fmtNaira(n: number) {
  try {
    return `₦${Number(n || 0).toLocaleString()}`;
  } catch {
    return `₦${n}`;
  }
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
  // Firestore doc ids must not include "/" — uuid is safe.
  try {
    const c: any = (globalThis as any).crypto;
    if (c?.randomUUID) return String(c.randomUUID());
  } catch {
    // ignore
  }
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

type ChatAvailability = {
  ok: boolean;
  enabled: boolean;
  whatsapp: string | null;
  storeName: string | null;
  reasons?: { toggleOn: boolean; subscribed: boolean; whatsappSet: boolean };
};

export default function CartPage() {
  const { cart, subtotal, setQty, removeFromCart, clearCart } = useCart();

  // Continue in Chat availability (per store)
  const [chatAvail, setChatAvail] = useState<ChatAvailability | null>(null);
  const [chatMsg, setChatMsg] = useState<string | null>(null);

  const storeSlug = cart.storeSlug ?? null;

  useEffect(() => {
    let mounted = true;

    async function loadAvail(slug: string) {
      try {
        setChatMsg(null);
        setChatAvail(null);

        const r = await fetch(`/api/vendor/chat/availability?storeSlug=${encodeURIComponent(slug)}`);
        const data = (await r.json().catch(() => ({}))) as ChatAvailability;

        if (!mounted) return;

        if (!r.ok) {
          setChatAvail(null);
          return;
        }

        setChatAvail(data);
      } catch {
        if (!mounted) return;
        setChatAvail(null);
      }
    }

    if (storeSlug) loadAvail(storeSlug);

    return () => {
      mounted = false;
    };
  }, [storeSlug]);

  const canChat = useMemo(() => {
    return !!(chatAvail?.ok && chatAvail?.enabled && chatAvail?.whatsapp);
  }, [chatAvail]);

  async function continueInChat() {
    try {
      if (!storeSlug) return;
      if (!canChat) return;

      const whatsapp = String(chatAvail?.whatsapp || "");
      if (!whatsapp) return;

      // 1) create order record immediately (fire-and-forget, no UI wait)
      const clientOrderId = makeClientOrderId();
      const payload = {
        storeSlug,
        clientOrderId,
        items: cart.items,
      };

      try {
        if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
          const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
          (navigator as any).sendBeacon("/api/orders/chat/create", blob);
        } else {
          fetch("/api/orders/chat/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
            keepalive: true,
          }).catch(() => {});
        }
      } catch {
        // ignore (still open WhatsApp)
      }

      // 2) open WhatsApp with prefilled message
      const storeName = chatAvail?.storeName ? String(chatAvail.storeName) : storeSlug;
      const refShort = String(clientOrderId).slice(0, 8);

      const lines: string[] = [];
      lines.push(`Hello ${storeName}.`);
      lines.push(`I want to order the following items from your BizHub store:`);

      for (const it of cart.items) {
        const opts =
          it.selectedOptions && Object.keys(it.selectedOptions).length
            ? ` (${Object.entries(it.selectedOptions).map(([k, v]) => `${k}: ${v}`).join(", ")})`
            : "";
        lines.push(`- ${it.qty} × ${it.name}${opts}`);
      }

      lines.push(``);
      lines.push(`Subtotal: ${fmtNaira(subtotal)}`);
      lines.push(`BizHub chat order ref: ${refShort}`);
      lines.push(`(I may send screenshots in this chat.)`);

      const text = lines.join("\n");

      window.open(waLink(whatsapp, text), "_blank");
    } catch (e: any) {
      setChatMsg(e?.message || "Failed to open chat");
    }
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="Cart" subtitle="Review items before checkout" showBack={false} />

      <div className="px-4 pb-24 space-y-3">
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-gray-700">
              Store: <b className="text-biz-ink">{cart.storeSlug ?? "None"}</b>
            </p>
            <button className="text-xs font-extrabold text-biz-accent" onClick={clearCart}>
              Clear cart
            </button>
          </div>

          {chatMsg ? <p className="mt-2 text-[11px] text-red-700">{chatMsg}</p> : null}
        </Card>

        {cart.items.length === 0 ? (
          <Card className="p-5 text-center">
            <p className="font-extrabold text-biz-ink">Cart is empty</p>
            <p className="text-sm text-biz-muted mt-2">Add products to continue.</p>

            <div className="mt-4">
              <Link
                href="/market"
                className="block w-full rounded-2xl py-3 text-center text-sm font-extrabold text-white bg-gradient-to-br from-biz-accent2 to-biz-accent shadow-float"
              >
                Go to Market
              </Link>
            </div>
          </Card>
        ) : (
          cart.items.map((i) => (
            <Card key={i.lineId} className="p-4">
              <div className="flex gap-3">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-biz-sand to-biz-cream overflow-hidden shrink-0">
                  {i.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={i.imageUrl} alt={i.name} className="h-full w-full object-cover" />
                  ) : null}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-biz-ink truncate">{i.name}</p>

                  {i.selectedOptions && Object.keys(i.selectedOptions).length ? (
                    <p className="text-[11px] text-biz-muted mt-1">
                      {Object.entries(i.selectedOptions)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(" • ")}
                    </p>
                  ) : null}

                  <p className="text-xs text-biz-muted mt-1">{fmtNaira(i.price)}</p>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        className="h-10 w-10 rounded-2xl border border-biz-line bg-white font-extrabold"
                        onClick={() => setQty(i.lineId, i.qty - 1)}
                      >
                        −
                      </button>
                      <span className="min-w-8 text-center font-extrabold text-biz-ink">{i.qty}</span>
                      <button
                        className="h-10 w-10 rounded-2xl border border-biz-line bg-white font-extrabold"
                        onClick={() => setQty(i.lineId, i.qty + 1)}
                      >
                        +
                      </button>
                    </div>

                    <button className="text-xs font-extrabold text-red-600" onClick={() => removeFromCart(i.lineId)}>
                      Remove
                    </button>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm font-extrabold text-biz-ink">{fmtNaira(i.price * i.qty)}</p>
                </div>
              </div>
            </Card>
          ))
        )}

        {cart.items.length > 0 && cart.storeSlug ? (
          <div className="fixed bottom-0 left-0 right-0 z-40">
            <div className="mx-auto w-full max-w-[430px] px-4 safe-pb pb-4">
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-biz-muted">Subtotal</span>
                  <b className="text-biz-ink">{fmtNaira(subtotal)}</b>
                </div>

                <div className="mt-3 space-y-2">
                  <Link href={`/b/${cart.storeSlug}/checkout`} className="block">
                    <Button>Checkout</Button>
                  </Link>

                  {/* Continue in Chat (only if vendor enabled + subscribed + whatsapp set) */}
                  {canChat ? (
                    <Button variant="secondary" onClick={continueInChat}>
                      Continue in Chat
                    </Button>
                  ) : null}

                  <Link href={`/b/${cart.storeSlug}`} className="block">
                    <Button variant="secondary">Continue shopping</Button>
                  </Link>

                  {/* If vendor has it OFF / not subscribed, we say nothing (strict, quiet). */}
                </div>
              </Card>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}