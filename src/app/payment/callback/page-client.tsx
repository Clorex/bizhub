"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { addRecentOrderId } from "@/lib/orders/recent";
import { Button } from "@/components/ui/Button";
import { CheckCircle2, AlertTriangle, Loader2, Copy, Check } from "lucide-react";

function PaymentCallbackInner() {
  const sp = useSearchParams();

  const initial = useMemo(() => {
    const reference = sp.get("tx_ref") ?? sp.get("reference") ?? sp.get("trxref") ?? "";
    const transactionId = sp.get("transaction_id") ?? sp.get("transactionId") ?? "";
    return { reference: String(reference || "").trim(), transactionId: String(transactionId || "").trim() };
  }, [sp]);

  const [reference] = useState(initial.reference);
  const [transactionId] = useState(initial.transactionId);

  const [status, setStatus] = useState<"loading" | "error" | "confirmed">("loading");
  const [msg, setMsg] = useState("Finalizing payment...");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [displayRef, setDisplayRef] = useState<string | null>(null);
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Clean URL
  useEffect(() => {
    try {
      if (typeof window === "undefined" || !reference) return;
      window.history.replaceState(null, "", "/payment/callback");
    } catch {}
  }, [reference]);

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        if (!reference) {
          setMsg("We couldn't detect your payment reference. Please try again.");
          setStatus("error");
          return;
        }

        const r = await fetch("/api/escrow/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference, transactionId }),
        });

        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          setMsg(data?.error || "Failed to confirm payment.");
          setStatus("error");
          return;
        }

        const oid = String(data.orderId || "");
        const slug = String(data.businessSlug || data.storeSlug || "");
        const dRef = String(data.displayOrderRef || "");

        if (oid) addRecentOrderId(oid);

        if (!mounted) return;
        setOrderId(oid || null);
        setDisplayRef(dRef || null);
        setStoreSlug(slug || null);

        setStatus("confirmed");
        setMsg("Payment received. Your order has been created.");

        // Silent auto-release
        const waitMs = Math.max(0, Number(data.holdUntilMs || 0) - Date.now());
        setTimeout(async () => {
          try {
            await fetch("/api/escrow/release", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: oid }),
            });
          } catch {}
        }, waitMs + 500);
      } catch (e: any) {
        setMsg(e?.message || "Something went wrong.");
        setStatus("error");
      }
    }

    run();
    return () => { mounted = false; };
  }, [reference, transactionId]);

  const handleCopyId = async () => {
    if (!orderId) return;
    try {
      await navigator.clipboard.writeText(orderId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="min-h-screen">
      <GradientHeader title="Payment" subtitle="Payment confirmation" showBack={true} />

      <div className="px-4 pb-28 space-y-3">
        <Card className="p-5 text-center">
          {status === "loading" && (
            <>
              <div className="mx-auto h-14 w-14 rounded-2xl bg-biz-cream flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-orange-700 animate-spin" />
              </div>
              <p className="mt-4 text-base font-bold text-biz-ink">Processing...</p>
              <p className="text-sm text-biz-muted mt-2">{msg}</p>
            </>
          )}

          {status === "error" && (
            <>
              <div className="mx-auto h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <p className="mt-4 text-base font-bold text-biz-ink">Payment issue</p>
              <p className="text-sm text-red-700 mt-2">{msg}</p>
              <div className="mt-4 space-y-2">
                <Link href="/orders" className="block">
                  <Button>Go to Orders</Button>
                </Link>
                <Link href="/market" className="block">
                  <Button variant="secondary">Go to Market</Button>
                </Link>
              </div>
            </>
          )}

          {status === "confirmed" && (
            <>
              <div className="mx-auto h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>

              <p className="mt-4 text-lg font-bold text-biz-ink">Payment successful!</p>
              <p className="text-sm text-gray-700 mt-2">{msg}</p>

              {displayRef && (
                <div className="mt-4 rounded-2xl bg-orange-50 border border-orange-200 p-4">
                  <p className="text-xs text-orange-600 font-medium">Your Order Reference</p>
                  <p className="text-2xl font-black text-orange-700 mt-1">{displayRef}</p>
                </div>
              )}

              {orderId && (
                <button
                  onClick={handleCopyId}
                  className="mt-2 inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition"
                >
                  {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copied ? "Copied!" : "Copy full order ID"}
                </button>
              )}

              <div className="mt-4 space-y-2">
                {orderId && (
                  <Link href={"/orders/" + orderId} className="block">
                    <Button>View my order</Button>
                  </Link>
                )}
                {storeSlug ? (
                  <Link href={"/b/" + storeSlug} className="block">
                    <Button variant="secondary">Continue shopping</Button>
                  </Link>
                ) : (
                  <Link href="/market" className="block">
                    <Button variant="secondary">Continue</Button>
                  </Link>
                )}
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

export default function PaymentCallbackPageClient() {
  return (
    <Suspense fallback={null}>
      <PaymentCallbackInner />
    </Suspense>
  );
}