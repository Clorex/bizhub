// FILE: src/app/b/[slug]/checkout/page.tsx
"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { Loader2 } from "lucide-react";

import { auth } from "@/lib/firebase/client";
import { useCart } from "@/lib/cart/CartContext";
import { loadCheckoutProfile, saveCheckoutProfile } from "@/lib/checkout/profile";
import {
  clearAppliedCoupon,
  getCouponForCheckout,
  saveAppliedCoupon,
} from "@/lib/checkout/coupon";
import { getShippingForCheckout, saveAppliedShipping } from "@/lib/checkout/shipping";
import { toast } from "@/lib/ui/toast";

import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";

import { CheckoutHeader } from "@/components/checkout/CheckoutHeader";
import { ShippingSelector } from "@/components/checkout/ShippingSelector";
import { CouponInput } from "@/components/checkout/CouponInput";
import { CustomerForm } from "@/components/checkout/CustomerForm";
import { PaymentButtons } from "@/components/checkout/PaymentButtons";

type ShippingOption = {
  id: string;
  type: "pickup" | "delivery";
  name: string;
  feeKobo: number;
  etaDays: number;
  areasText?: string | null;
};

type PayCurrency = "NGN" | "USD";

function clampStr(v: any, max = 200) {
  return String(v || "").trim().slice(0, max);
}

function loadPayCurrency(storeSlug: string): PayCurrency {
  try {
    const key = `bizhub_checkout_currency_${storeSlug}`;
    const v = String(localStorage.getItem(key) || "").toUpperCase();
    return v === "USD" ? "USD" : "NGN";
  } catch {
    return "NGN";
  }
}

function savePayCurrency(storeSlug: string, c: PayCurrency) {
  try {
    const key = `bizhub_checkout_currency_${storeSlug}`;
    localStorage.setItem(key, c);
  } catch {}
}

function friendlyPayError(raw: any) {
  const msg = String(raw?.error || raw?.message || raw || "").trim();
  const m = msg.toLowerCase();

  if (!msg) return "We couldn't start your payment. Please try again.";
  if (m.includes("usd payments not configured") || m.includes("missing fx")) {
    return "USD payments are not available right now. Please switch to NGN.";
  }
  if (m.includes("amount mismatch")) {
    return "Your cart total changed. Please refresh and try again.";
  }
  if (m.includes("not logged in") || m.includes("auth")) {
    return "Please log in again and try.";
  }
  return msg.length > 120 ? "We couldn't start your payment. Please try again." : msg;
}

