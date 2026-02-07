// FILE: src/app/payment/callback/page-client.tsx
"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { addRecentOrderId } from "@/lib/orders/recent";
import { Button } from "@/components/ui/Button";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

function code4DigitsFromReference(ref: string) {
  // Deterministic 4-digit code derived from reference, digits only.
  // Not used for payment verification (just customer-friendly display).
  let h = 0;
  for (let i = 0; i < ref.length; i++) {
    h = (h * 31 + ref.charCodeAt(i)) | 0;
  }
  const n = Math.abs(h) % 10000;
  return String(n).padStart(4, "0");
}

function PaymentCallbackInner() {
  const sp = useSearchParams();

  // Read once from URL, then keep stable even after we clean the URL.
  const initial = useMemo(() => {
    const reference = sp.get("tx_ref") ?? sp.get("reference") ?? sp.get("trxref") ?? "";
    const transactionId = sp.get("transaction_id") ?? sp.get("transactionId") ?? "";
    return { reference: String(reference || "").trim(), transactionId: String(transactionId || "").trim() };
  }, [sp]);

  const [reference] = useState(initial.reference);
  const [transactionId] = useState(initial.transactionId);

  const paymentCode = useMemo(() => (reference ? code4DigitsFromReference(reference) : ""), [reference]);

  const [status, setStatus] = useState<"loading" | "error" | "confirmed">("loading");
  const [msg, setMsg] = useState("Finalizing payment...");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [holdUntilMs, setHoldUntilMs] = useState<number>(0);

  const waitSeconds = useMemo(() => {
    if (!holdUntilMs) return 0;
    return Math.max(0, Math.ceil((holdUntilMs - Date.now()) / 1000));
  }, [holdUntilMs]);

  // ✅ Hide ugly query params from customers (remove tx_ref/transaction_id from the URL)
  useEffect(() => {
    try {
      if (typeof window === "undefined") return;
      if (!reference) return;
      const next = paymentCode ? `/payment/callback?code=${encodeURIComponent(paymentCode)}` : "/payment/callback";
      window.history.replaceState(null, "", next);
    } catch {
      // ignore
    }
  }, [reference, paymentCode]);

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        if (!reference) {
          setMsg("We couldn’t detect your payment reference. Please try again.");
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

        if (oid) addRecentOrderId(oid);

        if (!mounted) return;
        setOrderId(oid || null);
        setStoreSlug(slug || null);
        setHoldUntilMs(Number(data.holdUntilMs || 0));

        setStatus("confirmed");
        setMsg("Payment received. Your order has been created.");

        // keep your auto-release logic (silent)
        const waitMs = Math.max(0, Number(data.holdUntilMs || 0) - Date.now());
        setTimeout(async () => {
          try {
            await fetch("/api/escrow/release", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ orderId: oid }),
            });
          } catch {
            // ignore
          }
        }, waitMs + 500);
      } catch (e: any) {
        setMsg(e?.message || "Something went wrong.");
        setStatus("error");
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, [reference, transactionId]);

  return (
    <div className="min-h-screen">
      <GradientHeader title="Payment" subtitle="Payment confirmation" showBack={true} />

      <div className="px-4 pb-24 space-y-3">
        <Card className="p-5 text-center">
          {status === "loading" ? (
            <>
              <div className="mx-auto h-14 w-14 rounded-2xl bg-biz-cream flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-orange-700 animate-spin" />
              </div>
              <p className="mt-4 text-base font-bold text-biz-ink">Processing...</p>
              <p className="text-sm text-biz-muted mt-2">{msg}</p>

              {paymentCode ? (
                <p className="text-[11px] text-gray-500 mt-3">
                  Payment code: <b className="text-biz-ink">{paymentCode}</b>
                </p>
              ) : null}
            </>
          ) : null}

          {status === "error" ? (
            <>
              <div className="mx-auto h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <p className="mt-4 text-base font-bold text-biz-ink">Payment issue</p>
              <p className="text-sm text-red-700 mt-2">{msg}</p>

              {paymentCode ? (
                <p className="text-[11px] text-gray-500 mt-3">
                  Payment code: <b className="text-biz-ink">{paymentCode}</b>
                </p>
              ) : null}

              <div className="mt-4 space-y-2">
                <Link href="/orders" className="block">
                  <Button>Go to Orders</Button>
                </Link>
                <Link href="/market" className="block">
                  <Button variant="secondary">Go to Market</Button>
                </Link>
              </div>
            </>
          ) : null}

          {status === "confirmed" ? (
            <>
              <div className="mx-auto h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>

              <p className="mt-4 text-lg font-bold text-biz-ink">Payment successful</p>
              <p className="text-sm text-gray-700 mt-2">{msg}</p>

              {paymentCode ? (
                <p className="mt-2 text-[11px] text-gray-500">
                  Payment code: <b className="text-biz-ink">{paymentCode}</b>
                </p>
              ) : null}

              {holdUntilMs ? (
                <p className="mt-2 text-[11px] text-gray-500">
                  Processing time: ~{waitSeconds}s
                </p>
              ) : null}

              <div className="mt-4 space-y-2">
                {orderId ? (
                  <Link href={`/orders/${orderId}`} className="block">
                    <Button>View my order</Button>
                  </Link>
                ) : null}

                {storeSlug ? (
                  <Link href={`/b/${storeSlug}`} className="block">
                    <Button variant="secondary">Continue shopping</Button>
                  </Link>
                ) : (
                  <Link href="/market" className="block">
                    <Button variant="secondary">Continue</Button>
                  </Link>
                )}
              </div>
            </>
          ) : null}
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