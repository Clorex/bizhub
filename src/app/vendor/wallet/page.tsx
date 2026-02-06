"use client";

import { useEffect, useMemo, useState } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { auth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";

function fmtNairaFromKobo(kobo: number) {
  const n = Number(kobo || 0) / 100;
  try {
    return `₦${n.toLocaleString()}`;
  } catch {
    return `₦${n}`;
  }
}

export default function VendorBalancePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [wallet, setWallet] = useState<any>(null);

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        setLoading(true);
        setMsg(null);

        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error("Not logged in");

        const r = await fetch("/api/vendor/wallet", { headers: { Authorization: `Bearer ${token}` } });
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.error || "Failed to load balance");

        if (!mounted) return;
        setWallet(data?.wallet || data);
      } catch (e: any) {
        setMsg(e?.message || "Failed");
        setWallet(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, []);

  const pending = useMemo(() => Number(wallet?.pendingBalanceKobo || 0), [wallet]);
  const available = useMemo(() => Number(wallet?.availableBalanceKobo || 0), [wallet]);
  const hold = useMemo(() => Number(wallet?.withdrawHoldKobo || 0), [wallet]);
  const total = useMemo(() => Number(wallet?.totalEarnedKobo || 0), [wallet]);

  const allZero = !loading && !msg && pending === 0 && available === 0 && hold === 0 && total === 0;

  return (
    <div className="min-h-screen">
      <GradientHeader title="myBizHub Balance" subtitle="Earnings & withdrawals" showBack={true} />

      <div className="px-4 pb-24 space-y-3">
        {loading ? <Card className="p-4">Loading…</Card> : null}
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}

        {/* ✅ Minimal empty state */}
        {allZero ? (
          <Card variant="soft" className="p-5">
            <p className="text-sm font-extrabold text-biz-ink">No earnings yet</p>
            <p className="text-xs text-gray-500 mt-1">Your balance will show here after paid orders.</p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => router.push("/vendor/products/new")}>
                Add product
              </Button>
              <Button variant="secondary" onClick={() => router.push("/vendor/orders")}>
                View orders
              </Button>
            </div>
          </Card>
        ) : null}

        {!loading && !msg && !allZero ? (
          <>
            <div className="rounded-[26px] p-4 text-white shadow-float bg-gradient-to-br from-biz-accent2 to-biz-accent">
              <p className="text-xs opacity-95">Available balance</p>
              <p className="text-2xl font-bold mt-2">{fmtNairaFromKobo(available)}</p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button onClick={() => router.push("/vendor/withdrawals")} disabled={available <= 0}>
                  Withdraw
                </Button>
                <Button variant="secondary" onClick={() => window.location.reload()}>
                  Refresh
                </Button>
              </div>

              <p className="mt-3 text-[11px] opacity-90">
                Pending withdrawals (hold): <b>{fmtNairaFromKobo(hold)}</b>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4">
                <p className="text-xs text-biz-muted">Pending settlement</p>
                <p className="text-lg font-bold text-biz-ink mt-1">{fmtNairaFromKobo(pending)}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-biz-muted">Total earned</p>
                <p className="text-lg font-bold text-biz-ink mt-1">{fmtNairaFromKobo(total)}</p>
              </Card>
            </div>

            <Card className="p-4">
              <p className="font-bold text-biz-ink">Tip</p>
              <p className="text-sm text-gray-700 mt-2">
                Escrow orders move from Pending to Available after the hold time if there’s no dispute.
              </p>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}