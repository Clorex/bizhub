// FILE: src/app/b/[slug]/checkout/page.tsx
"use client";

import { useCart } from "@/lib/cart/CartContext";
import { Card } from "@/components/Card";
import GradientHeader from "@/components/GradientHeader";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase/client";
import { loadCheckoutProfile, saveCheckoutProfile } from "@/lib/checkout/profile";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SectionCard } from "@/components/ui/SectionCard";
import { clearAppliedCoupon, getCouponForCheckout, saveAppliedCoupon } from "@/lib/checkout/coupon";
import { getShippingForCheckout, saveAppliedShipping } from "@/lib/checkout/shipping";

type ShippingOption = {
  id: string;
  type: "pickup" | "delivery";
  name: string;
  feeKobo: number;
  etaDays: number;
  areasText?: string | null;
};

type PayCurrency = "NGN" | "USD";

function fmtNaira(n: number) {
  try {
    return `₦${Number(n || 0).toLocaleString()}`;
  } catch {
    return `₦${n}`;
  }
}

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
  } catch {
    // ignore
  }
}

export default function CheckoutPage() {
  const router = useRouter();
  const params = useParams();
  const slug = String((params as any)?.slug ?? "");
  const { cart, subtotal } = useCart();

  const validCart = useMemo(() => cart.storeSlug === slug && cart.items.length > 0, [cart, slug]);

  const [authLoading, setAuthLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [emailVerified, setEmailVerified] = useState<boolean>(false);

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");

  const localSubtotalKobo = Math.floor(Number(subtotal || 0) * 100);

  const [couponCode, setCouponCode] = useState("");
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [applied, setApplied] = useState<any>(null);

  const [shipLoading, setShipLoading] = useState(false);
  const [shipMsg, setShipMsg] = useState<string | null>(null);
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShipId, setSelectedShipId] = useState<string>("");

  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteMsg, setQuoteMsg] = useState<string | null>(null);
  const [quote, setQuote] = useState<any>(null);

  const [payLoading, setPayLoading] = useState(false);

  // USD eligibility
  const [usdEligible, setUsdEligible] = useState(false);
  const [payCurrency, setPayCurrency] = useState<PayCurrency>("NGN");

  // Load persisted coupon
  useEffect(() => {
    const c = getCouponForCheckout({ storeSlug: slug, subtotalKobo: localSubtotalKobo });
    setApplied(c);
    setCouponCode(c?.code || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    if (applied && applied.subtotalKobo !== localSubtotalKobo) {
      clearAppliedCoupon();
      setApplied(null);
      setCouponMsg("Cart changed. Please re-apply discount code.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSubtotalKobo]);

  useEffect(() => {
    const s = getShippingForCheckout({ storeSlug: slug });
    setSelectedShipId(s?.optionId || "");
  }, [slug]);

  // Load saved currency preference
  useEffect(() => {
    if (!slug) return;
    setPayCurrency(loadPayCurrency(slug));
  }, [slug]);

  // Fetch USD eligibility from server
  useEffect(() => {
    let mounted = true;

    async function loadPaymentOptions() {
      try {
        if (!slug) return;
        const r = await fetch(`/api/public/store/${encodeURIComponent(slug)}/payment-options`);
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || "Failed to load payment options");

        const ok = !!j?.usdEligible;
        if (!mounted) return;

        setUsdEligible(ok);

        // If not eligible, force NGN
        if (!ok) {
          setPayCurrency("NGN");
          savePayCurrency(slug, "NGN");
        }
      } catch {
        if (!mounted) return;
        setUsdEligible(false);
        setPayCurrency("NGN");
        savePayCurrency(slug, "NGN");
      }
    }

    loadPaymentOptions();
    return () => {
      mounted = false;
    };
  }, [slug]);

  // Fetch shipping options
  useEffect(() => {
    let mounted = true;

    async function loadShippingOptions() {
      setShipLoading(true);
      setShipMsg(null);

      try {
        const r = await fetch(`/api/vendor/shipping/options?storeSlug=${encodeURIComponent(slug)}`);
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.error || "Failed to load shipping options");

        const opts: ShippingOption[] = Array.isArray(data.options) ? data.options : [];
        if (!mounted) return;

        setShippingOptions(opts);

        if (opts.length > 0) {
          const saved = getShippingForCheckout({ storeSlug: slug });
          const savedId = saved?.optionId || "";
          const stillValid = savedId && opts.some((o) => o.id === savedId);

          const nextId = stillValid ? savedId : String(opts[0].id);
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
        } else {
          setSelectedShipId("");
        }
      } catch (e: any) {
        if (!mounted) return;
        setShipMsg(e?.message || "Failed to load shipping options");
        setShippingOptions([]);
        setSelectedShipId("");
      } finally {
        if (mounted) setShipLoading(false);
      }
    }

    if (slug) loadShippingOptions();
    return () => {
      mounted = false;
    };
  }, [slug]);

  const selectedShipping = useMemo(() => {
    if (!selectedShipId) return null;
    return shippingOptions.find((o) => o.id === selectedShipId) || null;
  }, [selectedShipId, shippingOptions]);

  const shippingRequired = shippingOptions.length > 0;
  const shippingFeeKobo = Number(selectedShipping?.feeKobo || 0);

  // Force login
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

  async function fetchQuote(opts?: { couponCode?: string | null; shippingFeeKobo?: number }) {
    if (!validCart) return;

    setQuoteLoading(true);
    setQuoteMsg(null);

    try {
      const items = (cart.items || []).map((it: any) => ({
        productId: String(it.productId || it.id || ""),
        qty: Number(it.qty || 1),
        selectedOptions: it.selectedOptions || null,
      }));

      const coupon = opts?.couponCode != null ? String(opts.couponCode) : applied?.code ? String(applied.code) : null;

      const r = await fetch("/api/checkout/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          storeSlug: slug,
          items,
          couponCode: coupon || null,
          shippingFeeKobo: opts?.shippingFeeKobo != null ? Number(opts.shippingFeeKobo) : Number(shippingFeeKobo || 0),
        }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Failed to compute total");

      setQuote(data);

      if (applied?.code && data?.couponResult && data.couponResult.ok === false) {
        clearAppliedCoupon();
        setApplied(null);
        setCouponMsg(String(data?.couponResult?.error || "Coupon no longer valid."));
      }
    } catch (e: any) {
      setQuote(null);
      setQuoteMsg(e?.message || "Failed to compute total");
    } finally {
      setQuoteLoading(false);
    }
  }

  useEffect(() => {
    if (!validCart) return;
    fetchQuote({ shippingFeeKobo });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [validCart, slug, selectedShipId, shippingFeeKobo, applied?.code, cart.items.length]);

  useEffect(() => {
    if (!validCart) return;
    fetchQuote({ shippingFeeKobo });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localSubtotalKobo]);

  if (!validCart) {
    return (
      <div className="min-h-screen">
        <GradientHeader title="Checkout" showBack={true} />
        <div className="px-4 pb-24">
          <Card className="p-5 text-center">
            <p className="font-bold text-biz-ink">Cart is empty for this vendor</p>
            <p className="text-sm text-biz-muted mt-2">Go back to cart and add items.</p>
            <div className="mt-4 space-y-2">
              <Button variant="secondary" onClick={() => router.push("/cart")}>
                Go to cart
              </Button>
              <Button onClick={() => router.push(`/b/${slug}`)}>Back to vendor</Button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  if (authLoading || !loggedIn) {
    return (
      <div className="min-h-screen">
        <GradientHeader title="Checkout" subtitle="Preparing checkout…" showBack={true} />
        <div className="px-4 pb-24">
          <Card className="p-4">Loading…</Card>
        </div>
      </div>
    );
  }

  function selectShipping(opt: ShippingOption) {
    setSelectedShipId(opt.id);
    saveAppliedShipping({
      storeSlug: slug,
      optionId: opt.id,
      type: opt.type,
      name: opt.name,
      feeKobo: Number(opt.feeKobo || 0),
      selectedAtMs: Date.now(),
    });
  }

  async function applyCoupon() {
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

      await fetchQuote({ couponCode: code, shippingFeeKobo });

      const items = (cart.items || []).map((it: any) => ({
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
        throw new Error(String(data?.couponResult?.error || "Invalid code"));
      }

      const couponDiscountKobo = Number(data?.pricing?.couponDiscountKobo || 0);
      const saleSubtotalKobo = Number(data?.pricing?.saleSubtotalKobo || 0);

      const next = {
        storeSlug: slug,
        code,
        subtotalKobo: localSubtotalKobo,
        serverSaleSubtotalKobo: saleSubtotalKobo,
        discountKobo: couponDiscountKobo,
        totalKobo: Math.max(0, saleSubtotalKobo - couponDiscountKobo),
        appliedAtMs: Date.now(),
      };

      saveAppliedCoupon(next);
      setApplied(next);
      setCouponMsg(`Applied ${code}.`);

      setQuote(data);
      setQuoteMsg(null);
    } catch (e: any) {
      clearAppliedCoupon();
      setApplied(null);
      setCouponMsg(e?.message || "Failed to apply code");
    } finally {
      setCouponLoading(false);
    }
  }

  function clearCoupon() {
    clearAppliedCoupon();
    setApplied(null);
    setCouponCode("");
    setCouponMsg("Discount removed.");
    fetchQuote({ couponCode: null, shippingFeeKobo });
  }

  const pricing = quote?.pricing || null;
  const totalKobo = pricing ? Number(pricing.totalKobo || 0) : Math.max(0, localSubtotalKobo + shippingFeeKobo);
  const totalNgn = totalKobo / 100;

  const originalSubtotalKobo = pricing ? Number(pricing.originalSubtotalKobo || 0) : localSubtotalKobo;
  const saleDiscountKobo = pricing ? Number(pricing.saleDiscountKobo || 0) : 0;
  const couponDiscountKobo = pricing ? Number(pricing.couponDiscountKobo || 0) : Number(applied?.discountKobo || 0);

  const pickedPickup = selectedShipping?.type === "pickup";
  const canPay =
    !!fullName &&
    !!phone &&
    !!email &&
    emailVerified &&
    (!shippingRequired || !!selectedShipping) &&
    (pickedPickup ? true : !!address) &&
    !quoteLoading &&
    !quoteMsg &&
    !payLoading;

  async function handleCardPay() {
    setPayLoading(true);
    try {
      saveCheckoutProfile({ email, fullName, phone, address });

      const effectiveCurrency: PayCurrency = usdEligible ? payCurrency : "NGN";
      savePayCurrency(slug, effectiveCurrency);

      const items = (cart.items || []).map((it: any) => ({
        productId: String(it.productId || it.id || ""),
        qty: Number(it.qty || 1),
        selectedOptions: it.selectedOptions || null,
      }));

      const coupon = applied?.code ? String(applied.code) : null;

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
        alert(qData?.error || "Failed to compute final price");
        return;
      }

      const amountKobo = Number(qData?.pricing?.totalKobo || 0);
      if (!Number.isFinite(amountKobo) || amountKobo <= 0) {
        alert("Invalid total. Please refresh and try again.");
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
        alert(data?.error || "Failed to start payment");
        return;
      }

      const url = String(data.authorization_url || "");
      if (!url) {
        alert("Payment link missing. Please try again.");
        return;
      }

      window.location.href = url;
    } finally {
      setPayLoading(false);
    }
  }

  function goBankTransfer() {
    saveCheckoutProfile({ email, fullName, phone, address });
    router.push(`/b/${slug}/pay/direct?name=${encodeURIComponent(fullName)}&phone=${encodeURIComponent(phone)}`);
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="Checkout" subtitle="Complete your order" showBack={true} />

      {/* Sticky bottom payment card on mobile; normal flow on desktop */}
      <div className="px-4 pb-24 space-y-3">
        <div className="rounded-[26px] p-4 text-white shadow-float bg-gradient-to-br from-biz-accent2 to-biz-accent">
          <p className="text-sm font-bold">Order total</p>
          <p className="text-xs opacity-95 mt-1">
            Vendor: <b>{slug}</b>
          </p>

          <p className="text-2xl font-bold mt-2">{fmtNaira(totalNgn)}</p>

          <p className="text-[11px] opacity-95 mt-2">
            Original subtotal: <b>{fmtNaira(originalSubtotalKobo / 100)}</b>
            {saleDiscountKobo > 0 ? (
              <>
                {" "}
                • Sale discount: <b>{fmtNaira(saleDiscountKobo / 100)}</b>
              </>
            ) : null}
            {couponDiscountKobo > 0 ? (
              <>
                {" "}
                • Coupon: <b>{fmtNaira(couponDiscountKobo / 100)}</b>
              </>
            ) : null}
            {shippingFeeKobo > 0 ? (
              <>
                {" "}
                • Shipping: <b>{fmtNaira(shippingFeeKobo / 100)}</b>
              </>
            ) : null}
          </p>

          {quoteLoading ? <p className="text-[11px] opacity-95 mt-2">Updating total…</p> : null}
          {quoteMsg ? <p className="text-[11px] text-red-100 mt-2">{quoteMsg}</p> : null}
        </div>

        <SectionCard title="Shipping" subtitle="Choose delivery or pickup">
          {shipLoading ? <p className="text-sm text-biz-muted">Loading shipping options…</p> : null}
          {shipMsg ? <p className="text-sm text-red-700">{shipMsg}</p> : null}

          {!shipLoading && !shipMsg && shippingOptions.length === 0 ? (
            <p className="text-sm text-biz-muted">
              This vendor has not set shipping options yet. You can proceed (shipping = ₦0).
            </p>
          ) : null}

          {shippingOptions.length > 0 ? (
            <div className="space-y-2">
              {shippingOptions.map((o) => {
                const active = o.id === selectedShipId;
                const feeNgn = Number(o.feeKobo || 0) / 100;

                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => selectShipping(o)}
                    className={[
                      "w-full text-left rounded-2xl border p-3 transition",
                      active
                        ? "border-transparent bg-gradient-to-br from-biz-accent2 to-biz-accent text-white shadow-float"
                        : "border-biz-line bg-white hover:bg-black/[0.02]",
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className={active ? "text-sm font-bold" : "text-sm font-bold text-biz-ink"}>
                          {o.name} {o.type === "pickup" ? "(Pickup)" : "(Delivery)"}
                        </p>
                        <p className={active ? "text-[11px] opacity-90 mt-1" : "text-[11px] text-biz-muted mt-1"}>
                          Fee: <b>{fmtNaira(feeNgn)}</b>
                          {o.etaDays ? ` • ETA: ${o.etaDays} day(s)` : ""}
                          {o.areasText ? ` • ${o.areasText}` : ""}
                        </p>
                      </div>
                      <div className={active ? "text-white font-bold" : "text-gray-400 font-bold"}>›</div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}

          {shippingRequired && !selectedShipping ? (
            <p className="mt-2 text-[11px] text-red-700">Please select a shipping option to continue.</p>
          ) : null}
        </SectionCard>

        <SectionCard title="Discount code" subtitle="Optional">
          <div className="space-y-2">
            <Input
              placeholder="Enter coupon code"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={applyCoupon} loading={couponLoading} disabled={couponLoading}>
                Apply
              </Button>
              <Button variant="secondary" onClick={clearCoupon} disabled={!applied}>
                Remove
              </Button>
            </div>
            {couponMsg ? <p className="text-[11px] text-biz-muted">{couponMsg}</p> : null}
          </div>
        </SectionCard>

        <SectionCard title="Customer details" subtitle="Saved on this device for faster checkout">
          <div className="space-y-2">
            <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <Input placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
            <Input placeholder="Phone number" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />

            {selectedShipping?.type !== "pickup" ? (
              <textarea
                className="w-full rounded-2xl border border-biz-line bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-biz-accent/30 focus:border-biz-accent/40"
                placeholder="Delivery address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                rows={3}
              />
            ) : (
              <div className="rounded-2xl border border-biz-line bg-white p-3">
                <p className="text-xs text-biz-muted">Pickup selected — delivery address not required.</p>
              </div>
            )}
          </div>

          {!emailVerified ? <p className="mt-3 text-xs text-red-700">Please verify your email to continue checkout.</p> : null}
        </SectionCard>

        {/* ✅ Sticky payment box: doesn’t “trap” the whole page like a fixed overlay */}
        <div className="sticky bottom-0 z-40 md:static">
          <div className="mx-auto w-full max-w-[430px] safe-pb pb-4">
            <Card className="p-4 space-y-2 shadow-float">
              {usdEligible ? (
                <div className="rounded-2xl border border-biz-line bg-white p-3">
                  <p className="text-xs font-bold text-biz-ink">Card payment currency</p>
                  <p className="text-[11px] text-biz-muted mt-1">This vendor supports USD card payments.</p>

                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPayCurrency("NGN")}
                      className={
                        payCurrency === "NGN"
                          ? "rounded-2xl py-2 text-xs font-extrabold text-white bg-gradient-to-br from-biz-accent2 to-biz-accent shadow-float"
                          : "rounded-2xl py-2 text-xs font-extrabold bg-white border border-biz-line text-biz-ink"
                      }
                    >
                      NGN
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayCurrency("USD")}
                      className={
                        payCurrency === "USD"
                          ? "rounded-2xl py-2 text-xs font-extrabold text-white bg-gradient-to-br from-biz-accent2 to-biz-accent shadow-float"
                          : "rounded-2xl py-2 text-xs font-extrabold bg-white border border-biz-line text-biz-ink"
                      }
                    >
                      USD
                    </button>
                  </div>
                </div>
              ) : null}

              <Button onClick={handleCardPay} disabled={!canPay} loading={payLoading}>
                Pay with card{usdEligible ? ` (${payCurrency})` : ""}
              </Button>

              <Button variant="secondary" onClick={goBankTransfer} disabled={!canPay || payLoading}>
                Pay with Bank Transfer
              </Button>

              {!canPay ? (
                <p className="text-[11px] text-biz-muted">
                  Fill your details above and select shipping (if needed) to continue.
                </p>
              ) : null}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}