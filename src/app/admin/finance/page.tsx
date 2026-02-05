// FILE: src/app/admin/finance/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { Input } from "@/components/ui/Input";
import { auth } from "@/lib/firebase/client";
import { RefreshCw, ShieldCheck, KeyRound, Send } from "lucide-react";

function fmtNairaFromKobo(kobo: number) {
  const n = Number(kobo || 0) / 100;
  try {
    return `₦${n.toLocaleString()}`;
  } catch {
    return `₦${n}`;
  }
}

function toMs(v: any) {
  try {
    if (!v) return 0;
    if (typeof v?.toDate === "function") return v.toDate().getTime();
    if (typeof v?.seconds === "number") return v.seconds * 1000;
    return 0;
  } catch {
    return 0;
  }
}

function fmtDateTime(v: any) {
  const ms = toMs(v);
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ms);
  }
}

function Pill({ type }: { type: string }) {
  const t = String(type || "").toLowerCase();
  const cls =
    t.includes("subscription")
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : t.includes("boost") || t.includes("promo")
        ? "bg-orange-50 text-orange-700 border-orange-100"
        : t.includes("withdraw")
          ? "bg-red-50 text-red-700 border-red-100"
          : "bg-white text-gray-700 border-biz-line";

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold border ${cls}`}>
      {type || "ledger"}
    </span>
  );
}

export default function AdminFinancePage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [finance, setFinance] = useState<any>(null);
  const [ledger, setLedger] = useState<any[]>([]);

  // Platform payout details (myBizHub bank)
  const [pdLoading, setPdLoading] = useState(false);
  const [payoutDetails, setPayoutDetails] = useState<any>(null);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  // Withdraw security / pin
  const [pinSet, setPinSet] = useState<boolean>(false);
  const [pin, setPin] = useState<string>("");

  // Withdraw flow
  const [otp, setOtp] = useState<string>("");
  const [otpSentMsg, setOtpSentMsg] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const [withdrawAmountNgn, setWithdrawAmountNgn] = useState<number>(1000);
  const [withdrawNote, setWithdrawNote] = useState<string>("");

  const [withdrawing, setWithdrawing] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);

  const [platformWithdrawals, setPlatformWithdrawals] = useState<any[]>([]);

  async function api(path: string, init?: RequestInit) {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(path, {
      ...init,
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || data?.code || "Request failed");
    return data;
  }

  async function loadFinance() {
    setLoading(true);
    setMsg(null);
    try {
      const data = await api("/api/admin/finance");
      setFinance(data.finance || null);
      setLedger(Array.isArray(data.ledger) ? data.ledger : []);
    } catch (e: any) {
      setMsg(e?.message || "Failed to load finance");
      setFinance(null);
      setLedger([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadPlatformWithdrawals() {
    try {
      const data = await api("/api/admin/platform/withdraw");
      setPlatformWithdrawals(Array.isArray(data.withdrawals) ? data.withdrawals : []);
    } catch {
      setPlatformWithdrawals([]);
    }
  }

  async function loadPayoutDetails() {
    setPdLoading(true);
    try {
      const data = await api("/api/admin/platform/payout-details");
      setPayoutDetails(data.payoutDetails || null);

      const p = data.payoutDetails || {};
      setBankName(String(p.bankName || ""));
      setAccountNumber(String(p.accountNumber || ""));
      setAccountName(String(p.accountName || ""));
    } catch (e: any) {
      setMsg(e?.message || "Failed to load payout details");
      setPayoutDetails(null);
    } finally {
      setPdLoading(false);
    }
  }

  async function loadPinState() {
    try {
      const data = await api("/api/admin/platform/pin");
      setPinSet(!!data.pinSet);
    } catch {
      setPinSet(false);
    }
  }

  async function loadAll() {
    await Promise.all([loadFinance(), loadPayoutDetails(), loadPinState(), loadPlatformWithdrawals()]);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const balanceKobo = useMemo(() => Number(finance?.balanceKobo || 0), [finance]);
  const subKobo = useMemo(() => Number(finance?.subscriptionRevenueKobo || 0), [finance]);
  const boostKobo = useMemo(() => Number(finance?.boostRevenueKobo || 0), [finance]);

  async function savePayoutDetails() {
    setPdLoading(true);
    setMsg(null);
    try {
      await api("/api/admin/platform/payout-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankName, accountNumber, accountName }),
      });
      setMsg("Platform payout details saved.");
      await loadPayoutDetails();
    } catch (e: any) {
      setMsg(e?.message || "Failed to save payout details");
    } finally {
      setPdLoading(false);
    }
  }

  async function createPin() {
    setMsg(null);
    try {
      await api("/api/admin/platform/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      setMsg("Withdrawal PIN created.");
      setPin("");
      await loadPinState();
    } catch (e: any) {
      setMsg(e?.message || "Failed to create PIN");
    }
  }

  async function sendWithdrawalOtp() {
    setSendingOtp(true);
    setOtpSentMsg(null);
    setDevOtp(null);
    try {
      const data = await api("/api/admin/platform/withdraw/send-code", { method: "POST" });
      setOtpSentMsg("Withdrawal code sent to your email.");
      if (data?.devCode) setDevOtp(String(data.devCode));
    } catch (e: any) {
      setOtpSentMsg(e?.message || "Failed to send code");
    } finally {
      setSendingOtp(false);
    }
  }

  async function withdrawNow() {
    setWithdrawing(true);
    setMsg(null);
    try {
      const amountKobo = Math.floor(Math.max(0, Number(withdrawAmountNgn || 0)) * 100);

      await api("/api/admin/platform/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountKobo,
          otp,
          pin,
          note: withdrawNote,
        }),
      });

      setMsg("Platform withdrawal recorded. (Manual payout)");
      setOtp("");
      setWithdrawNote("");
      setPin("");

      await loadAll();
    } catch (e: any) {
      setMsg(e?.message || "Withdrawal failed");
    } finally {
      setWithdrawing(false);
    }
  }

  const hasPayoutDetails = !!(bankName.trim() && accountNumber.trim() && accountName.trim());
  const canWithdraw =
    hasPayoutDetails &&
    pinSet &&
    pin.length === 14 &&
    otp.trim().length >= 4 &&
    Number(withdrawAmountNgn || 0) > 0;

  return (
    <div className="min-h-screen">
      <GradientHeader
        title="myBizHub Balance"
        subtitle="Platform finance overview"
        showBack={true}
        right={
          <Button variant="secondary" size="sm" onClick={loadAll} leftIcon={<RefreshCw className="h-4 w-4" />} disabled={loading}>
            Refresh
          </Button>
        }
      />

      <div className="px-4 pb-24 space-y-3">
        {loading ? <Card className="p-4">Loading…</Card> : null}
        {msg ? <Card className={String(msg).toLowerCase().includes("failed") ? "p-4 text-red-700" : "p-4"}>{msg}</Card> : null}

        {!loading && finance ? (
          <>
            {/* Big hero */}
            <div className="rounded-[26px] p-4 text-white shadow-float bg-gradient-to-br from-biz-accent2 to-biz-accent">
              <p className="text-xs opacity-95">Total platform balance</p>
              <p className="text-3xl font-bold mt-2">{fmtNairaFromKobo(balanceKobo)}</p>
              <p className="text-[11px] opacity-90 mt-2">
                Updated: <b>{fmtDateTime(finance?.updatedAt)}</b>
              </p>
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4">
                <p className="text-xs text-biz-muted">Subscription revenue</p>
                <p className="text-lg font-bold text-biz-ink mt-1">{fmtNairaFromKobo(subKobo)}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-biz-muted">Boost / Promo revenue</p>
                <p className="text-lg font-bold text-biz-ink mt-1">{fmtNairaFromKobo(boostKobo)}</p>
              </Card>
            </div>

            {/* Platform payout details */}
            <SectionCard
              title="Platform payout details"
              subtitle="Where you withdraw platform funds to"
              right={
                <span className="inline-flex items-center gap-2 text-[11px] text-gray-500">
                  <ShieldCheck className="h-4 w-4" /> Admin only
                </span>
              }
            >
              <div className="space-y-2">
                <Input placeholder="Bank name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
                <Input placeholder="Account number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
                <Input placeholder="Account name" value={accountName} onChange={(e) => setAccountName(e.target.value)} />

                <Button onClick={savePayoutDetails} loading={pdLoading} disabled={pdLoading}>
                  Save payout details
                </Button>

                {payoutDetails?.updatedAtMs ? (
                  <p className="text-[11px] text-biz-muted">Last updated: {new Date(Number(payoutDetails.updatedAtMs)).toLocaleString()}</p>
                ) : null}
              </div>
            </SectionCard>

            {/* PIN setup */}
            {!pinSet ? (
              <SectionCard title="Create withdrawal PIN" subtitle="Required before any platform withdrawal">
                <div className="space-y-2">
                  <Input
                    placeholder="Create 14-character PIN (any characters)"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    maxLength={14}
                  />
                  <Button
                    onClick={createPin}
                    leftIcon={<KeyRound className="h-4 w-4" />}
                    disabled={pin.length !== 14}
                  >
                    Create PIN
                  </Button>
                  <p className="text-[11px] text-biz-muted">
                    This PIN can only be set once (strict mode).
                  </p>
                </div>
              </SectionCard>
            ) : null}

            {/* Platform withdrawal */}
            <SectionCard title="Withdraw platform funds" subtitle="Manual payout + strict verification">
              <div className="space-y-2">
                <Input
                  type="number"
                  min={1}
                  step={100}
                  placeholder="Amount (NGN)"
                  value={String(withdrawAmountNgn)}
                  onChange={(e) => setWithdrawAmountNgn(Number(e.target.value))}
                />

                <Input
                  placeholder="Note (optional)"
                  value={withdrawNote}
                  onChange={(e) => setWithdrawNote(e.target.value)}
                />

                <div className="rounded-2xl border border-biz-line bg-white p-3">
                  <p className="text-xs text-biz-muted">Step 1: Send withdrawal code</p>
                  <div className="mt-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={sendWithdrawalOtp}
                      loading={sendingOtp}
                      leftIcon={<Send className="h-4 w-4" />}
                    >
                      Send code to email
                    </Button>
                  </div>
                  {otpSentMsg ? <p className="text-[11px] text-gray-600 mt-2">{otpSentMsg}</p> : null}
                  {devOtp ? (
                    <p className="text-[11px] text-gray-500 mt-1">
                      DEV ONLY code: <b className="text-biz-ink">{devOtp}</b>
                    </p>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Enter email code" value={otp} onChange={(e) => setOtp(e.target.value)} />
                  <Input
                    placeholder="Enter 14-char PIN"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    maxLength={14}
                  />
                </div>

                <Button onClick={withdrawNow} loading={withdrawing} disabled={!canWithdraw || withdrawing}>
                  Record withdrawal
                </Button>

                {!pinSet ? (
                  <p className="text-[11px] text-orange-700">
                    Create your withdrawal PIN first.
                  </p>
                ) : null}

                {!hasPayoutDetails ? (
                  <p className="text-[11px] text-orange-700">
                    Save platform payout details first.
                  </p>
                ) : null}
              </div>
            </SectionCard>

            {/* Platform withdrawals history */}
            <SectionCard title="Platform withdrawals" subtitle="History (manual payouts)">
              {platformWithdrawals.length === 0 ? (
                <div className="text-sm text-biz-muted">No platform withdrawals yet.</div>
              ) : (
                <div className="space-y-2">
                  {platformWithdrawals.slice(0, 30).map((w) => (
                    <div key={w.id} className="rounded-2xl border border-biz-line bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-biz-ink">{w.status || "recorded"}</p>
                          <p className="text-[11px] text-gray-500 mt-1">
                            {w.createdAtMs ? new Date(Number(w.createdAtMs)).toLocaleString() : "—"}
                          </p>
                          {w.note ? <p className="text-[11px] text-gray-600 mt-1">{String(w.note)}</p> : null}
                          <p className="text-[11px] text-gray-500 mt-1 break-all">
                            By: <b className="text-biz-ink">{String(w.createdByEmail || w.createdByUid || "—")}</b>
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-biz-ink">{fmtNairaFromKobo(Number(w.amountKobo || 0))}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3">
                <Button variant="secondary" onClick={loadPlatformWithdrawals}>
                  Refresh withdrawals
                </Button>
              </div>
            </SectionCard>

            {/* Ledger */}
            <SectionCard title="Ledger" subtitle="Latest platform inflows/outflows (MVP)">
              {ledger.length === 0 ? (
                <div className="text-sm text-biz-muted">No ledger entries yet.</div>
              ) : (
                <div className="space-y-2">
                  {ledger.slice(0, 50).map((row) => {
                    const amountKobo = Number(row.amountKobo || 0);
                    const type = String(row.type || row.purpose || "ledger");
                    const ref = String(row.reference || row.id || "");
                    const businessId = String(row.businessId || "");
                    const when = fmtDateTime(row.createdAt);

                    return (
                      <div key={row.id} className="rounded-2xl border border-biz-line bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Pill type={type} />
                              <span className="text-[11px] text-gray-500">{when}</span>
                            </div>

                            {businessId ? (
                              <p className="text-[11px] text-gray-500 mt-2 break-all">
                                Business: <b className="text-biz-ink">{businessId}</b>
                              </p>
                            ) : null}

                            {ref ? (
                              <p className="text-[11px] text-gray-500 mt-1 break-all">
                                Ref: <b className="text-biz-ink">{ref}</b>
                              </p>
                            ) : null}

                            {row.withdrawalId ? (
                              <p className="text-[11px] text-gray-500 mt-1 break-all">
                                WithdrawalId: <b className="text-biz-ink">{String(row.withdrawalId)}</b>
                              </p>
                            ) : null}
                          </div>

                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-biz-ink">{fmtNairaFromKobo(amountKobo)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <p className="mt-3 text-[11px] text-biz-muted">
                Note: Vendor payouts are handled in Admin → Withdrawals. Platform withdrawals are logged above.
              </p>
            </SectionCard>
          </>
        ) : null}
      </div>
    </div>
  );
}