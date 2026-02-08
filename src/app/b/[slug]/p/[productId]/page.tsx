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
import { CloudImage } from "@/components/CloudImage";
import { BadgeCheck } from "lucide-react";
import { toast } from "@/lib/ui/toast";
import {
  normalizeCoverAspect,
  coverAspectToTailwindClass,
  coverAspectToWH,
  type CoverAspectKey,
} from "@/lib/products/coverAspect";

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
    return `₦${Number(n || 0).toLocaleString("en-NG")}`;
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
  } catch {}
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

/** --- Sale helpers (display + client pricing) --- */
function saleIsActive(p: any, now = Date.now()) {
  if (p?.saleActive !== true) return false;

  const start = Number(p?.saleStartsAtMs || 0);
  const end = Number(p?.saleEndsAtMs || 0);

  if (start && now < start) return false;
  if (end && now > end) return false;

  const t = String(p?.saleType || "");
  return t === "percent" || t === "fixed";
}

function computeSalePriceNgn(p: any) {
  const base = Number(p?.price || 0);
  if (!Number.isFinite(base) || base <= 0) return 0;
  if (!saleIsActive(p)) return Math.floor(base);

  const t = String(p?.saleType || "");
  if (t === "fixed") {
    const off = Number(p?.saleAmountOffNgn || 0);
    return Math.max(0, Math.floor(base - Math.max(0, off)));
  }

  const pct = Math.max(0, Math.min(90, Number(p?.salePercent || 0)));
  const off = Math.floor((base * pct) / 100);
  return Math.max(0, Math.floor(base - off));
}

function saleBadgeText(p: any) {
  const t = String(p?.saleType || "");
  if (t === "fixed") {
    const off = Number(p?.saleAmountOffNgn || 0);
    return off > 0 ? `${fmtNaira(off)} OFF` : "Sale";
  }
  const pct = Number(p?.salePercent || 0);
  return pct > 0 ? `${pct}% OFF` : "Sale";
}

type TrustBadgeType = "earned_apex" | "temporary_apex" | null;

function trustBadgeTypeFromTrust(j: any): TrustBadgeType {
  const badge = j?.badge || null;
  if (badge?.active === true) {
    const t = String(badge?.type || "");
    if (t === "earned_apex" || t === "temporary_apex") return t as any;
  }
  if (j?.apexBadgeActive === true) return "earned_apex";
  if (j?.temporaryApexBadgeActive === true) return "temporary_apex";
  return null;
}

