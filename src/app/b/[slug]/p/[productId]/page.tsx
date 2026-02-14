"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CloudImage } from "@/components/CloudImage";
import { db } from "@/lib/firebase/client";
import { doc, getDoc } from "firebase/firestore";
import { useCart } from "@/lib/cart/CartContext";
import { track } from "@/lib/track/client";
import { toast } from "@/lib/ui/toast";
import {
  BadgeCheck,
  ShoppingCart,
  Package,
  Truck,
  MessageCircle,
  AlertCircle,
  Tag,
} from "lucide-react";
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
  const optionGroups: OptionGroup[] = useMemo(
    () => (Array.isArray(p?.optionGroups) ? p.optionGroups : []),
    [p]
  );

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

  // Load trust badge
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

  // Load product
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

  // Load shipping
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

  // Load chat availability
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
    toast.info("To book this service, you'll message the vendor on WhatsApp from the vendor page.");
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

  const activeUrl = images.length
    ? images[Math.max(0, Math.min(activeImg, images.length - 1))]
    : "";
  const mainWH = coverAspectToWH(coverAspect, 980);

  return (
    <div className="min-h-screen bg-gray-50/30">
      <GradientHeader
        title={listingType === "service" ? "Service" : "Product"}
        showBack={true}
        subtitle={slug ? `Vendor: ${slug}` : undefined}
        right={
          <button
            className="relative flex items-center gap-1.5 rounded-full border border-gray-100 bg-white px-3 py-2 text-xs font-semibold text-gray-600 shadow-sm"
            onClick={() => router.push("/cart")}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            Cart
            {cartCount > 0 ? (
              <span className="absolute -top-2 -right-2 min-w-5 h-5 px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
                {cartCount}
              </span>
            ) : null}
          </button>
        }
      />

      <div className="px-4 pb-32 space-y-6 max-w-[1100px] mx-auto">
        {/* Loading skeleton */}
        {loading ? (
          <>
            <Card className="p-4">
              <div className="aspect-square w-full rounded-3xl bg-gray-100 animate-pulse" />
              <div className="mt-4 space-y-2">
                <div className="h-5 w-3/4 rounded bg-gray-100 animate-pulse" />
                <div className="h-4 w-1/3 rounded bg-gray-100 animate-pulse" />
                <div className="h-3 w-full rounded bg-gray-100 animate-pulse" />
                <div className="h-3 w-2/3 rounded bg-gray-100 animate-pulse" />
              </div>
            </Card>
          </>
        ) : null}

        {/* Error */}
        {msg && !loading ? (
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-red-700">Error</p>
                <p className="text-xs text-gray-500 mt-0.5">{msg}</p>
              </div>
            </div>
          </Card>
        ) : null}

        {!loading && p ? (
          <>
            {/* Product image + details */}
            <Card className="p-4">
              <div
                className={`${coverAspectClass} w-full rounded-3xl bg-gradient-to-br from-gray-100 to-gray-50 overflow-hidden relative`}
              >
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
                  <div className="h-full w-full flex items-center justify-center text-xs text-gray-400">
                    <Package className="h-8 w-8 text-gray-300" />
                  </div>
                )}

                {onSale ? (
                  <div className="absolute top-3 left-3 flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Tag className="h-3 w-3" />
                    {saleBadgeText(p)}
                  </div>
                ) : null}
              </div>

              {/* Thumbnail strip */}
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
                          "h-14 w-14 rounded-2xl overflow-hidden border-2 shrink-0 transition",
                          active
                            ? "border-orange-400 shadow-sm"
                            : "border-gray-100 bg-white",
                        ].join(" ")}
                        aria-label={`Image ${idx + 1}`}
                      >
                        <CloudImage
                          src={u}
                          alt={`Preview ${idx + 1}`}
                          w={160}
                          h={160}
                          sizes="56px"
                          className="h-full w-full object-cover"
                        />
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {/* Name + trust badge */}
              <div className="mt-4 flex items-center gap-2 flex-wrap">
                <p className="text-lg font-bold text-gray-900">{p?.name}</p>

                {storeTrustBadge === "earned_apex" ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Verified Apex
                  </span>
                ) : null}

                {storeTrustBadge === "temporary_apex" ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Apex
                  </span>
                ) : null}
              </div>

              {/* Price */}
              <div className="mt-2">
                {bookOnly ? (
                  <p className="text-sm font-medium text-gray-500">Book only</p>
                ) : onSale ? (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm line-through text-gray-400">
                      {fmtNaira(baseUnitPriceNgn)}
                    </span>
                    <span className="text-lg font-black text-emerald-600">
                      {fmtNaira(unitPriceNgn)}
                    </span>
                  </div>
                ) : (
                  <p className="text-lg font-black text-gray-900">
                    {fmtNaira(baseUnitPriceNgn)}
                  </p>
                )}
              </div>

              {/* Stock / type + packaging */}
              <div className="mt-3 flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Package className="h-3.5 w-3.5" />
                  {listingType === "product" ? (
                    <span>
                      Stock: <span className="font-semibold text-gray-900">{Number(p?.stock ?? 0)}</span>
                    </span>
                  ) : (
                    <span>
                      Type: <span className="font-semibold text-gray-900">Service</span>
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500">
                  Packaging:{" "}
                  <span className="font-semibold text-gray-900">{p?.packaging || "—"}</span>
                </div>
              </div>

              {/* Description */}
              {p?.description ? (
                <p className="mt-4 text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
                  {String(p.description)}
                </p>
              ) : null}
            </Card>

            {/* Options / Variations */}
            {optionGroups.length ? (
              <SectionCard
                title="Variations"
                subtitle="Optional choices (price/stock stays the same)"
              >
                <div className="space-y-4">
                  {optionGroups.map((g) => (
                    <div key={g.name}>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-900">{g.name}</p>
                        {selected[g.name] ? (
                          <button
                            className="text-xs font-semibold text-orange-600"
                            onClick={() => pick(g.name, selected[g.name])}
                          >
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
                                  ? "px-4 py-2 rounded-full text-xs font-bold text-white bg-gradient-to-br from-orange-500 to-orange-600 shadow-sm"
                                  : "px-4 py-2 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
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

            {/* Shipping options */}
            {shippingOptions.length > 0 ? (
              <SectionCard title="Delivery" subtitle="Select a delivery or pickup option">
                <div className="space-y-2">
                  {shippingOptions.map((opt) => {
                    const active = selectedShipId === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setSelectedShipId(opt.id)}
                        className={[
                          "w-full text-left rounded-2xl border p-3 transition",
                          active
                            ? "border-orange-300 ring-2 ring-orange-100"
                            : "border-gray-100 hover:bg-gray-50/50",
                        ].join(" ")}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className={[
                              "mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center",
                              active ? "border-orange-500" : "border-gray-300",
                            ].join(" ")}
                          >
                            {active ? (
                              <div className="h-2.5 w-2.5 rounded-full bg-orange-500" />
                            ) : null}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <Truck className="h-3.5 w-3.5 text-gray-400" />
                              <p className="text-sm font-bold text-gray-900">{opt.name}</p>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 capitalize">
                                {opt.type}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              Fee: {opt.feeKobo === 0 ? "Free" : fmtNaira(opt.feeKobo / 100)}
                              {opt.etaDays ? ` · ${opt.etaDays} day${opt.etaDays > 1 ? "s" : ""}` : ""}
                            </p>
                            {opt.areasText ? (
                              <p className="text-[11px] text-gray-400 mt-0.5">{opt.areasText}</p>
                            ) : null}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Delivery location input */}
                {selectedShipping && selectedShipping.type !== "pickup" ? (
                  <div className="mt-3">
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Delivery location
                    </label>
                    <Input
                      placeholder="Enter your delivery address"
                      value={deliveryLocation}
                      onChange={(e) => setDeliveryLocation(e.target.value)}
                    />
                  </div>
                ) : null}
              </SectionCard>
            ) : null}

            {shipMsg ? (
              <Card className="p-3">
                <p className="text-xs text-gray-500">{shipMsg}</p>
              </Card>
            ) : null}

            {/* Fixed bottom CTA */}
            <div className="fixed bottom-0 left-0 right-0 z-40">
              <div className="mx-auto w-full max-w-[430px] px-4 safe-pb pb-4">
                <Card className="p-4 space-y-2">
                  {bookOnly ? (
                    <Button onClick={bookOnlyHandler}>Book service</Button>
                  ) : canChat ? (
                    <>
                      <Button onClick={continueInChatQuickOrder} disabled={!canQuickOrderChat}>
                        <MessageCircle className="h-4 w-4 mr-1.5" />
                        Continue in Chat
                      </Button>
                      <Button variant="secondary" onClick={add} disabled={outOfStock}>
                        <ShoppingCart className="h-4 w-4 mr-1.5" />
                        {outOfStock ? "Out of stock" : "Add to cart"}
                      </Button>
                    </>
                  ) : (
                    <Button onClick={add} disabled={outOfStock}>
                      <ShoppingCart className="h-4 w-4 mr-1.5" />
                      {outOfStock ? "Out of stock" : "Add to cart"}
                    </Button>
                  )}

                  <Button variant="secondary" onClick={() => router.push(`/b/${slug}`)}>
                    Back to vendor
                  </Button>

                  {canChat && !canQuickOrderChat ? (
                    <p className="text-[11px] text-gray-400 text-center">
                      Select delivery option and enter delivery location to continue in chat.
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

