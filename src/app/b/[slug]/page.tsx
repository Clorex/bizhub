"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { db } from "@/lib/firebase/client";
import { collection, getDocs, limit, query, where, orderBy } from "firebase/firestore";
import { track } from "@/lib/track/client";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Store, Phone, Package, ShoppingCart, Plus, BadgeCheck } from "lucide-react";
import { useCart } from "@/lib/cart/CartContext";
import { CloudImage } from "@/components/CloudImage";

function fmtNaira(n: number) {
  try {
    return `₦${Number(n || 0).toLocaleString("en-NG")}`;
  } catch {
    return `₦${n}`;
  }
}

function waLink(wa: string, text: string) {
  const digits = wa.replace(/[^\d]/g, "");
  const t = encodeURIComponent(text);
  return `https://wa.me/${digits}?text=${t}`;
}

/** --- Sale helpers --- */
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

function ProductTileWithAdd({
  title,
  subtitle,
  image,
  badges,
  onOpen,
  onQuickAdd,
  canQuickAdd,
}: {
  title: string;
  subtitle?: React.ReactNode;
  image?: string;
  badges?: string[];
  onOpen: () => void;
  onQuickAdd: () => void;
  canQuickAdd: boolean;
}) {
  return (
    <div className="w-full">
      <Card className="p-3 hover:bg-black/[0.02] transition cursor-pointer" onClick={onOpen}>
        <div className="h-24 w-full rounded-2xl bg-gradient-to-br from-biz-sand to-biz-cream overflow-hidden relative">
          {image ? (
            <CloudImage
              src={image}
              alt={title}
              w={420}
              h={240}
              sizes="(max-width: 430px) 45vw, 200px"
              className="h-full w-full object-cover"
            />
          ) : null}

          {badges?.length ? (
            <div className="absolute top-2 left-2 flex flex-wrap gap-1">
              {badges.slice(0, 2).map((b) => (
                <div
                  key={b}
                  className={
                    b.toLowerCase().includes("off") || b.toLowerCase().includes("sale")
                      ? "px-2 py-1 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-100"
                      : "px-2 py-1 rounded-full text-[10px] font-extrabold bg-white/90 border border-black/5"
                  }
                >
                  {b}
                </div>
              ))}
            </div>
          ) : null}

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!canQuickAdd) return;
              onQuickAdd();
            }}
            disabled={!canQuickAdd}
            className={[
              "absolute bottom-2 right-2 h-9 w-9 rounded-2xl flex items-center justify-center",
              canQuickAdd
                ? "bg-gradient-to-br from-biz-accent2 to-biz-accent text-white shadow-float"
                : "bg-white/80 text-gray-400 border border-black/10",
            ].join(" ")}
            aria-label={canQuickAdd ? "Add to cart" : "View product"}
            title={canQuickAdd ? "Add to cart" : "View product"}
          >
            {canQuickAdd ? <Plus className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />}
          </button>
        </div>

        <p className="mt-2 text-sm font-extrabold text-biz-ink line-clamp-2">{title}</p>
        {subtitle ? <div className="mt-1 text-xs text-biz-muted">{subtitle}</div> : null}
      </Card>
    </div>
  );
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

