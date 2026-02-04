// FILE: src/app/payment/callback/page.tsx
"use client";



import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { addRecentOrderId } from "@/lib/orders/recent";
import { Button } from "@/components/ui/Button";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

function PaymentCallbackInner() {
  const sp = useSearchParams();
  const reference = sp.get("reference") ?? sp.get("trxref");

  const [status, setStatus] = useState<"loading" | "error" | "confirmed">("loading");
  const [msg, setMsg] = useState("Finalizing payment...");
  const [orderId, setOrderId] = useState<string | null>(null);
  const [storeSlug, setStoreSlug] = useState<string | null>(null);
  const [holdUntilMs, setHoldUntilMs] = useState<number>(0);

  const waitSeconds = useMemo(() => {
    if (!holdUntilMs) return 300;
    return Math.max(0, Math.ceil((holdUntilMs - Date.now()) / 1000));
  }, [holdUntilMs]);

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        if (!reference) {
          setMsg("Missing payment reference.");
          setStatus("error");
          return;
        }

        const r = await fetch("/api/escrow/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference }),
        });

        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          setMsg(data?.error || "Failed to confirm payment.");
          setStatus("error");
          return;
        }

        const oid = String(data.orderId);
        const slug = String(data.businessSlug || data.storeSlug || "");

        addRecentOrderId(oid);

        if (!mounted) return;
        setOrderId(oid);
        setStoreSlug(slug);
        setHoldUntilMs(Number(data.holdUntilMs || 0));

        setStatus("confirmed");
        setMsg("Order confirmed. Funds are held briefly for safety.");

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
  }, [reference]);

  return (
    <div className="min-h-screen">
      <GradientHeader title="Payment" subtitle="Paystack confirmation" showBack={true} />

      <div className="px-4 pb-24 space-y-3">
        <Card className="p-5 text-center">
          {status === "loading" ? (
            <>
              <div className="mx-auto h-14 w-14 rounded-2xl bg-biz-cream flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-orange-700 animate-spin" />
              </div>
              <p className="mt-4 text-base font-bold text-biz-ink">Processingâ€¦</p>
              <p className="text-sm text-biz-muted mt-2">{msg}</p>
              <p className="text-[11px] text-gray-500 mt-3 break-all">Payment ID: {reference || "â€”"}</p>
            </>
          ) : null}

          {status === "error" ? (
            <>
              <div className="mx-auto h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <p className="mt-4 text-base font-bold text-biz-ink">Payment issue</p>
              <p className="text-sm text-red-700 mt-2">{msg}</p>
              <p className="text-[11px] text-gray-500 mt-3 break-all">Payment ID: {reference || "â€”"}</p>

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

              <p className="mt-4 text-lg font-bold text-biz-ink">Order confirmed</p>
              <p className="text-sm text-gray-700 mt-2">{msg}</p>

              {holdUntilMs ? <p className="mt-2 text-[11px] text-gray-500">Hold: ~{waitSeconds}s remaining</p> : null}

              <div className="mt-4 space-y-2">
                {orderId ? (
                  <Link href={`/orders/${orderId}`} className="block">
                    <Button>Track my order</Button>
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

              <p className="mt-4 text-[11px] text-biz-muted">If anything is wrong, open the order and raise a dispute immediately.</p>
            </>
          ) : null}
        </Card>
      </div>
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen">
          <GradientHeader title="Payment" subtitle="Paystack confirmation" showBack={true} />
          <div className="px-4 pb-24">
            <Card className="p-4">Loadingâ€¦</Card>
          </div>
        </div>
      }
    >
      <PaymentCallbackInner />
    </Suspense>
  );
}