export default function CheckoutPage() {
  const router = useRouter();
  const params = useParams();
  const slug = String((params as any)?.slug ?? "");
  const { cart, subtotal } = useCart();

  const validCart = useMemo(
    () => cart.storeSlug === slug && cart.items.length > 0,
    [cart, slug]
  );
  const itemCount = cart.items.reduce((sum, item) => sum + item.qty, 0);
  const localSubtotalKobo = Math.floor(Number(subtotal || 0) * 100);

  // Auth state
  const [authLoading, setAuthLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);

  // Customer form
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  // Coupon
  const [couponCode, setCouponCode] = useState("");
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [applied, setApplied] = useState<any>(null);

  // Shipping
  const [shipLoading, setShipLoading] = useState(false);
  const [shipError, setShipError] = useState<string | null>(null);
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShipId, setSelectedShipId] = useState("");

  // Quote
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [quote, setQuote] = useState<any>(null);

  // Payment
  const [payLoading, setPayLoading] = useState(false);
  const [usdEligible, setUsdEligible] = useState(false);
  const [payCurrency, setPayCurrency] = useState<PayCurrency>("NGN");

  const selectedShipping = useMemo(
    () => shippingOptions.find((o) => o.id === selectedShipId) || null,
    [selectedShipId, shippingOptions]
  );
  const shippingRequired = shippingOptions.length > 0;
  const shippingFeeKobo = Number(selectedShipping?.feeKobo || 0);
  const isPickup = selectedShipping?.type === "pickup";

  // Pricing from quote
  const pricing = quote?.pricing || null;
  const totalKobo = pricing
    ? Number(pricing.totalKobo || 0)
    : Math.max(0, localSubtotalKobo + shippingFeeKobo);
  const totalNgn = totalKobo / 100;
  const couponDiscountKobo = pricing
    ? Number(pricing.couponDiscountKobo || 0)
    : Number(applied?.discountKobo || 0);

  // Validation
  const canPay =
    !!fullName &&
    !!phone &&
    !!email &&
    emailVerified &&
    (!shippingRequired || !!selectedShipping) &&
    (isPickup ? true : !!address) &&
    !quoteLoading &&
    !quoteError &&
    !payLoading;

  // Load persisted coupon
  useEffect(() => {
    const c = getCouponForCheckout({ storeSlug: slug, subtotalKobo: localSubtotalKobo });
    setApplied(c);
    setCouponCode(c?.code || "");
  }, [slug, localSubtotalKobo]);

  // Load persisted shipping
  useEffect(() => {
    const s = getShippingForCheckout({ storeSlug: slug });
    setSelectedShipId(s?.optionId || "");
  }, [slug]);

  // Load currency preference
  useEffect(() => {
    if (slug) setPayCurrency(loadPayCurrency(slug));
  }, [slug]);

  // Auth check
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setAuthLoading(false);

      if (!u) {
        setLoggedIn(false);
        router.replace(`/account/login?next=${encodeURIComponent(`/b/${slug}/checkout`)}`);
        return;
      }

      setLoggedIn(true);

      const p = loadCheckoutProfile();
      setEmail(p.email || u.email || "");
      setFullName(p.fullName || "");
      setPhone(p.phone || "");
      setAddress(p.address || "");

      try {
        const token = await u.getIdToken();
        const r = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
        const data = await r.json().catch(() => ({}));
        const ok = !!data?.me?.emailVerified;
        setEmailVerified(ok);

        if (!ok) {
          router.replace(`/account/verify?next=${encodeURIComponent(`/b/${slug}/checkout`)}`);
        }
      } catch {
        setEmailVerified(false);
      }
    });

    return () => unsub();
  }, [router, slug]);

  // Fetch USD eligibility
  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const r = await fetch(`/api/public/store/${encodeURIComponent(slug)}/payment-options`);
        const j = await r.json().catch(() => ({}));
        if (!mounted) return;

        const ok = !!j?.usdEligible;
        setUsdEligible(ok);
        if (!ok) {
          setPayCurrency("NGN");
          savePayCurrency(slug, "NGN");
        }
      } catch {
        if (mounted) {
          setUsdEligible(false);
          setPayCurrency("NGN");
        }
      }
    }

    if (slug) load();
    return () => {
      mounted = false;
    };
  }, [slug]);

  // Fetch shipping options
  useEffect(() => {
    let mounted = true;

    async function load() {
      setShipLoading(true);
      setShipError(null);

      try {
        const r = await fetch(
          `/api/vendor/shipping/options?storeSlug=${encodeURIComponent(slug)}`
        );
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.error || "Failed to load shipping");

        const opts: ShippingOption[] = Array.isArray(data.options) ? data.options : [];
        if (!mounted) return;

        setShippingOptions(opts);

        if (opts.length > 0) {
          const saved = getShippingForCheckout({ storeSlug: slug });
          const savedId = saved?.optionId || "";
          const stillValid = savedId && opts.some((o) => o.id === savedId);
          const nextId = stillValid ? savedId : opts[0].id;
          setSelectedShipId(nextId);

          const chosen = opts.find((o) => o.id === nextId) || opts[0];
          saveAppliedShipping({
            storeSlug: slug,
            optionId: chosen.id,
            type: chosen.type,
            name: chosen.name,
            feeKobo: Number(chosen.feeKobo || 0),
            selectedAtMs: Date.now(),
          });
        }
      } catch (e: any) {
        if (mounted) {
          setShipError(e?.message || "Failed to load shipping");
          setShippingOptions([]);
        }
      } finally {
        if (mounted) setShipLoading(false);
      }
    }

    if (slug) load();
    return () => {
      mounted = false;
    };
  }, [slug]);

  // Fetch quote
  const fetchQuote = useCallback(
    async (opts?: { couponCode?: string | null; shippingFeeKobo?: number }) => {
      if (!validCart) return;

      setQuoteLoading(true);
      setQuoteError(null);

      try {
        const items = cart.items.map((it: any) => ({
          productId: String(it.productId || it.id || ""),
          qty: Number(it.qty || 1),
          selectedOptions: it.selectedOptions || null,
        }));

        const coupon =
          opts?.couponCode != null ? String(opts.couponCode) : applied?.code || null;

        const r = await fetch("/api/checkout/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            storeSlug: slug,
            items,
            couponCode: coupon,
            shippingFeeKobo: opts?.shippingFeeKobo ?? shippingFeeKobo,
          }),
        });

        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.error || "Failed to compute total");

        setQuote(data);

        if (applied?.code && data?.couponResult?.ok === false) {
          clearAppliedCoupon();
          setApplied(null);
          setCouponMsg(data?.couponResult?.error || "Coupon no longer valid.");
        }
      } catch (e: any) {
        setQuote(null);
        setQuoteError(e?.message || "Failed to compute total");
      } finally {
        setQuoteLoading(false);
      }
    },
    [validCart, cart.items, slug, applied?.code, shippingFeeKobo]
  );

  // Refresh quote when dependencies change
  useEffect(() => {
    if (validCart) {
      fetchQuote({ shippingFeeKobo });
    }
  }, [validCart, selectedShipId, shippingFeeKobo, applied?.code, cart.items.length, fetchQuote]);

  // Shipping selection handler
  const handleSelectShipping = useCallback(
    (opt: ShippingOption) => {
      setSelectedShipId(opt.id);
      saveAppliedShipping({
        storeSlug: slug,
        optionId: opt.id,
        type: opt.type,
        name: opt.name,
        feeKobo: Number(opt.feeKobo || 0),
        selectedAtMs: Date.now(),
      });
    },
    [slug]
  );

  // Coupon handlers
  const handleApplyCoupon = useCallback(async () => {
    setCouponLoading(true);
    setCouponMsg(null);

    try {
      const code = couponCode.trim().toUpperCase();
      if (!code) {
        clearAppliedCoupon();
        setApplied(null);
        setCouponMsg("Enter a code first.");
        return;
      }

      const items = cart.items.map((it: any) => ({
        productId: String(it.productId || it.id || ""),
        qty: Number(it.qty || 1),
        selectedOptions: it.selectedOptions || null,
      }));

      const r = await fetch("/api/checkout/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeSlug: slug,
          items,
          couponCode: code,
          shippingFeeKobo,
        }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Failed to apply code");

      if (data?.couponResult?.ok !== true) {
        throw new Error(data?.couponResult?.error || "Invalid code");
      }

      const discountKobo = Number(data?.pricing?.couponDiscountKobo || 0);
      const saleSubtotalKobo = Number(data?.pricing?.saleSubtotalKobo || 0);

      const next = {
        storeSlug: slug,
        code,
        subtotalKobo: localSubtotalKobo,
        serverSaleSubtotalKobo: saleSubtotalKobo,
        discountKobo,
        totalKobo: Math.max(0, saleSubtotalKobo - discountKobo),
        appliedAtMs: Date.now(),
      };

      saveAppliedCoupon(next);
      setApplied(next);
      setCouponMsg(`${code} applied!`);
      setQuote(data);
      toast.success("Coupon applied!");
    } catch (e: any) {
      clearAppliedCoupon();
      setApplied(null);
      setCouponMsg(e?.message || "Failed to apply code");
    } finally {
      setCouponLoading(false);
    }
  }, [couponCode, cart.items, slug, shippingFeeKobo, localSubtotalKobo]);

  const handleRemoveCoupon = useCallback(() => {
    clearAppliedCoupon();
    setApplied(null);
    setCouponCode("");
    setCouponMsg("Coupon removed.");
    fetchQuote({ couponCode: null, shippingFeeKobo });
  }, [fetchQuote, shippingFeeKobo]);

  // Payment handlers
  const handleCardPay = useCallback(async () => {
    setPayLoading(true);

    try {
      saveCheckoutProfile({ email, fullName, phone, address });

      const effectiveCurrency: PayCurrency = usdEligible ? payCurrency : "NGN";
      savePayCurrency(slug, effectiveCurrency);

      const items = cart.items.map((it: any) => ({
        productId: String(it.productId || it.id || ""),
        qty: Number(it.qty || 1),
        selectedOptions: it.selectedOptions || null,
      }));

      const coupon = applied?.code || null;

      // Get fresh quote
      const rQ = await fetch("/api/checkout/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeSlug: slug,
          items,
          couponCode: coupon,
          shippingFeeKobo,
        }),
      });

      const qData = await rQ.json().catch(() => ({}));
      if (!rQ.ok) {
        toast.error(friendlyPayError(qData?.error));
        return;
      }

      const amountKobo = Number(qData?.pricing?.totalKobo || 0);
      if (!Number.isFinite(amountKobo) || amountKobo <= 0) {
        toast.error("Your total looks incorrect. Please refresh.");
        return;
      }

      const metaItems = Array.isArray(qData.normalizedItems)
        ? qData.normalizedItems.map((it: any) => ({
            productId: String(it.productId || ""),
            name: String(it.name || "Item"),
            qty: Number(it.qty || 1),
            price: Number(it.finalUnitPriceKobo || 0) / 100,
            selectedOptions: it.selectedOptions || null,
          }))
        : cart.items;

      const r = await fetch("/api/paystack/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          amountKobo,
          currency: effectiveCurrency,
          metadata: {
            storeSlug: slug,
            customer: {
              fullName: clampStr(fullName, 80),
              phone: clampStr(phone, 40),
              address: clampStr(address, 300),
              email: clampStr(email, 120),
            },
            items: metaItems,
            coupon: coupon ? { code: coupon } : null,
            shipping: selectedShipping
              ? {
                  optionId: selectedShipping.id,
                  type: selectedShipping.type,
                  name: selectedShipping.name,
                  feeKobo: Number(selectedShipping.feeKobo || 0),
                }
              : null,
            quote: {
              pricing: qData.pricing || null,
              couponResult: qData.couponResult || null,
              createdAtMs: Date.now(),
            },
          },
        }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast.error(friendlyPayError(data));
        return;
      }

      const url = String(data.authorization_url || "");
      if (!url) {
        toast.error("Payment link is missing. Please try again.");
        return;
      }

      toast.info("Redirecting to payment...");
      window.location.href = url;
    } finally {
      setPayLoading(false);
    }
  }, [
    email,
    fullName,
    phone,
    address,
    usdEligible,
    payCurrency,
    slug,
    cart.items,
    applied?.code,
    shippingFeeKobo,
    selectedShipping,
  ]);

  const handleDirectTransfer = useCallback(() => {
    saveCheckoutProfile({ email, fullName, phone, address });

    // Build query params with order details
    const params = new URLSearchParams({
      name: fullName,
      phone: phone,
      email: email,
      amount: String(totalKobo / 100),
    });

    if (address && !isPickup) {
      params.set("address", address);
    }

    if (applied?.code) {
      params.set("coupon", applied.code);
    }

    if (selectedShipping) {
      params.set("shipping", selectedShipping.name);
      params.set("shippingFee", String(selectedShipping.feeKobo / 100));
    }

    router.push(`/b/${slug}/pay/direct?${params.toString()}`);
  }, [
    router,
    slug,
    email,
    fullName,
    phone,
    address,
    totalKobo,
    isPickup,
    applied?.code,
    selectedShipping,
  ]);

  // Invalid cart state
  if (!validCart) {
    return (
      <div className="min-h-screen bg-gray-50">
        <GradientHeader title="Checkout" showBack={true} />
        <div className="px-4 pt-4">
          <Card className="p-8 text-center">
            <p className="text-lg font-bold text-gray-900">Cart is empty</p>
            <p className="text-sm text-gray-500 mt-2">
              Add items to your cart to continue checkout.
            </p>
            <div className="mt-6 space-y-2">
              <Button onClick={() => router.push("/cart")} variant="secondary">
                Go to Cart
              </Button>
              <Button onClick={() => router.push(`/b/${slug}`)}>Browse Store</Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // Loading auth
  if (authLoading || !loggedIn) {
    return (
      <div className="min-h-screen bg-gray-50">
        <GradientHeader title="Checkout" showBack={true} />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          <span className="ml-3 text-gray-500">Preparing checkout...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-8">
      <GradientHeader title="Checkout" subtitle="Complete your order" showBack={true} />

      <div className="px-4 space-y-4 mt-4">
        {/* Order total header */}
        <CheckoutHeader total={totalNgn} storeSlug={slug} itemCount={itemCount} loading={quoteLoading} />

        {/* Shipping */}
        <SectionCard title="Shipping" subtitle="Choose delivery or pickup">
          <ShippingSelector
            options={shippingOptions}
            selectedId={selectedShipId}
            onSelect={handleSelectShipping}
            loading={shipLoading}
            error={shipError}
          />
        </SectionCard>

        {/* Coupon */}
        <SectionCard title="Discount Code" subtitle="Have a coupon?">
          <CouponInput
            code={couponCode}
            onCodeChange={setCouponCode}
            onApply={handleApplyCoupon}
            onRemove={handleRemoveCoupon}
            loading={couponLoading}
            applied={!!applied && couponDiscountKobo > 0}
            discountAmount={couponDiscountKobo}
            message={couponMsg}
          />
        </SectionCard>

        {/* Customer details */}
        <SectionCard title="Your Details" subtitle="We'll use this for delivery">
          <CustomerForm
            email={email}
            fullName={fullName}
            phone={phone}
            address={address}
            onEmailChange={setEmail}
            onFullNameChange={setFullName}
            onPhoneChange={setPhone}
            onAddressChange={setAddress}
            emailVerified={emailVerified}
            isPickup={isPickup}
          />
        </SectionCard>

        {/* Payment */}
        <SectionCard title="Payment" subtitle="Choose how to pay">
          <PaymentButtons
            onCardPay={handleCardPay}
            onDirectTransfer={handleDirectTransfer}
            loading={payLoading}
            disabled={!canPay}
            usdEligible={usdEligible}
            currency={payCurrency}
            onCurrencyChange={setPayCurrency}
          />
        </SectionCard>

        {/* Error display */}
        {quoteError && (
          <Card className="p-4 bg-red-50 border-red-100">
            <p className="text-sm text-red-700">{quoteError}</p>
          </Card>
        )}
      </div>
    </div>
  );
}