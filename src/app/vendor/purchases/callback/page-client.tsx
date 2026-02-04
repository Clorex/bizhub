"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { auth } from "@/lib/firebase/client";

export default function VendorPurchasesCallbackPageClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const reference = String(sp.get("reference") || "").trim();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string>("Confirming purchase…");

  async function authedFetch(path: string, init?: RequestInit) {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(path, {
      ...init,
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || data?.code || "Request failed");
    return data;
  }

  useEffect(() => {
    let mounted = true;

    async function run() {
      if (!reference) {
        setLoading(false);
        setMsg("Missing reference.");
        return;
      }

      try {
        setLoading(true);
        setMsg("Confirming purchase…");

        await authedFetch("/api/vendor/purchases/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reference }),
        });

        if (!mounted) return;
        setMsg("Purchase confirmed. Add-on activated (or extended).");
      } catch (e: any) {
        if (!mounted) return;
        setMsg(e?.message || "Failed to confirm purchase");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, [reference]);

  return (
    <div className="min-h-screen">
      <GradientHeader title="Purchase status" subtitle="Plan add-ons" showBack={true} />
      <div className="px-4 pb-24 space-y-3">
        <Card className="p-4">{msg}</Card>

        <Card className="p-4 space-y-2">
          <Button onClick={() => router.push("/vendor/purchases")} disabled={loading}>
            Back to Plan purchases
          </Button>
          <Button variant="secondary" onClick={() => router.push("/vendor")} disabled={loading}>
            Go to Dashboard
          </Button>
        </Card>
      </div>
    </div>
  );
}