"use client";



import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { db } from "@/lib/firebase/client";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { useCart } from "@/lib/cart/CartContext";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { addRecentOrderId } from "@/lib/orders/recent";
import { getCouponForCheckout } from "@/lib/checkout/coupon";
import { loadCheckoutProfile } from "@/lib/checkout/profile";
import { getShippingForCheckout, saveAppliedShipping } from "@/lib/checkout/shipping";
import { Button } from "@/components/ui/Button";

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
    return `â‚¦${Number(n || 0).toLocaleString()}`;
  } catch {
    return `â‚¦${n}`;
  }
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    alert("Copied");
  } catch {
    alert("Copy failed");
  }
}

export default function DirectPayPage() {
  const params = useParams();
  const router = useRouter();
  const sp = useSearchParams();
  const slug = String((params as any)?.slug ?? "");

  const { cart, subtotal, clearCart } = useCart();

  const [loading, setLoading] = useState(true);
  const [biz, setBiz] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [payerName, setPayerName] = useState(sp.get("name") ?? "");
  const [payerPhone, setPayerPhone] = useState(sp.get("phone") ?? "");

  // checkout profile (address/email)
  const [profileEmail, setProfileEmail] = useState("");
  const [profileAddress, setProfileAddress] = useState("");

  // shipping
  const [shipLoading, setShipLoading] = useState(false);
  const [shipMsg, setShipMsg] = useState<string | null>(null);
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShipId, setSelectedShipId] = useState<string>("");

  const subtotalKobo = Math.floor(Number(subtotal || 0) * 100);
  const applied = getCouponForCheckout({ storeSlug: slug, subtotalKobo });
  const discountKobo = Number(applied?.discountKobo || 0);

  const baseTotalKobo = Math.max(0, subtotalKobo - discountKobo);

  useEffect(() => {
    const p = loadCheckoutProfile();
    setProfileEmail(p.email || "");
    setProfileAddress(p.address || "");
    if (!payerName && p.fullName) setPayerName(p.fullName);
    if (!payerPhone && p.phone) setPayerPhone(p.phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Load saved shipping, then fetch options to validate/default
  useEffect(() => {
    const s = getShippingForCheckout({ storeSlug: slug });
    setSelectedShipId(s?.optionId || "");
  }, [slug]);

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
        }
      } catch (e: any) {
        if (!mounted) return;
        setShipMsg(e?.message || "Failed to load shipping options");
        setShippingOptions([]);
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

  const shippingFeeKobo = Number(selectedShipping?.feeKobo || 0);
  const grandTotalKobo = Math.max(0, baseTotalKobo + shippingFeeKobo);
  const grandTotalNgn = grandTotalKobo / 100;

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        setLoading(true);
        setError(null);

        const qBiz = query(collection(db, "businesses"), where("slug", "==", slug), limit(1));
        const snap = await getDocs(qBiz);
        if (snap.empty) {
          setError("Store not found");
          setBiz(null);
          return;
        }

        const d = snap.docs[0];
        if (!mounted) return;
        setBiz({ id: d.id, ...d.data() });
      } catch (e: any) {
        setError(e?.message || "Failed to load store");
        setBiz(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (slug) run();
    return () => {
      mounted = false;
    };
  }, [slug]);

  const bankName = biz?.payoutDetails?.bankName ?? "";
  const accountNumber = biz?.payoutDetails?.accountNumber ?? "";
  const accountName = biz?.payoutDetails?.accountName ?? "";

  const canConfirm = useMemo(() => !!payerName && !!payerPhone, [payerName, payerPhone]);

  async function confirmIHavePaid() {
    if (!cart.storeSlug || cart.storeSlug !== slug || cart.items.length === 0) {
      alert("Cart does not match this store. Go back to cart.");
      router.push("/cart");
      return;
    }

    if (!biz?.id) {
      alert("Store not loaded yet.");
      return;
    }

    const r = await fetch("/api/orders/direct/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        businessId: biz.id,
        businessSlug: slug,
        items: cart.items,
        amountKobo: grandTotalKobo,
        customer: {
          fullName: payerName,
          phone: payerPhone,
          email: profileEmail || "",
          address: selectedShipping?.type === "pickup" ? "" : (profileAddress || ""),
        },
        coupon: applied
          ? { code: applied.code, discountKobo: applied.discountKobo, subtotalKobo: applied.subtotalKobo }
          : null,
        shipping: selectedShipping
          ? { optionId: selectedShipping.id, type: selectedShipping.type, name: selectedShipping.name, feeKobo: shippingFeeKobo }
          : null,
      }),
    });

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      alert(data?.error || "Failed to create order");
      return;
    }

    addRecentOrderId(data.orderId);
    clearCart();
    router.push(`/orders/${data.orderId}`);
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="Bank Transfer" showBack={true} subtitle="Pay directly to vendor" />

      <div className="px-4 pb-28 space-y-3">
        <div className="rounded-[26px] p-4 text-white shadow-float bg-gradient-to-br from-biz-accent2 to-biz-accent">
          <p className="text-sm font-bold">Transfer Amount</p>
          <p className="text-2xl font-bold mt-2">{fmtNaira(grandTotalNgn)}</p>
          <p className="text-[11px] opacity-95 mt-2">
            Subtotal: <b>{fmtNaira(subtotal)}</b>
            {applied ? <> â€¢ Discount: <b>{fmtNaira(discountKobo / 100)}</b> â€¢ Code: <b>{applied.code}</b></> : null}
            {selectedShipping ? <> â€¢ Shipping: <b>{fmtNaira(shippingFeeKobo / 100)}</b></> : null}
          </p>
        </div>

        <Card className="p-4">
          {loading ? <p>Loadingâ€¦</p> : null}
          {error ? <p className="text-red-700">{error}</p> : null}

          {!loading && !error ? (
            <div className="space-y-3">
              <div className="rounded-2xl border border-biz-line p-3 bg-white">
                <p className="text-xs text-biz-muted">Bank</p>
                <p className="font-bold text-biz-ink mt-1">{bankName || "Not set"}</p>
              </div>

              <div className="rounded-2xl border border-biz-line p-3 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-biz-muted">Account Number</p>
                    <p className="font-bold text-biz-ink mt-1">{accountNumber || "Not set"}</p>
                  </div>
                  {accountNumber ? (
                    <button className="text-xs font-bold text-biz-accent" onClick={() => copy(accountNumber)}>
                      Copy
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="rounded-2xl border border-biz-line p-3 bg-white">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-biz-muted">Account Name</p>
                    <p className="font-bold text-biz-ink mt-1">{accountName || "Not set"}</p>
                  </div>
                  {accountName ? (
                    <button className="text-xs font-bold text-biz-accent" onClick={() => copy(accountName)}>
                      Copy
                    </button>
                  ) : null}
                </div>
              </div>

              <p className="text-xs text-biz-muted">
                Tip: Put your name in the transfer narration so the vendor can confirm faster.
              </p>
            </div>
          ) : null}
        </Card>

        <Card className="p-4">
          <p className="font-bold text-biz-ink">Shipping</p>
          {shipLoading ? <p className="text-sm text-biz-muted mt-2">Loading shippingâ€¦</p> : null}
          {shipMsg ? <p className="text-sm text-red-700 mt-2">{shipMsg}</p> : null}

          {!shipLoading && !shipMsg ? (
            selectedShipping ? (
              <div className="mt-2 rounded-2xl border border-biz-line bg-white p-3">
                <p className="text-sm font-bold text-biz-ink">{selectedShipping.name}</p>
                <p className="text-[11px] text-biz-muted mt-1">
                  {selectedShipping.type === "pickup" ? "Pickup" : "Delivery"} â€¢ Fee:{" "}
                  <b className="text-biz-ink">{fmtNaira(shippingFeeKobo / 100)}</b>
                </p>
                <div className="mt-2">
                  <Button variant="secondary" size="sm" onClick={() => router.push(`/b/${slug}/checkout`)}>
                    Edit shipping
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-biz-muted mt-2">
                No shipping selected. Go back to checkout and choose shipping.
              </p>
            )
          ) : null}
        </Card>

        <Card className="p-4">
          <p className="font-bold text-biz-ink">Your details</p>
          <div className="mt-3 space-y-2">
            <InputLike value={payerName} setValue={setPayerName} placeholder="Your name" />
            <InputLike value={payerPhone} setValue={setPayerPhone} placeholder="Phone number" />
          </div>
        </Card>

        <div className="fixed bottom-0 left-0 right-0 z-40">
          <div className="mx-auto w-full max-w-[430px] px-4 safe-pb pb-4">
            <Card className="p-4 space-y-2">
              <button
                className="w-full rounded-2xl py-3 text-sm font-bold text-white shadow-float bg-gradient-to-br from-biz-accent2 to-biz-accent disabled:opacity-50"
                onClick={confirmIHavePaid}
                disabled={!canConfirm || (shippingOptions.length > 0 && !selectedShipping)}
              >
                I have paid
              </button>

              {shippingOptions.length > 0 && !selectedShipping ? (
                <Button variant="secondary" onClick={() => router.push(`/b/${slug}/checkout`)}>
                  Choose shipping
                </Button>
              ) : null}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function InputLike({
  value,
  setValue,
  placeholder,
}: {
  value: string;
  setValue: (v: string) => void;
  placeholder: string;
}) {
  return (
    <input
      className="w-full border border-biz-line rounded-2xl p-3 text-sm outline-none focus:ring-2 focus:ring-biz-accent/30 focus:border-biz-accent/40 bg-white"
      placeholder={placeholder}
      value={value}
      onChange={(e) => setValue(e.target.value)}
    />
  );
}
