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

function fmtNaira(n: number) {
  try {
    return `₦${Number(n || 0).toLocaleString()}`;
  } catch {
    return `₦${n}`;
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

  // coupon UI state
  const subtotalKobo = Math.floor(Number(subtotal || 0) * 100);
  const [couponCode, setCouponCode] = useState("");
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [applied, setApplied] = useState<any>(null);

  // shipping UI state
  const [shipLoading, setShipLoading] = useState(false);
  const [shipMsg, setShipMsg] = useState<string | null>(null);
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShipId, setSelectedShipId] = useState<string>("");

  useEffect(() => {
    // load persisted coupon for this store/subtotal
    const c = getCouponForCheckout({ storeSlug: slug, subtotalKobo });
    setApplied(c);
    setCouponCode(c?.code || "");
  }, [slug, subtotalKobo]);

  useEffect(() => {
    // If subtotal changes after coupon applied, clear it
    if (applied && applied.subtotalKobo !== subtotalKobo) {
      clearAppliedCoupon();
      setApplied(null);
      setCouponMsg("Cart changed. Please re-apply discount code.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotalKobo]);

  // Load saved shipping selection (store-specific)
  useEffect(() => {
    const s = getShippingForCheckout({ storeSlug: slug });
    setSelectedShipId(s?.optionId || "");
  }, [slug]);

  // Fetch shipping options for this store
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

        // Auto-select: saved option if it exists, else first option
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

  const discountKobo = Number(applied?.discountKobo || 0);

  // totals:
  // baseTotal = subtotal - discount
  const baseTotalKobo = Math.max(0, subtotalKobo - discountKobo);

  // shipping added AFTER discount (assumption)
  const shippingFeeKobo = Number(selectedShipping?.feeKobo || 0);
  const grandTotalKobo = Math.max(0, baseTotalKobo + shippingFeeKobo);

  const grandTotalNgn = grandTotalKobo / 100;

  // Force login before checkout
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

  if (!validCart) {
    return (
      <div className="min-h-screen">
        <GradientHeader title="Checkout" showBack={true} />
        <div className="px-4 pb-24">
          <Card className="p-5 text-center">
            <p className="font-bold text-biz-ink">Cart is empty for this store</p>
            <p className="text-sm text-biz-muted mt-2">Go back to cart and add items.</p>
            <div className="mt-4 space-y-2">
              <Button variant="secondary" onClick={() => router.push("/cart")}>
                Go to cart
              </Button>
              <Button onClick={() => router.push(`/b/${slug}`)}>Back to store</Button>
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

      // ✅ FIX: correct endpoint
      const r = await fetch("/api/vendor/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ storeSlug: slug, code, subtotalKobo }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Invalid code");

      const next = {
        storeSlug: slug,
        code,
        subtotalKobo,
        discountKobo: Number(data.discountKobo || 0),
        totalKobo: Number(data.totalKobo || subtotalKobo),
        appliedAtMs: Date.now(),
      };

      saveAppliedCoupon(next);
      setApplied(next);
      setCouponMsg(`Applied ${code}.`);
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

  async function handlePaystack() {
    saveCheckoutProfile({ email, fullName, phone, address });

    const r = await fetch("/api/paystack/initialize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        amountKobo: grandTotalKobo,
        metadata: {
          storeSlug: slug,
          customer: { fullName, phone, address, email },
          items: cart.items,
          coupon: applied
            ? { code: applied.code, discountKobo: applied.discountKobo, subtotalKobo: applied.subtotalKobo }
            : null,
          shipping: selectedShipping
            ? {
                optionId: selectedShipping.id,
                type: selectedShipping.type,
                name: selectedShipping.name,
                feeKobo: Number(selectedShipping.feeKobo || 0),
              }
            : null,
        },
      }),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      alert(data?.error || "Paystack init failed");
      return;
    }

    window.location.href = data.authorization_url;
  }

  function goBankTransfer() {
    saveCheckoutProfile({ email, fullName, phone, address });
    // shipping selection already saved in localStorage
    router.push(`/b/${slug}/pay/direct?name=${encodeURIComponent(fullName)}&phone=${encodeURIComponent(phone)}`);
  }

  const shippingRequired = shippingOptions.length > 0;
  const pickedPickup = selectedShipping?.type === "pickup";

  const canPay =
    !!fullName &&
    !!phone &&
    !!email &&
    emailVerified &&
    (!shippingRequired || !!selectedShipping) &&
    (pickedPickup ? true : !!address);

  return (
    <div className="min-h-screen">
      <GradientHeader title="Checkout" subtitle="Complete your order" showBack={true} />

      <div className="px-4 pb-28 space-y-3">
        <div className="rounded-[26px] p-4 text-white shadow-float bg-gradient-to-br from-biz-accent2 to-biz-accent">
          <p className="text-sm font-bold">Order total</p>
          <p className="text-xs opacity-95 mt-1">
            Store: <b>{slug}</b>
          </p>

          <p className="text-2xl font-bold mt-2">{fmtNaira(grandTotalNgn)}</p>

          <p className="text-[11px] opacity-95 mt-2">
            Subtotal: <b>{fmtNaira(subtotal)}</b>
            {applied ? (
              <>
                {" "}
                • Discount: <b>{fmtNaira(discountKobo / 100)}</b>
              </>
            ) : null}
            {selectedShipping ? (
              <>
                {" "}
                • Shipping: <b>{fmtNaira(shippingFeeKobo / 100)}</b>
              </>
            ) : null}
          </p>
        </div>

        <SectionCard title="Shipping" subtitle="Choose delivery or pickup">
          {shipLoading ? <p className="text-sm text-biz-muted">Loading shipping options…</p> : null}
          {shipMsg ? <p className="text-sm text-red-700">{shipMsg}</p> : null}

          {!shipLoading && !shipMsg && shippingOptions.length === 0 ? (
            <p className="text-sm text-biz-muted">This store has not set shipping options yet. You can proceed (shipping = ₦0).</p>
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
            <Input placeholder="Enter coupon code" value={couponCode} onChange={(e) => setCouponCode(e.target.value.toUpperCase())} />

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

            {/* Address required only for delivery */}
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

        <div className="fixed bottom-0 left-0 right-0 z-40">
          <div className="mx-auto w-full max-w-[430px] px-4 safe-pb pb-4">
            <Card className="p-4 space-y-2">
              <Button onClick={handlePaystack} disabled={!canPay}>
                Pay with Paystack
              </Button>

              <Button variant="secondary" onClick={goBankTransfer} disabled={!canPay}>
                Pay with Bank Transfer
              </Button>

              {!canPay ? (
                <p className="text-[11px] text-biz-muted">
                  Ensure shipping is selected, and fill required fields (address required for delivery).
                </p>
              ) : null}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}