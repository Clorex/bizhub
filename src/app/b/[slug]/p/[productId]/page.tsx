// FILE: src/app/b/[slug]/p/[productId]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { db } from "@/lib/firebase/client";
import { doc, getDoc } from "firebase/firestore";
import { useCart } from "@/lib/cart/CartContext";
import { track } from "@/lib/track/client";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { Input } from "@/components/ui/Input";

type OptionGroup = { name: string; values: string[] };

type ShippingOption = {
  id: string;
  type: "pickup" | "delivery";
  name: string;
  feeKobo: number;
  etaDays: number;
  areasText?: string | null;
};

type ChatAvailability = {
  ok: boolean;
  enabled: boolean;
  whatsapp: string | null;
  storeName: string | null;
  reasons?: { toggleOn: boolean; subscribed: boolean; whatsappSet: boolean };
};

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
  try {
    const c: any = (globalThis as any).crypto;
    if (c?.randomUUID) return String(c.randomUUID());
  } catch {
    // ignore
  }
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export default function ProductPage() {
  const router = useRouter();
  const params = useParams();
  const slug = String((params as any)?.slug ?? "");
  const productId = String((params as any)?.productId ?? "");

  const { addToCart } = useCart();

  const [loading, setLoading] = useState(true);
  const [p, setP] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});

  // Quick order (chat)
  const [qty, setQty] = useState<number>(1);
  const [deliveryLocation, setDeliveryLocation] = useState<string>("");

  const [shipLoading, setShipLoading] = useState(false);
  const [shipMsg, setShipMsg] = useState<string | null>(null);
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShipId, setSelectedShipId] = useState<string>("");

  const [chatAvail, setChatAvail] = useState<ChatAvailability | null>(null);

  const images: string[] = useMemo(() => (Array.isArray(p?.images) ? p.images : []), [p]);
  const optionGroups: OptionGroup[] = useMemo(() => (Array.isArray(p?.optionGroups) ? p.optionGroups : []), [p]);

  const selectedOptionsClean = useMemo(() => {
    const out: Record<string, string> = {};
    for (const g of optionGroups) {
      const v = selected[g.name];
      if (v) out[g.name] = v;
    }
    return out;
  }, [selected, optionGroups]);

  const listingType = String(p?.listingType || "product"); // product | service
  const serviceMode = String(p?.serviceMode || "book"); // book | pay

  const isService = listingType === "service";
  const outOfStock = listingType === "product" && Number(p?.stock ?? 0) <= 0;

  const selectedShipping = useMemo(() => {
    if (!selectedShipId) return null;
    return shippingOptions.find((o) => o.id === selectedShipId) || null;
  }, [selectedShipId, shippingOptions]);

  const shippingRequired = shippingOptions.length > 0;
  const shippingFeeKobo = Number(selectedShipping?.feeKobo || 0);
  const shippingFeeNgn = shippingFeeKobo / 100;

  const canChat = useMemo(() => {
    return !!(chatAvail?.ok && chatAvail?.enabled && chatAvail?.whatsapp);
  }, [chatAvail]);

  const unitPriceNgn = Number(p?.price || 0);
  const itemsSubtotalNgn = Math.max(0, Math.floor(Number(qty || 1)) * unitPriceNgn);
  const estimatedTotalNgn = itemsSubtotalNgn + shippingFeeNgn;

  const canQuickOrderChat = useMemo(() => {
    const q = Math.max(1, Math.floor(Number(qty || 1)));
    if (!p) return false;
    if (!canChat) return false;

    // Don’t quick-order book-only services (they should use vendor WhatsApp booking)
    if (isService && serviceMode === "book") return false;

    // If stock is tracked and it’s out, block
    if (outOfStock) return false;

    // If store has shipping options, customer must pick one
    if (shippingRequired && !selectedShipping) return false;

    // If delivery selected, require area/city (simple, chat-native)
    if (selectedShipping?.type !== "pickup") {
      if (deliveryLocation.trim().length < 2) return false;
    }

    return q >= 1;
  }, [qty, p, canChat, isService, serviceMode, outOfStock, shippingRequired, selectedShipping, deliveryLocation]);

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        setLoading(true);
        setMsg(null);

        const snap = await getDoc(doc(db, "products", productId));
        if (!snap.exists()) {
          setMsg("Listing not found");
          setP(null);
          return;
        }

        const data = { id: snap.id, ...snap.data() } as any;

        const productSlug = String(data?.businessSlug || "");
        if (productSlug && productSlug !== slug) {
          setMsg("This listing does not belong to this store.");
          setP(null);
          return;
        }

        if (!mounted) return;
        setP(data);

        // Track product view as "visit"
        if (data?.businessId) {
          track({
            type: "product_view",
            businessId: String(data.businessId),
            businessSlug: slug,
            productId: String(data.id),
          });
        }
      } catch (e: any) {
        setMsg(e?.message || "Failed to load listing");
        setP(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (productId) run();
    return () => {
      mounted = false;
    };
  }, [productId, slug]);

  // Load shipping options for quick order (delivery/pickup choice)
  useEffect(() => {
    let mounted = true;

    async function loadShipping() {
      setShipLoading(true);
      setShipMsg(null);
      try {
        const r = await fetch(`/api/vendor/shipping/options?storeSlug=${encodeURIComponent(slug)}`);
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.error || "Failed to load delivery options");

        const opts: ShippingOption[] = Array.isArray(data.options) ? data.options : [];
        if (!mounted) return;

        setShippingOptions(opts);

        if (opts.length > 0) {
          // default to first option
          setSelectedShipId(String(opts[0].id));
        } else {
          setSelectedShipId("");
        }
      } catch (e: any) {
        if (!mounted) return;
        setShippingOptions([]);
        setSelectedShipId("");
        setShipMsg(e?.message || "Failed to load delivery options");
      } finally {
        if (mounted) setShipLoading(false);
      }
    }

    if (slug) loadShipping();
    return () => {
      mounted = false;
    };
  }, [slug]);

  // Load chat availability (Continue in Chat)
  useEffect(() => {
    let mounted = true;

    async function loadChatAvail() {
      try {
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

    if (slug) loadChatAvail();
    return () => {
      mounted = false;
    };
  }, [slug]);

  function pick(groupName: string, value: string) {
    setSelected((prev) => ({ ...prev, [groupName]: prev[groupName] === value ? "" : value }));
  }

  function add() {
    if (!p) return;

    addToCart(
      slug,
      {
        productId: p.id,
        name: String(p?.name || "Item"),
        price: Number(p?.price || 0),
        imageUrl: images[0],
        selectedOptions: selectedOptionsClean,
      },
      1
    );

    router.push("/cart");
  }

  function bookOnly() {
    alert("For services, booking will open WhatsApp from the store page.");
    router.push(`/b/${slug}`);
  }

  async function continueInChatQuickOrder() {
    try {
      if (!p) return;
      if (!canChat) return;

      const whatsapp = String(chatAvail?.whatsapp || "");
      if (!whatsapp) return;

      const q = Math.max(1, Math.floor(Number(qty || 1)));

      // Create an order record quickly (best-effort, no UI wait)
      const clientOrderId = makeClientOrderId();

      const payload = {
        storeSlug: slug,
        clientOrderId,
        items: [
          {
            productId: String(p.id),
            name: String(p?.name || "Item"),
            qty: q,
            price: Number(p?.price || 0),
            imageUrl: images[0] || null,
            selectedOptions: selectedOptionsClean,
          },
        ],
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

      const storeName = chatAvail?.storeName ? String(chatAvail.storeName) : slug;
      const refShort = String(clientOrderId).slice(0, 8);

      const optsTxt =
        selectedOptionsClean && Object.keys(selectedOptionsClean).length
          ? ` (${Object.entries(selectedOptionsClean)
              .map(([k, v]) => `${k}: ${v}`)
              .join(", ")})`
          : "";

      const shipLabel = selectedShipping
        ? `${selectedShipping.name} ${selectedShipping.type === "pickup" ? "(Pickup)" : "(Delivery)"}`
        : shippingOptions.length > 0
          ? "Not selected"
          : "Not set";

      const lines: string[] = [];
      lines.push(`Hello ${storeName}.`);
      lines.push(`I want to place a quick order from your BizHub store.`);
      lines.push(``);
      lines.push(`- ${q} × ${String(p?.name || "Item")}${optsTxt}`);
      lines.push(`Items subtotal: ${fmtNaira(itemsSubtotalNgn)}`);

      lines.push(``);
      lines.push(`Delivery option: ${shipLabel}`);

      if (selectedShipping?.type !== "pickup") {
        lines.push(`Delivery location: ${deliveryLocation.trim() || "To be confirmed"}`);
      } else {
        lines.push(`Pickup: I will come to pick up.`);
      }

      if (selectedShipping) {
        lines.push(`Estimated shipping fee: ${fmtNaira(shippingFeeNgn)}`);
      }

      lines.push(`Estimated total: ${fmtNaira(estimatedTotalNgn)}`);
      lines.push(``);
      lines.push(`BizHub chat order ref: ${refShort}`);

      window.open(waLink(whatsapp, lines.join("\n")), "_blank");
    } catch (e: any) {
      setMsg(e?.message || "Failed to open chat");
    }
  }

  return (
    <div className="min-h-screen">
      <GradientHeader
        title={listingType === "service" ? "Service" : "Product"}
        showBack={true}
        subtitle={slug ? `Store: ${slug}` : undefined}
        right={
          <button
            className="rounded-2xl border border-biz-line bg-white px-3 py-2 text-xs font-extrabold shadow-soft"
            onClick={() => router.push("/cart")}
          >
            Cart
          </button>
        }
      />

      <div className="px-4 pb-24 space-y-3">
        {loading ? <Card className="p-4">Loadingâ€¦</Card> : null}
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}

        {!loading && p ? (
          <>
            {/* Media + title */}
            <Card className="p-4">
              <div className="h-56 w-full rounded-3xl bg-gradient-to-br from-biz-sand to-biz-cream overflow-hidden">
                {images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={images[0]} alt={p?.name || "Item"} className="h-full w-full object-cover" />
                ) : null}
              </div>

              <p className="mt-3 text-lg font-extrabold text-biz-ink">{p?.name}</p>

              <p className="mt-1 text-sm text-gray-700">
                {listingType === "service" && serviceMode === "book" ? "Book only" : fmtNaira(p?.price || 0)}
              </p>

              <div className="mt-2 flex items-center justify-between text-xs text-biz-muted">
                <span>
                  {listingType === "product" ? (
                    <>
                      Stock: <b className="text-biz-ink">{Number(p?.stock ?? 0)}</b>
                    </>
                  ) : (
                    <>
                      Type: <b className="text-biz-ink">Service</b>
                    </>
                  )}
                </span>
                <span>
                  Packaging: <b className="text-biz-ink">{p?.packaging || "—"}</b>
                </span>
              </div>

              {p?.description ? (
                <p className="mt-3 text-sm text-gray-700 whitespace-pre-wrap">{String(p.description)}</p>
              ) : null}
            </Card>

            {/* Variations */}
            {optionGroups.length ? (
              <SectionCard title="Variations" subtitle="Optional choices (price/stock stays the same)">
                <div className="space-y-4">
                  {optionGroups.map((g) => (
                    <div key={g.name}>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-extrabold text-biz-ink">{g.name}</p>
                        {selected[g.name] ? (
                          <button className="text-xs font-extrabold text-biz-accent" onClick={() => pick(g.name, selected[g.name])}>
                            Clear
                          </button>
                        ) : null}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        {(g.values || []).map((v) => {
                          const active = selected[g.name] === v;
                          return (
                            <button
                              key={v}
                              onClick={() => pick(g.name, v)}
                              className={
                                active
                                  ? "px-4 py-2 rounded-full text-xs font-extrabold text-white bg-gradient-to-br from-biz-accent2 to-biz-accent"
                                  : "px-4 py-2 rounded-full text-xs font-extrabold bg-biz-cream text-biz-ink"
                              }
                            >
                              {v}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            ) : null}

            {/* Quick order (chat-native) */}
            {!isService || serviceMode === "pay" ? (
              <SectionCard title="Quick order" subtitle="Send your order details in WhatsApp">
                {!canChat ? (
                  <div className="rounded-2xl border border-biz-line bg-white p-3">
                    <p className="text-sm font-bold text-biz-ink">Continue in Chat is not available</p>
                    <p className="text-[11px] text-biz-muted mt-1">
                      Use Add to cart to checkout, or message the vendor from the store page.
                    </p>
                  </div>
                ) : null}

                <div className="mt-2 space-y-3">
                  <div className="rounded-2xl border border-biz-line bg-white p-3">
                    <p className="text-xs text-biz-muted">Quantity</p>
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        className="h-10 w-10 rounded-2xl border border-biz-line bg-white font-extrabold"
                        onClick={() => setQty((v) => Math.max(1, Math.floor(Number(v || 1)) - 1))}
                      >
                        −
                      </button>
                      <Input
                        type="number"
                        min={1}
                        value={String(qty)}
                        onChange={(e) => setQty(Math.max(1, Math.floor(Number(e.target.value || 1))))}
                      />
                      <button
                        type="button"
                        className="h-10 w-10 rounded-2xl border border-biz-line bg-white font-extrabold"
                        onClick={() => setQty((v) => Math.max(1, Math.floor(Number(v || 1)) + 1))}
                      >
                        +
                      </button>
                    </div>

                    <p className="mt-2 text-[11px] text-biz-muted">
                      Items subtotal: <b className="text-biz-ink">{fmtNaira(itemsSubtotalNgn)}</b>
                    </p>
                  </div>

                  <div className="rounded-2xl border border-biz-line bg-white p-3">
                    <p className="text-xs text-biz-muted">Delivery option</p>

                    {shipLoading ? <p className="text-sm text-biz-muted mt-2">Loading…</p> : null}
                    {shipMsg ? <p className="text-sm text-red-700 mt-2">{shipMsg}</p> : null}

                    {!shipLoading && !shipMsg && shippingOptions.length === 0 ? (
                      <p className="text-[11px] text-biz-muted mt-2">
                        This store has not set delivery options yet.
                      </p>
                    ) : null}

                    {shippingOptions.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {shippingOptions.map((o) => {
                          const active = o.id === selectedShipId;
                          const feeNgn = Number(o.feeKobo || 0) / 100;
                          return (
                            <button
                              key={o.id}
                              type="button"
                              onClick={() => setSelectedShipId(o.id)}
                              className={[
                                "w-full text-left rounded-2xl border p-3 transition",
                                active
                                  ? "border-transparent bg-gradient-to-br from-biz-accent2 to-biz-accent text-white shadow-float"
                                  : "border-biz-line bg-white hover:bg-black/[0.02]",
                              ].join(" ")}
                            >
                              <p className={active ? "text-sm font-bold" : "text-sm font-bold text-biz-ink"}>
                                {o.name} {o.type === "pickup" ? "(Pickup)" : "(Delivery)"}
                              </p>
                              <p className={active ? "text-[11px] opacity-90 mt-1" : "text-[11px] text-biz-muted mt-1"}>
                                Fee: <b>{fmtNaira(feeNgn)}</b>
                                {o.etaDays ? ` • ETA: ${o.etaDays} day(s)` : ""}
                                {o.areasText ? ` • ${o.areasText}` : ""}
                              </p>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}

                    {selectedShipping ? (
                      <p className="mt-2 text-[11px] text-biz-muted">
                        Estimated shipping: <b className="text-biz-ink">{fmtNaira(shippingFeeNgn)}</b> • Estimated total:{" "}
                        <b className="text-biz-ink">{fmtNaira(estimatedTotalNgn)}</b>
                      </p>
                    ) : null}
                  </div>

                  {selectedShipping?.type !== "pickup" ? (
                    <div className="rounded-2xl border border-biz-line bg-white p-3">
                      <p className="text-xs text-biz-muted">Delivery location (area/city)</p>
                      <div className="mt-2">
                        <Input
                          placeholder="Example: Lekki, Ajah, Wuse"
                          value={deliveryLocation}
                          onChange={(e) => setDeliveryLocation(e.target.value)}
                        />
                      </div>
                      <p className="mt-2 text-[11px] text-biz-muted">
                        Keep it short — the seller will confirm full address in chat.
                      </p>
                    </div>
                  ) : null}
                </div>
              </SectionCard>
            ) : null}

            {/* Bottom actions */}
            <div className="fixed bottom-0 left-0 right-0 z-40">
              <div className="mx-auto w-full max-w-[430px] px-4 safe-pb pb-4">
                <Card className="p-4 space-y-2">
                  {listingType === "service" && serviceMode === "book" ? (
                    <Button onClick={bookOnly}>Book service</Button>
                  ) : canChat ? (
                    <>
                      <Button onClick={continueInChatQuickOrder} disabled={!canQuickOrderChat}>
                        Continue in Chat
                      </Button>
                      <Button variant="secondary" onClick={add} disabled={outOfStock}>
                        {outOfStock ? "Out of stock" : "Add to cart"}
                      </Button>
                    </>
                  ) : (
                    <Button onClick={add} disabled={outOfStock}>
                      {outOfStock ? "Out of stock" : "Add to cart"}
                    </Button>
                  )}

                  <Button variant="secondary" onClick={() => router.push(`/b/${slug}`)}>
                    Back to store
                  </Button>

                  {canChat && !canQuickOrderChat ? (
                    <p className="text-[11px] text-biz-muted">
                      Select delivery option and enter delivery location (for delivery) to continue in chat.
                    </p>
                  ) : null}
                </Card>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}