export default function StorefrontPage() {
  const router = useRouter();
  const params = useParams();
  const slug = String((params as any)?.slug ?? "");

  const { addToCart, cart, clearCart } = useCart();

  const [biz, setBiz] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [trustBadge, setTrustBadge] = useState<TrustBadgeType>(null);

  // ✅ products only: filter out accidental services if any exist
  const products = useMemo(() => items.filter((x) => String(x.listingType || "product") !== "service"), [items]);

  const cartCount = useMemo(() => {
    const list = Array.isArray(cart?.items) ? cart.items : [];
    return list.reduce((s: number, it: any) => s + Math.max(0, Number(it?.qty || 0)), 0);
  }, [cart]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        setLoading(true);
        setMsg(null);

        const qBiz = query(collection(db, "businesses"), where("slug", "==", slug), limit(1));
        const snapBiz = await getDocs(qBiz);
        if (snapBiz.empty) throw new Error("Store not found");
        const b = { id: snapBiz.docs[0].id, ...snapBiz.docs[0].data() };

        const qP = query(
          collection(db, "products"),
          where("businessSlug", "==", slug),
          orderBy("createdAt", "desc"),
          limit(200)
        );
        const snapP = await getDocs(qP);
        const list = snapP.docs.map((d) => ({ id: d.id, ...d.data() }));

        if (!mounted) return;
        setBiz(b);
        setItems(list);

        if (b?.id) track({ type: "store_visit", businessId: b.id, businessSlug: slug });

        fetch(`/api/public/store/${encodeURIComponent(slug)}/trust`)
          .then((r) => r.json())
          .then((j) => {
            if (!mounted) return;
            setTrustBadge(trustBadgeTypeFromTrust(j));
          })
          .catch(() => {});
      } catch (e: any) {
        setMsg(e?.message || "Failed to load store");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (slug) run();
    return () => {
      mounted = false;
    };
  }, [slug]);

  function quickAdd(p: any) {
    if (!p) return;

    const existingStore = String(cart?.storeSlug || "");
    if (existingStore && existingStore !== slug) {
      const ok = confirm("Your cart has items from another store. Clear cart and add this item?");
      if (!ok) return;
      clearCart();
    }

    const img = Array.isArray(p?.images) ? p.images[0] : "";
    const base = Number(p?.price || 0);
    const onSale = saleIsActive(p);
    const finalPrice = onSale ? computeSalePriceNgn(p) : Math.floor(base);

    addToCart(
      slug,
      {
        productId: String(p.id),
        name: String(p?.name || "Product"),
        price: finalPrice,
        imageUrl: img || undefined,
        selectedOptions: undefined,
      },
      1
    );

    setToast("Added to cart");
  }

  const banner = String(biz?.bannerUrl || "");
  const logo = String(biz?.logoUrl || "");
  const name = String(biz?.name || slug);
  const about = String(biz?.description || "");
  const location = [biz?.city, biz?.state].filter(Boolean).join(", ");
  const whatsapp = String(biz?.whatsapp || "");
  const instagram = String(biz?.instagram || "");

  return (
    <div className="min-h-screen">
      <GradientHeader
        title={name}
        subtitle={location || `Store: ${slug}`}
        showBack={true}
        right={
          <button
            className="rounded-2xl border border-biz-line bg-white px-3 py-2 text-xs font-extrabold shadow-soft"
            onClick={() => router.push("/market")}
          >
            Market
          </button>
        }
      />

      <div className="px-4 pb-6 space-y-3">
        {loading ? <Card className="p-4">Loading…</Card> : null}
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}
        {toast ? <Card className="p-4 text-emerald-700">{toast}</Card> : null}

        {!loading && biz ? (
          <>
            <Card className="p-0 overflow-hidden">
              <div className="h-36 w-full bg-gradient-to-br from-biz-sand to-biz-cream overflow-hidden">
                {banner ? (
                  <CloudImage
                    src={banner}
                    alt="Banner"
                    w={980}
                    h={360}
                    sizes="(max-width: 430px) 100vw, 430px"
                    className="h-full w-full object-cover"
                  />
                ) : null}
              </div>

              <div className="p-4">
                <div className="flex items-start gap-3">
                  <div className="h-14 w-14 rounded-2xl bg-biz-cream overflow-hidden border border-biz-line shrink-0">
                    {logo ? (
                      <CloudImage src={logo} alt="Logo" w={160} h={160} sizes="56px" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Store className="h-6 w-6 text-orange-700" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-base font-extrabold text-biz-ink">{name}</p>

                      {trustBadge === "earned_apex" ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-100"
                          title="Verified Apex badge (earned + maintained)"
                        >
                          <BadgeCheck className="h-4 w-4" />
                          Verified Apex
                        </span>
                      ) : null}

                      {trustBadge === "temporary_apex" ? (
                        <span
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-extrabold bg-white text-orange-700 border border-orange-200"
                          title="Temporary / probation Apex badge"
                        >
                          <BadgeCheck className="h-4 w-4" />
                          Apex (Temporary)
                        </span>
                      ) : null}
                    </div>

                    <p className="text-xs text-biz-muted mt-1">{location || "Nigeria"}</p>
                    {instagram ? <p className="text-xs text-biz-muted mt-1">@{instagram.replace(/^@/, "")}</p> : null}
                  </div>
                </div>

                {about ? <p className="mt-3 text-sm text-gray-700 whitespace-pre-wrap">{about}</p> : null}

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    leftIcon={<Phone className="h-4 w-4" />}
                    onClick={() => {
                      if (!whatsapp) {
                        alert("Vendor WhatsApp not set yet.");
                        return;
                      }
                      window.open(waLink(whatsapp, `Hello ${name}. I came from your BizHub store (${slug}).`), "_blank");
                    }}
                    disabled={!whatsapp}
                  >
                    WhatsApp
                  </Button>

                  <Button variant="secondary" leftIcon={<Package className="h-4 w-4" />} onClick={() => router.push("/cart")}>
                    <span className="inline-flex items-center gap-2">
                      Cart
                      {cartCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full bg-biz-accent text-white text-[11px] font-extrabold">
                          {cartCount > 99 ? "99+" : cartCount}
                        </span>
                      ) : null}
                    </span>
                  </Button>
                </div>
              </div>
            </Card>

            <SectionCard title="Products" subtitle="Shop items from this store">
              {products.length === 0 ? (
                <EmptyState
                  title="No products yet"
                  description="This store hasn’t added products yet."
                  ctaLabel="Back to market"
                  onCta={() => router.push("/market")}
                />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {products.map((p: any) => {
                    const img = Array.isArray(p?.images) ? p.images[0] : "";
                    const boosted = Number(p?.boostUntilMs || 0) > Date.now();

                    const onSale = saleIsActive(p);
                    const base = Number(p?.price || 0);
                    const final = onSale ? computeSalePriceNgn(p) : base;

                    const subtitle = onSale ? (
                      <>
                        <span className="line-through text-gray-400 mr-1">{fmtNaira(base)}</span>
                        <span className="text-emerald-700 font-extrabold">{fmtNaira(final)}</span>
                      </>
                    ) : (
                      fmtNaira(base)
                    );

                    const badges: string[] = [];
                    if (boosted) badges.push("Promoted");
                    if (onSale) badges.push(saleBadgeText(p));

                    const hasOptions = Array.isArray(p?.optionGroups) && p.optionGroups.length > 0;
                    const outOfStock = Number(p?.stock ?? 0) <= 0;
                    const canQuickAdd = !hasOptions && !outOfStock;

                    return (
                      <ProductTileWithAdd
                        key={p.id}
                        title={p?.name || "Product"}
                        subtitle={subtitle}
                        image={img}
                        badges={badges.length ? badges : undefined}
                        canQuickAdd={canQuickAdd}
                        onOpen={() => {
                          track({ type: "store_product_click", businessId: biz.id, businessSlug: slug, productId: p.id });
                          router.push(`/b/${slug}/p/${p.id}`);
                        }}
                        onQuickAdd={() => quickAdd(p)}
                      />
                    );
                  })}
                </div>
              )}
            </SectionCard>
          </>
        ) : null}
      </div>
    </div>
  );
}