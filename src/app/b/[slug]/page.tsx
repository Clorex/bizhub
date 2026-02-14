// FILE: src/app/b/[slug]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { db } from "@/lib/firebase/client";
import { collection, getDocs, limit, query, where, orderBy } from "firebase/firestore";
import { track } from "@/lib/track/client";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import {
  Store,
  Phone,
  Package,
  ShoppingCart,
  Plus,
  BadgeCheck,
  MapPin,
  Instagram,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { useCart } from "@/lib/cart/CartContext";
import { CloudImage } from "@/components/CloudImage";
import { toast } from "@/lib/ui/toast";
import { cn } from "@/lib/cn";
import {
  normalizeCoverAspect,
  coverAspectToTailwindClass,
  coverAspectToWH,
  type CoverAspectKey,
} from "@/lib/products/coverAspect";
import { getThemeById, getDefaultTheme, type StoreTheme } from "@/lib/themes/storeThemes";
import { formatMoneyNGN } from "@/lib/money";

/* ----------------------- Helpers ----------------------- */

function fmtNaira(n: number) {
  return formatMoneyNGN(Number(n || 0));
}

function waLink(wa: string, text: string) {
  const digits = wa.replace(/[^\d]/g, "");
  const t = encodeURIComponent(text);
  return `https://wa.me/${digits}?text=${t}`;
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

/* ----------------------- Themed Header Component ----------------------- */

function ThemedStoreHeader({
  theme,
  name,
  location,
  onBack,
  onCart,
  cartCount,
}: {
  theme: StoreTheme;
  name: string;
  location: string;
  onBack: () => void;
  onCart: () => void;
  cartCount: number;
}) {
  return (
    <div className="relative overflow-hidden" style={{ background: theme.headerGradient }}>
      {theme.headerOverlay && (
        <div className="absolute inset-0 pointer-events-none" style={{ background: theme.headerOverlay }} />
      )}

      {theme.hasAnimation && theme.animationType === "shimmer" && (
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer" />
        </div>
      )}

      {theme.hasAnimation && theme.animationType === "gradient" && (
        <div
          className="absolute inset-0 pointer-events-none animate-gradient"
          style={{ background: theme.headerGradient, backgroundSize: "200% 200%" }}
        />
      )}

      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />

      <div className="relative z-10 safe-pt">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <button
              onClick={onBack}
              className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition"
            >
              <ChevronLeft className="w-5 h-5" style={{ color: theme.headerTextColor }} />
            </button>

            <div className="flex-1 mx-4 text-center">
              <h1 className="text-lg font-bold truncate" style={{ color: theme.headerTextColor }}>
                {name}
              </h1>
              {location && (
                <p
                  className="text-xs opacity-80 flex items-center justify-center gap-1 mt-0.5"
                  style={{ color: theme.headerTextColor }}
                >
                  <MapPin className="w-3 h-3" />
                  {location}
                </p>
              )}
            </div>

            <button
              onClick={onCart}
              className="relative w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center hover:bg-white/30 transition"
            >
              <ShoppingCart className="w-5 h-5" style={{ color: theme.headerTextColor }} />
              {cartCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center"
                  style={{ background: theme.primaryColor, color: theme.buttonText }}
                >
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------- Themed Product Card ----------------------- */

function ThemedProductCard({
  theme,
  product,
  onOpen,
  onQuickAdd,
  canQuickAdd,
}: {
  theme: StoreTheme;
  product: any;
  onOpen: () => void;
  onQuickAdd: () => void;
  canQuickAdd: boolean;
}) {
  const img = Array.isArray(product?.images) ? product.images[0] : "";
  const boosted = Number(product?.boostUntilMs || 0) > Date.now();
  const onSale = saleIsActive(product);
  const base = Number(product?.price || 0);
  const final = onSale ? computeSalePriceNgn(product) : base;

  const aspect: CoverAspectKey = normalizeCoverAspect(product?.coverAspect) ?? "1:1";
  const aspectClass = coverAspectToTailwindClass(aspect);
  const { w, h } = coverAspectToWH(aspect, 520);

  const badges: string[] = [];
  if (boosted) badges.push("Promoted");
  if (onSale) badges.push(saleBadgeText(product));

  return (
    <div className="w-full">
      <div
        className="rounded-2xl overflow-hidden transition-all hover:shadow-lg cursor-pointer"
        style={{
          backgroundColor: theme.cardBg,
          borderColor: theme.cardBorder,
          borderWidth: 1,
        }}
        onClick={onOpen}
      >
        <div className={cn(aspectClass, "w-full overflow-hidden relative bg-gray-100")}>
          {img ? (
            <CloudImage
              src={img}
              alt={product?.name || "Product"}
              w={w}
              h={h}
              sizes="(max-width: 430px) 45vw, 200px"
              className="h-full w-full object-cover"
            />
          ) : (
            <div
              className="h-full w-full flex items-center justify-center"
              style={{ backgroundColor: theme.primaryLight }}
            >
              <Package className="w-8 h-8" style={{ color: theme.textMuted }} />
            </div>
          )}

          {badges.length > 0 && (
            <div className="absolute top-2 left-2 flex flex-wrap gap-1">
              {badges.map((badge) => (
                <span
                  key={badge}
                  className="px-2 py-1 rounded-full text-[10px] font-bold"
                  style={{
                    backgroundColor:
                      badge.includes("OFF") || badge === "Sale" ? theme.saleBadgeBg : theme.badgeBg,
                    color:
                      badge.includes("OFF") || badge === "Sale" ? theme.saleBadgeText : theme.badgeText,
                  }}
                >
                  {badge}
                </span>
              ))}
            </div>
          )}

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (canQuickAdd) onQuickAdd();
            }}
            disabled={!canQuickAdd}
            className={cn(
              "absolute bottom-2 right-2 w-9 h-9 rounded-xl flex items-center justify-center transition-all",
              canQuickAdd ? "shadow-lg hover:scale-105" : "opacity-60"
            )}
            style={{
              background: canQuickAdd ? theme.buttonGradient : theme.cardBg,
              color: canQuickAdd ? theme.buttonText : theme.textMuted,
              borderWidth: canQuickAdd ? 0 : 1,
              borderColor: theme.cardBorder,
            }}
          >
            {canQuickAdd ? <Plus className="w-5 h-5" /> : <ShoppingCart className="w-4 h-4" />}
          </button>
        </div>

        <div className="p-3">
          <p className="text-sm font-bold line-clamp-2" style={{ color: theme.textPrimary }}>
            {product?.name || "Product"}
          </p>

          <div className="mt-1.5">
            {onSale ? (
              <div className="flex items-center gap-2">
                <span className="text-xs line-through" style={{ color: theme.textMuted }}>
                  {fmtNaira(base)}
                </span>
                <span className="text-sm font-bold" style={{ color: theme.saleBadgeText }}>
                  {fmtNaira(final)}
                </span>
              </div>
            ) : (
              <span className="text-sm font-bold" style={{ color: theme.primaryColor }}>
                {fmtNaira(base)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------- Main Component ----------------------- */

export default function StorefrontPage() {
  const router = useRouter();
  const params = useParams();
  const slug = String((params as any)?.slug ?? "");

  const { addToCart, cart, clearCart } = useCart();

  const [biz, setBiz] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // New: store trust + plan entitlements (Apex)
  const [verificationTier, setVerificationTier] = useState<number>(0);
  const [apexActive, setApexActive] = useState<boolean>(false);

  const theme = useMemo(() => {
    const themeId = biz?.themeId || "classic";
    return getThemeById(themeId) || getDefaultTheme();
  }, [biz]);

  const products = useMemo(
    () => items.filter((x) => String(x.listingType || "product") !== "service"),
    [items]
  );

  const cartCount = useMemo(() => {
    const list = Array.isArray(cart?.items) ? cart.items : [];
    return list.reduce((s: number, it: any) => s + Math.max(0, Number(it?.qty || 0)), 0);
  }, [cart]);

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

        // Trust + plan/entitlements (Apex)
        fetch(`/api/public/store/${encodeURIComponent(slug)}/trust`)
          .then((r) => r.json())
          .then((j) => {
            if (!mounted) return;
            setVerificationTier(Number(j?.trust?.verificationTier || 0));
            setApexActive(!!j?.entitlements?.apexActive);
          })
          .catch(() => {});
      } catch (e: any) {
        setMsg(e?.message || "Could not load this store.");
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

    toast.success("Added to cart!");
  }

  const banner = String(biz?.bannerUrl || "");
  const logo = String(biz?.logoUrl || "");
  const name = String(biz?.name || slug);
  const about = String(biz?.description || "");
  const location = [biz?.city, biz?.state].filter(Boolean).join(", ");
  const whatsapp = String(biz?.whatsapp || "");
  const instagram = String(biz?.instagram || "");

  if (loading) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: theme.pageBg }}>
        <div className="h-32 animate-pulse" style={{ background: theme.headerGradient }} />
        <div className="px-4 py-4 space-y-4">
          <div className="h-40 rounded-2xl animate-pulse" style={{ backgroundColor: theme.cardBorder }} />
          <div className="h-8 w-32 rounded-xl animate-pulse" style={{ backgroundColor: theme.cardBorder }} />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 rounded-2xl animate-pulse" style={{ backgroundColor: theme.cardBorder }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (msg) {
    return (
      <div className="min-h-screen" style={{ backgroundColor: theme.pageBg }}>
        <ThemedStoreHeader
          theme={theme}
          name="Store"
          location=""
          onBack={() => router.push("/market")}
          onCart={() => router.push("/cart")}
          cartCount={0}
        />
        <div className="px-4 py-8">
          <div
            className="rounded-2xl p-6 text-center"
            style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: 1 }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: theme.primaryLight }}
            >
              <Store className="w-8 h-8" style={{ color: theme.primaryColor }} />
            </div>
            <p className="text-lg font-bold" style={{ color: theme.textPrimary }}>
              Store Not Found
            </p>
            <p className="text-sm mt-2" style={{ color: theme.textSecondary }}>
              {msg}
            </p>
            <Button className="mt-6" onClick={() => router.push("/market")}>
              Browse marketplace
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-8" style={{ backgroundColor: theme.pageBg }}>
      <ThemedStoreHeader
        theme={theme}
        name={name}
        location={location}
        onBack={() => router.back()}
        onCart={() => router.push("/cart")}
        cartCount={cartCount}
      />

      <div className="px-4 space-y-6 pt-6 max-w-[1100px] mx-auto">
        <div
          className="rounded-3xl overflow-hidden"
          style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: 1 }}
        >
          {banner && (
            <div className="h-32 w-full overflow-hidden">
              <CloudImage
                src={banner}
                alt="Banner"
                w={980}
                h={360}
                sizes="(max-width: 430px) 100vw, 430px"
                className="h-full w-full object-cover"
              />
            </div>
          )}

          <div className="p-4">
            <div className="flex items-start gap-3">
              <div
                className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 flex items-center justify-center"
                style={{
                  backgroundColor: theme.primaryLight,
                  borderColor: theme.cardBorder,
                  borderWidth: 1,
                }}
              >
                {logo ? (
                  <CloudImage
                    src={logo}
                    alt="Logo"
                    w={160}
                    h={160}
                    sizes="64px"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Store className="w-7 h-7" style={{ color: theme.primaryColor }} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold" style={{ color: theme.textPrimary }}>
                    {name}
                  </h2>

                  {/* Verified badge (trust tier) */}
                  {verificationTier >= 2 ? (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ backgroundColor: theme.saleBadgeBg, color: theme.saleBadgeText }}
                      title={`Verification tier ${verificationTier}`}
                    >
                      <BadgeCheck className="w-3 h-3" />
                      Verified
                    </span>
                  ) : null}

                  {/* Apex plan badge (entitlement) */}
                  {apexActive ? (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                      style={{ backgroundColor: theme.badgeBg, color: theme.badgeText }}
                      title="Apex plan active"
                    >
                      <Sparkles className="w-3 h-3" />
                      Apex
                    </span>
                  ) : null}
                </div>

                {location && (
                  <p className="text-sm mt-1 flex items-center gap-1" style={{ color: theme.textSecondary }}>
                    <MapPin className="w-3.5 h-3.5" />
                    {location}
                  </p>
                )}

                {instagram && (
                  <p className="text-sm mt-1 flex items-center gap-1" style={{ color: theme.textMuted }}>
                    <Instagram className="w-3.5 h-3.5" />
                    @{instagram.replace(/^@/, "")}
                  </p>
                )}
              </div>
            </div>

            {about && (
              <p className="mt-3 text-sm leading-relaxed" style={{ color: theme.textSecondary }}>
                {about}
              </p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  if (!whatsapp) {
                    toast.info("This store hasn't added WhatsApp yet.");
                    return;
                  }
                  window.open(waLink(whatsapp, `Hello ${name}! I'm browsing your myBizHub store.`), "_blank");
                }}
                disabled={!whatsapp}
                className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                style={{ background: theme.buttonGradient, color: theme.buttonText }}
              >
                <Phone className="w-4 h-4" />
                WhatsApp
              </button>

              <button
                onClick={() => router.push("/cart")}
                className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all"
                style={{
                  backgroundColor: theme.buttonSecondaryBg,
                  color: theme.buttonSecondaryText,
                  borderColor: theme.buttonSecondaryBorder,
                  borderWidth: 1,
                }}
              >
                <Package className="w-4 h-4" />
                Cart
                {cartCount > 0 && (
                  <span
                    className="px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ backgroundColor: theme.primaryColor, color: theme.buttonText }}
                  >
                    {cartCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Products Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-base font-bold" style={{ color: theme.textPrimary }}>
                Products
              </h3>
              <p className="text-xs mt-0.5" style={{ color: theme.textMuted }}>
                {products.length} item{products.length !== 1 ? "s" : ""} available
              </p>
            </div>

            {theme.hasAnimation && (
              <span
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold"
                style={{ backgroundColor: theme.primaryLight, color: theme.primaryColor }}
              >
                <Sparkles className="w-3 h-3" />
                {theme.name}
              </span>
            )}
          </div>

          {products.length === 0 ? (
            <div
              className="rounded-2xl"
              style={{ backgroundColor: theme.cardBg, borderColor: theme.cardBorder, borderWidth: 1 }}
            >
              <EmptyState
                variant="plain"
                watermark={false}
                icon={<Package className="w-10 h-10 text-gray-300" />}
                title="No products yet"
                description="This store hasn't added any products."
                actions={[
                  {
                    label: "Browse marketplace",
                    onClick: () => router.push("/market"),
                    variant: "secondary",
                    size: "sm",
                  },
                ]}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {products.map((p: any) => {
                const hasOptions = Array.isArray(p?.optionGroups) && p.optionGroups.length > 0;
                const outOfStock = Number(p?.stock ?? 0) <= 0;
                const canQuickAdd = !hasOptions && !outOfStock;

                return (
                  <ThemedProductCard
                    key={p.id}
                    theme={theme}
                    product={p}
                    canQuickAdd={canQuickAdd}
                    onOpen={() => {
                      track({
                        type: "store_product_click",
                        businessId: biz.id,
                        businessSlug: slug,
                        productId: p.id,
                      });
                      router.push(`/b/${slug}/p/${p.id}`);
                    }}
                    onQuickAdd={() => quickAdd(p)}
                  />
                );
              })}
            </div>
          )}
        </div>

        <div className="pt-4 text-center">
          <p className="text-xs" style={{ color: theme.textMuted }}>
            Powered by{" "}
            <button
              onClick={() => router.push("/market")}
              className="font-bold hover:underline"
              style={{ color: theme.primaryColor }}
            >
              myBizHub
            </button>
          </p>
        </div>
      </div>

      {cartCount > 0 && (
        <div className="fixed bottom-6 left-4 right-4 z-40 max-w-[430px] mx-auto">
          <button
            onClick={() => router.push("/cart")}
            className="w-full flex items-center justify-between py-4 px-5 rounded-2xl shadow-lg transition-all hover:scale-[1.02]"
            style={{ background: theme.buttonGradient, color: theme.buttonText }}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: "rgba(255,255,255,0.2)" }}
              >
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-sm font-bold">
                  {cartCount} item{cartCount !== 1 ? "s" : ""} in cart
                </p>
                <p className="text-xs opacity-80">Tap to view</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
  );
}