export default function ProductPage() {
  const router = useRouter();
  const params = useParams();
  const slug = String((params as any)?.slug ?? "");
  const productId = String((params as any)?.productId ?? "");

  const { addToCart, cart } = useCart();

  const [loading, setLoading] = useState(true);
  const [p, setP] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, string>>({});

  const [storeTrustBadge, setStoreTrustBadge] = useState<TrustBadgeType>(null);

  const [activeImg, setActiveImg] = useState(0);

  const [qty, setQty] = useState<number>(1);
  const [deliveryLocation, setDeliveryLocation] = useState<string>("");

  const [shipLoading, setShipLoading] = useState(false);
  const [shipMsg, setShipMsg] = useState<string | null>(null);
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShipId, setSelectedShipId] = useState<string>("");

  const [chatAvail, setChatAvail] = useState<ChatAvailability | null>(null);

  const images: string[] = useMemo(() => (Array.isArray(p?.images) ? p.images : []), [p]);
  const optionGroups: OptionGroup[] = useMemo(() => (Array.isArray(p?.optionGroups) ? p.optionGroups : []), [p]);

  const coverAspect: CoverAspectKey = normalizeCoverAspect(p?.coverAspect) ?? "1:1";
  const coverAspectClass = coverAspectToTailwindClass(coverAspect);

  useEffect(() => {
    setActiveImg(0);
  }, [images.length, productId]);

  const selectedOptionsClean = useMemo(() => {
    const out: Record<string, string> = {};
    for (const g of optionGroups) {
      const v = selected[g.name];
      if (v) out[g.name] = v;
    }
    return out;
  }, [selected, optionGroups]);

  const listingType = String(p?.listingType || "product");
  const serviceMode = String(p?.serviceMode || "book");

  const isService = listingType === "service";
  const bookOnly = isService && serviceMode === "book";

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

  const baseUnitPriceNgn = Number(p?.price || 0);
  const onSale = !!p && !bookOnly && saleIsActive(p);
  const unitPriceNgn = onSale ? computeSalePriceNgn(p) : Math.floor(baseUnitPriceNgn);

  const itemsSubtotalNgn = Math.max(0, Math.floor(Number(qty || 1)) * unitPriceNgn);
  const estimatedTotalNgn = itemsSubtotalNgn + shippingFeeNgn;

  const cartCount = useMemo(() => {
    const items = Array.isArray(cart?.items) ? cart.items : [];
    return items.reduce((s: number, it: any) => s + Math.max(0, Number(it?.qty || 0)), 0);
  }, [cart]);

  const canQuickOrderChat = useMemo(() => {
    const q = Math.max(1, Math.floor(Number(qty || 1)));
    if (!p) return false;
    if (!canChat) return false;
    if (bookOnly) return false;
    if (outOfStock) return false;
    if (shippingRequired && !selectedShipping) return false;
    if (selectedShipping?.type !== "pickup") {
      if (deliveryLocation.trim().length < 2) return false;
    }
    return q >= 1;
  }, [qty, p, canChat, bookOnly, outOfStock, shippingRequired, selectedShipping, deliveryLocation]);

  useEffect(() => {
    let mounted = true;

    fetch(`/api/public/store/${encodeURIComponent(slug)}/trust`)
      .then((r) => r.json())
      .then((j) => {
        if (!mounted) return;
        setStoreTrustBadge(trustBadgeTypeFromTrust(j));
      })
      .catch(() => {});

    return () => {
      mounted = false;
    };
  }, [slug]);

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
          setMsg("This listing does not belong to this vendor.");
          setP(null);
          return;
        }

        if (!mounted) return;
        setP(data);

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
        price: unitPriceNgn,
        imageUrl: images[0],
        selectedOptions: selectedOptionsClean,
      },
      1
    );

    toast.success("Added to cart.");
  }

  function bookOnlyHandler() {
    toast.info("To book this service, you’ll message the vendor on WhatsApp from the vendor page.");
    router.push(`/b/${slug}`);
  }

  async function continueInChatQuickOrder() {
    try {
      if (!p) return;
      if (!canChat) return;

      const whatsapp = String(chatAvail?.whatsapp || "");
      if (!whatsapp) return;

      const q = Math.max(1, Math.floor(Number(qty || 1)));
      const clientOrderId = makeClientOrderId();

      const payload = {
        storeSlug: slug,
        clientOrderId,
        items: [
          {
            productId: String(p.id),
            name: String(p?.name || "Item"),
            qty: q,
            price: unitPriceNgn,
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
      } catch {}

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
      lines.push(`I want to place a quick order from your myBizHub store.`);
      lines.push(``);

      if (onSale) {
        lines.push(`Sale applied: ${saleBadgeText(p)}`);
        lines.push(`Original unit price: ${fmtNaira(baseUnitPriceNgn)}`);
        lines.push(`Sale unit price: ${fmtNaira(unitPriceNgn)}`);
        lines.push(``);
      }

      lines.push(`- ${q} × ${String(p?.name || "Item")}${optsTxt}`);
      lines.push(`Items subtotal: ${fmtNaira(itemsSubtotalNgn)}`);
      lines.push(``);
      lines.push(`Delivery option: ${shipLabel}`);

      if (selectedShipping?.type !== "pickup") {
        lines.push(`Delivery location: ${deliveryLocation.trim() || "To be confirmed"}`);
      } else {
        lines.push(`Pickup: I will come to pick up.`);
      }

      if (selectedShipping) lines.push(`Estimated shipping fee: ${fmtNaira(shippingFeeNgn)}`);

      lines.push(`Estimated total: ${fmtNaira(estimatedTotalNgn)}`);
      lines.push(``);
      lines.push(`myBizHub chat order ref: ${refShort}`);

      window.open(waLink(whatsapp, lines.join("\n")), "_blank");
    } catch (e: any) {
      setMsg(e?.message || "Failed to open chat");
    }
  }

  const activeUrl = images.length ? images[Math.max(0, Math.min(activeImg, images.length - 1))] : "";

  const mainWH = coverAspectToWH(coverAspect, 980);

  return (
    <div className="min-h-screen">
      <GradientHeader
        title={listingType === "service" ? "Service" : "Product"}
        showBack={true}
        subtitle={slug ? `Vendor: ${slug}` : undefined}
        right={
          <button
            className="rounded-2xl border border-biz-line bg-white px-3 py-2 text-xs font-extrabold shadow-soft relative"
            onClick={() => router.push("/cart")}
          >
            Cart
            {cartCount > 0 ? (
              <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-biz-accent text-white text-[10px] font-extrabold flex items-center justify-center">
                {cartCount}
              </span>
            ) : null}
          </button>
        }
      />

      <div className="px-4 pb-24 space-y-3">
        {loading ? <Card className="p-4">Loading…</Card> : null}
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}

        {!loading && p ? (
          <>
            <Card className="p-4">
              <div className={`${coverAspectClass} w-full rounded-3xl bg-gradient-to-br from-biz-sand to-biz-cream overflow-hidden relative`}>
                {activeUrl ? (
                  <CloudImage
                    src={activeUrl}
                    alt={p?.name || "Item"}
                    w={mainWH.w}
                    h={mainWH.h}
                    priority={true}
                    sizes="(max-width: 430px) 100vw, 430px"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-xs text-gray-500">No image</div>
                )}

                {onSale ? (
                  <div className="absolute top-3 left-3 px-3 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-100">
                    {saleBadgeText(p)}
                  </div>
                ) : null}
              </div>

              {images.length > 1 ? (
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {images.slice(0, 10).map((u, idx) => {
                    const active = idx === activeImg;
                    return (
                      <button
                        key={`${u}_${idx}`}
                        type="button"
                        onClick={() => setActiveImg(idx)}
                        className={[
                          "h-14 w-14 rounded-2xl overflow-hidden border shrink-0",
                          active ? "border-biz-accent shadow-soft" : "border-biz-line bg-white",
                        ].join(" ")}
                        aria-label={`Image ${idx + 1}`}
                      >
                        <CloudImage src={u} alt={`Preview ${idx + 1}`} w={160} h={160} sizes="56px" className="h-full w-full object-cover" />
                      </button>
                    );
                  })}
                </div>
              ) : null}

              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <p className="text-lg font-extrabold text-biz-ink">{p?.name}</p>

                {storeTrustBadge === "earned_apex" ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-100">
                    <BadgeCheck className="h-4 w-4" />
                    Verified Apex
                  </span>
                ) : null}

                {storeTrustBadge === "temporary_apex" ? (
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-extrabold bg-white text-orange-700 border border-orange-200">
                    <BadgeCheck className="h-4 w-4" />
                    Apex (Temporary)
                  </span>
                ) : null}
              </div>

              <div className="mt-1 text-sm text-gray-700">
                {bookOnly ? (
                  "Book only"
                ) : onSale ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="line-through text-gray-400">{fmtNaira(baseUnitPriceNgn)}</span>
                    <span className="font-extrabold text-emerald-700">{fmtNaira(unitPriceNgn)}</span>
                  </div>
                ) : (
                  fmtNaira(baseUnitPriceNgn)
                )}
              </div>

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

              {p?.description ? <p className="mt-3 text-sm text-gray-700 whitespace-pre-wrap">{String(p.description)}</p> : null}
            </Card>

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

            <div className="fixed bottom-0 left-0 right-0 z-40">
              <div className="mx-auto w-full max-w-[430px] px-4 safe-pb pb-4">
                <Card className="p-4 space-y-2">
                  {bookOnly ? (
                    <Button onClick={bookOnlyHandler}>Book service</Button>
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
                    Back to vendor
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