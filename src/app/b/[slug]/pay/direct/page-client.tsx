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

const NAIRA = "\u20A6"; // ₦
const BULLET = "\u2022"; // •

function fmtNaira(n: number) {
  try {
    return `${NAIRA}${Number(n || 0).toLocaleString()}`;
  } catch {
    return `${NAIRA}${n}`;
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

  // order id for upload (comes from URL or created after "I have paid")
  const [orderId, setOrderId] = useState<string>(sp.get("orderId") ?? "");

  // checkout profile (address/email)
  const [profileEmail, setProfileEmail] = useState("");
  const [profileAddress, setProfileAddress] = useState("");

  // proof upload
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [uploadingProof, setUploadingProof] = useState(false);
  const [proofMsg, setProofMsg] = useState<string | null>(null);
  const [proofViewUrl, setProofViewUrl] = useState<string>("");

  // shipping
  const [shipLoading, setShipLoading] = useState(false);
  const [shipMsg, setShipMsg] = useState<string | null>(null);
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [selectedShipId, setSelectedShipId] = useState<string>("");

  // server quote
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteMsg, setQuoteMsg] = useState<string | null>(null);
  const [quote, setQuote] = useState<any>(null);

  const localSubtotalKobo = Math.floor(Number(subtotal || 0) * 100);
  const applied = getCouponForCheckout({ storeSlug: slug, subtotalKobo: localSubtotalKobo });
  const couponCode = applied?.code ? String(applied.code) : "";

  useEffect(() => {
    const p = loadCheckoutProfile();
    setProfileEmail(p.email || "");
    setProfileAddress(p.address || "");
    if (!payerName && p.fullName) setPayerName(p.fullName);
    if (!payerPhone && p.phone) setPayerPhone(p.phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Keep orderId in sync if user opens link with ?orderId=
  useEffect(() => {
    const oid = sp.get("orderId") ?? "";
    if (oid && oid !== orderId) setOrderId(oid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp]);

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

  // Load store payout details
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

  // Server quote (sale first, coupon after sale)
  async function fetchQuote() {
    try {
      if (!cart.storeSlug || cart.storeSlug !== slug || cart.items.length === 0) {
        setQuote(null);
        setQuoteMsg("Cart does not match this store.");
        return;
      }

      setQuoteLoading(true);
      setQuoteMsg(null);

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
          couponCode: couponCode || null,
          shippingFeeKobo,
        }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || "Failed to compute total");

      setQuote(data);
    } catch (e: any) {
      setQuote(null);
      setQuoteMsg(e?.message || "Failed to compute total");
    } finally {
      setQuoteLoading(false);
    }
  }

  useEffect(() => {
    fetchQuote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, cart.items.length, localSubtotalKobo, selectedShipId, shippingFeeKobo, couponCode]);

  const pricing = quote?.pricing || null;

  const grandTotalKobo = pricing ? Number(pricing.totalKobo || 0) : Math.max(0, localSubtotalKobo + shippingFeeKobo);
  const grandTotalNgn = grandTotalKobo / 100;

  const originalSubtotalKobo = pricing ? Number(pricing.originalSubtotalKobo || 0) : localSubtotalKobo;
  const saleDiscountKobo = pricing ? Number(pricing.saleDiscountKobo || 0) : 0;
  const couponDiscountKobo = pricing ? Number(pricing.couponDiscountKobo || 0) : 0;

  const bankName = biz?.payoutDetails?.bankName ?? "";
  const accountNumber = biz?.payoutDetails?.accountNumber ?? "";
  const accountName = biz?.payoutDetails?.accountName ?? "";

  const shippingRequired = shippingOptions.length > 0;
  const canConfirm = useMemo(() => !!payerName.trim() && !!payerPhone.trim(), [payerName, payerPhone]);

  function replaceUrlWithOrder(oid: string) {
    const url = `/b/${encodeURIComponent(slug)}/pay/direct?orderId=${encodeURIComponent(oid)}&name=${encodeURIComponent(
      payerName || ""
    )}&phone=${encodeURIComponent(payerPhone || "")}`;
    router.replace(url);
  }

  async function confirmIHavePaid() {
    // If order already exists (e.g. user refreshed), just go to order page
    if (orderId) {
      router.push(`/orders/${orderId}`);
      return;
    }

    if (!cart.storeSlug || cart.storeSlug !== slug || cart.items.length === 0) {
      alert("Cart does not match this store. Go back to cart.");
      router.push("/cart");
      return;
    }

    if (!biz?.id) {
      alert("Store not loaded yet.");
      return;
    }

    if (shippingRequired && !selectedShipping) {
      alert("Please select shipping first.");
      router.push(`/b/${slug}/checkout`);
      return;
    }

    // Fresh quote right before creating order
    await fetchQuote();

    const r = await fetch("/api/orders/direct/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        storeSlug: slug,
        businessSlug: slug, // backward compatible
        items: cart.items,
        customer: {
          fullName: payerName,
          phone: payerPhone,
          email: profileEmail || "",
          address: selectedShipping?.type === "pickup" ? "" : profileAddress || "",
        },
        coupon: couponCode ? { code: couponCode } : null,
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

    const oid = String(data.orderId || "");
    if (!oid) {
      alert("Order created but missing orderId.");
      return;
    }

    addRecentOrderId(oid);
    clearCart();

    setOrderId(oid);
    setProofMsg("Order created. Upload your proof below.");
    replaceUrlWithOrder(oid);
  }

  async function uploadProof() {
    if (!orderId) {
      setProofMsg("Create the order first (tap “I have paid”).");
      return;
    }
    if (!proofFile) {
      setProofMsg("Select a screenshot/PDF proof first.");
      return;
    }

    setUploadingProof(true);
    setProofMsg(null);

    try {
      const fd = new FormData();
      fd.append("file", proofFile);
      fd.append("customerPhone", payerPhone || "");
      fd.append("customerEmail", profileEmail || "");

      const r = await fetch(`/api/public/orders/${encodeURIComponent(orderId)}/transfer-proof`, {
        method: "POST",
        body: fd,
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || data?.code || "Upload failed");

      setProofViewUrl(String(data?.proof?.secureUrl || ""));
      setProofMsg("Proof uploaded. Waiting for vendor confirmation.");
      setProofFile(null);
    } catch (e: any) {
      setProofMsg(e?.message || "Failed to upload proof");
    } finally {
      setUploadingProof(false);
    }
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="Bank Transfer" showBack={true} subtitle="Pay directly to vendor" />

      <div className="px-4 pb-28 space-y-3">
        <div className="rounded-[26px] p-4 text-white shadow-float bg-gradient-to-br from-biz-accent2 to-biz-accent">
          <p className="text-sm font-bold">Transfer Amount</p>
          <p className="text-2xl font-bold mt-2">{fmtNaira(grandTotalNgn)}</p>

          <p className="text-[11px] opacity-95 mt-2">
            Original subtotal: <b>{fmtNaira(originalSubtotalKobo / 100)}</b>
            {saleDiscountKobo > 0 ? (
              <>
                {" "}
                {BULLET} Sale discount: <b>{fmtNaira(saleDiscountKobo / 100)}</b>
              </>
            ) : null}
            {couponDiscountKobo > 0 ? (
              <>
                {" "}
                {BULLET} Coupon: <b>{fmtNaira(couponDiscountKobo / 100)}</b>
                {couponCode ? <> ({couponCode})</> : null}
              </>
            ) : couponCode ? (
              <>
                {" "}
                {BULLET} Coupon: <b>{couponCode}</b>
              </>
            ) : null}
            {selectedShipping ? (
              <>
                {" "}
                {BULLET} Shipping: <b>{fmtNaira(shippingFeeKobo / 100)}</b>
              </>
            ) : null}
          </p>

          {quoteLoading ? <p className="text-[11px] opacity-95 mt-2">Updating total…</p> : null}
          {quoteMsg ? <p className="text-[11px] text-red-100 mt-2">{quoteMsg}</p> : null}
        </div>

        {/* Bank details */}
        <Card className="p-4">
          {loading ? <p>Loading…</p> : null}
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

        {/* Proof upload (shows after order exists) */}
        <Card className="p-4">
          <p className="font-bold text-biz-ink">Upload proof of payment</p>
          <p className="text-xs text-biz-muted mt-1">
            After transferring, upload a screenshot or PDF. (Paid stores only)
          </p>

          {!orderId ? (
            <div className="mt-3">
              <p className="text-sm text-biz-muted">
                Create the order first by tapping <b>“I have paid”</b>. Then you can upload proof here.
              </p>
            </div>
          ) : (
            <div className="mt-3 space-y-2">
              <div className="rounded-2xl border border-biz-line bg-white p-3">
                <p className="text-xs text-biz-muted">Order ID</p>
                <p className="text-sm font-bold text-biz-ink break-all">{orderId}</p>
              </div>

              <input
                type="file"
                accept="image/*,application/pdf"
                className="w-full border border-biz-line rounded-2xl p-3 text-sm bg-white"
                onChange={(e) => setProofFile(e.target.files?.[0] || null)}
              />

              <Button onClick={uploadProof} loading={uploadingProof} disabled={uploadingProof || !proofFile}>
                Upload proof
              </Button>

              {proofMsg ? (
                <p className={proofMsg.toLowerCase().includes("uploaded") ? "text-sm text-emerald-700" : "text-sm text-red-700"}>
                  {proofMsg}
                </p>
              ) : null}

              {proofViewUrl ? (
                <Button variant="secondary" onClick={() => window.open(proofViewUrl, "_blank")}>
                  View uploaded proof
                </Button>
              ) : null}

              <Button variant="secondary" onClick={() => router.push(`/orders/${orderId}`)}>
                View order status
              </Button>
            </div>
          )}
        </Card>

        {/* Shipping */}
        <Card className="p-4">
          <p className="font-bold text-biz-ink">Shipping</p>
          {shipLoading ? <p className="text-sm text-biz-muted mt-2">Loading shipping…</p> : null}
          {shipMsg ? <p className="text-sm text-red-700 mt-2">{shipMsg}</p> : null}

          {!shipLoading && !shipMsg ? (
            selectedShipping ? (
              <div className="mt-2 rounded-2xl border border-biz-line bg-white p-3">
                <p className="text-sm font-bold text-biz-ink">{selectedShipping.name}</p>
                <p className="text-[11px] text-biz-muted mt-1">
                  {selectedShipping.type === "pickup" ? "Pickup" : "Delivery"} {BULLET} Fee:{" "}
                  <b className="text-biz-ink">{fmtNaira(shippingFeeKobo / 100)}</b>
                </p>
                <div className="mt-2">
                  <Button variant="secondary" size="sm" onClick={() => router.push(`/b/${slug}/checkout`)}>
                    Edit shipping
                  </Button>
                </div>
              </div>
            ) : shippingRequired ? (
              <p className="text-sm text-biz-muted mt-2">No shipping selected. Go back to checkout and choose shipping.</p>
            ) : (
              <p className="text-sm text-biz-muted mt-2">No shipping configured by this store (shipping = ₦0).</p>
            )
          ) : null}
        </Card>

        {/* Customer details */}
        <Card className="p-4">
          <p className="font-bold text-biz-ink">Your details</p>
          <div className="mt-3 space-y-2">
            <InputLike value={payerName} setValue={setPayerName} placeholder="Your name" />
            <InputLike value={payerPhone} setValue={setPayerPhone} placeholder="Phone number" />
          </div>
        </Card>

        {/* Bottom action */}
        <div className="fixed bottom-0 left-0 right-0 z-40">
          <div className="mx-auto w-full max-w-[430px] px-4 safe-pb pb-4">
            <Card className="p-4 space-y-2">
              <button
                className="w-full rounded-2xl py-3 text-sm font-bold text-white shadow-float bg-gradient-to-br from-biz-accent2 to-biz-accent disabled:opacity-50"
                onClick={confirmIHavePaid}
                disabled={
                  (!orderId && (!canConfirm || (shippingRequired && !selectedShipping) || quoteLoading || !!quoteMsg)) ||
                  (orderId ? false : false)
                }
              >
                {orderId ? "View order status" : "I have paid"}
              </button>

              {shippingRequired && !selectedShipping && !orderId ? (
                <Button variant="secondary" onClick={() => router.push(`/b/${slug}/checkout`)}>
                  Choose shipping
                </Button>
              ) : null}

              {!!quoteMsg && !orderId ? (
                <p className="text-[11px] text-biz-muted">If totals failed to update, go back to checkout and try again.</p>
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