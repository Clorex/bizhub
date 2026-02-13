"use client";

import { useEffect, useMemo, useState } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SectionCard } from "@/components/ui/SectionCard";
import { auth } from "@/lib/firebase/client";
import { formatMoneyNGN, formatMoneyNGNFromKobo } from "@/lib/money";

function fmtDate(ms?: number) {
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ms);
  }
}

export default function VendorWithdrawalsPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [wallet, setWallet] = useState<any>(null);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);

  const [amountNgn, setAmountNgn] = useState<number>(1000);
  const [sending, setSending] = useState(false);

  async function api(path: string, init?: RequestInit) {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(path, {
      ...init,
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error || "Request failed");
    return j;
  }

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const j = await api("/api/vendor/withdrawals");
      setWallet(j.wallet || null);
      setWithdrawals(Array.isArray(j.withdrawals) ? j.withdrawals : []);
    } catch (e: any) {
      setMsg(e?.message || "Failed to load");
      setWallet(null);
      setWithdrawals([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const availableKobo = useMemo(() => Number(wallet?.availableBalanceKobo || 0), [wallet]);
  const holdKobo = useMemo(() => Number(wallet?.withdrawHoldKobo || 0), [wallet]);

  async function requestWithdrawal() {
    setSending(true);
    setMsg(null);
    try {
      const amountKobo = Math.floor(Number(amountNgn || 0) * 100);
      await api("/api/vendor/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountKobo }),
      });

      setMsg("Withdrawal request submitted.");
      await load();
    } catch (e: any) {
      setMsg(e?.message || "Failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="Withdrawals" subtitle="Request payout from myBizHub Balance" showBack={true} />

      <div className="px-4 pb-24 space-y-3">
        {loading ? <Card className="p-4">Loading…</Card> : null}
        {msg ? <Card className="p-4">{msg}</Card> : null}

        {!loading ? (
          <>
            <div className="rounded-[26px] p-4 text-white shadow-float bg-gradient-to-br from-biz-accent2 to-biz-accent">
              <p className="text-xs opacity-95">Available</p>
              <p className="text-2xl font-bold mt-2">{formatMoneyNGNFromKobo(availableKobo)}</p>
              <p className="text-[11px] opacity-95 mt-2">
                On hold: <b>{formatMoneyNGNFromKobo(holdKobo)}</b>
              </p>
            </div>

            <SectionCard title="Request withdrawal" subtitle={`Minimum ${formatMoneyNGN(1000)}`}>
              <div className="space-y-2">
                <Input
                  type="number"
                  min={1000}
                  step={500}
                  value={String(amountNgn)}
                  onChange={(e) => setAmountNgn(Number(e.target.value))}
                  placeholder="1000"
                />

                <Button onClick={requestWithdrawal} loading={sending} disabled={sending}>
                  Request payout
                </Button>

                <p className="text-[11px] text-biz-muted">
                  Your requested amount will move to “hold” until admin processes it.
                </p>
              </div>
            </SectionCard>

            <SectionCard title="History" subtitle="Your recent withdrawal requests">
              {withdrawals.length === 0 ? (
                <div className="text-sm text-biz-muted">No withdrawal requests yet.</div>
              ) : (
                <div className="space-y-2">
                  {withdrawals.map((w) => (
                    <div key={w.id} className="rounded-2xl border border-biz-line bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-biz-ink">{w.status || "pending"}</p>
                          <p className="text-[11px] text-gray-500 mt-1">
                            {fmtDate(Number(w.createdAtMs || 0))}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-1 break-all">
                            Bank: {w?.payoutDetails?.bankName || "—"} • {w?.payoutDetails?.accountNumber || "—"}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-biz-ink">
                            {formatMoneyNGNFromKobo(Number(w.amountKobo || 0))}
                          </p>
                        </div>
                      </div>
                      {w.adminNote ? (
                        <p className="text-[11px] text-gray-600 mt-2">Note: {String(w.adminNote)}</p>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3">
                <Button variant="secondary" onClick={load}>
                  Refresh
                </Button>
              </div>
            </SectionCard>
          </>
        ) : null}
      </div>
    </div>
  );
}