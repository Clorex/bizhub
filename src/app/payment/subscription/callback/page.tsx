"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

const EM_DASH = "\u2014"; // —

function SubscriptionCallbackInner() {
  const sp = useSearchParams();
  const reference = sp.get("reference") ?? sp.get("trxref");

  const [status, setStatus] = useState<"loading" | "error" | "ok">("loading");
  const [msg, setMsg] = useState("Confirming subscription...");

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        if (!reference) {
          setStatus("error");
          setMsg("Missing Paystack reference.");
          return;
        }

        const r = await fetch("/api/subscriptions/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference }),
        });

        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.error || "Confirmation failed");

        if (!mounted) return;
        setStatus("ok");
        setMsg("Subscription activated successfully.");
      } catch (e: any) {
        if (!mounted) return;
        setStatus("error");
        setMsg(e?.message || "Failed");
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, [reference]);

  return (
    <div className="min-h-screen">
      <GradientHeader title="Subscription" subtitle="Payment confirmation" showBack={true} />

      <div className="px-4 pb-24">
        <Card className="p-5 text-center">
          {status === "loading" ? (
            <>
              <div className="mx-auto h-14 w-14 rounded-2xl bg-biz-cream flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-orange-700 animate-spin" />
              </div>
              <p className="mt-4 text-base font-bold text-biz-ink">Processing...</p>
              <p className="text-sm text-biz-muted mt-2">{msg}</p>
            </>
          ) : null}

          {status === "ok" ? (
            <>
              <div className="mx-auto h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <p className="mt-4 text-base font-bold text-biz-ink">Done</p>
              <p className="text-sm text-biz-muted mt-2">{msg}</p>
            </>
          ) : null}

          {status === "error" ? (
            <>
              <div className="mx-auto h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <p className="mt-4 text-base font-bold text-biz-ink">Issue</p>
              <p className="text-sm text-red-700 mt-2">{msg}</p>
            </>
          ) : null}

          <p className="text-[11px] text-gray-500 mt-3 break-all">Payment ID: {reference || EM_DASH}</p>

          <div className="mt-4 space-y-2">
            <Link href="/vendor" className="block">
              <Button>Go to dashboard</Button>
            </Link>
            <Link href="/vendor/subscription" className="block">
              <Button variant="secondary">View plans</Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default function SubscriptionCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen">
          <GradientHeader title="Subscription" subtitle="Payment confirmation" showBack={true} />
          <div className="px-4 pb-24">
            <Card className="p-4">Loading</Card>
          </div>
        </div>
      }
    >
      <SubscriptionCallbackInner />
    </Suspense>
  );
}