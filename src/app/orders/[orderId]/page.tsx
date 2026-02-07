// FILE: src/app/orders/[orderId]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { auth } from "@/lib/firebase/client";
import { onAuthStateChanged } from "firebase/auth";
import { ExternalLink, RefreshCw } from "lucide-react";

function fmtNaira(n: number) {
  try {
    return `₦${Number(n || 0).toLocaleString()}`;
  } catch {
    return `₦${n}`;
  }
}

function toMs(v: any) {
  try {
    if (!v) return 0;
    if (typeof v?.toDate === "function") return v.toDate().getTime();
    if (typeof v?.seconds === "number") return v.seconds * 1000;
    if (typeof v === "number") return v;
    return 0;
  } catch {
    return 0;
  }
}

function fmtDateAny(v: any) {
  const ms = toMs(v);
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return "—";
  }
}

function fmtDateMs(ms?: number) {
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ms);
  }
}

function labelOps(s: string) {
  const x = String(s || "").trim().toLowerCase();
  if (!x) return "";
  if (x === "new") return "New";
  if (x === "contacted") return "Contacted";
  if (x === "paid") return "Paid";
  if (x === "in_transit") return "In transit";
  if (x === "delivered") return "Delivered";
  if (x === "cancelled") return "Cancelled";
  return s || "";
}

function customerStatusLabel(o: any) {
  const orderStatus = String(o?.orderStatus || "").toLowerCase();
  const ops = String(o?.opsStatusEffective || o?.opsStatus || "").toLowerCase();
  const escrow = String(o?.escrowStatus || "").toLowerCase();

  // Prefer ops status if present
  if (ops) {
    const lbl = labelOps(ops);
    if (lbl) return lbl;
  }

  if (orderStatus.includes("delivered")) return "Delivered";
  if (orderStatus.includes("cancel")) return "Cancelled";
  if (orderStatus.includes("paid")) {
    // hide held/escrow wording
    if (escrow && escrow !== "released") return "Processing";
    return "Paid";
  }

  if (escrow) {
    if (escrow === "released") return "Paid";
    if (escrow === "disputed") return "Needs attention";
    return "Processing";
  }

  return "Processing";
}

function paymentMethodLabel(o: any) {
  const paymentType = String(o?.paymentType || "");
  if (paymentType === "direct_transfer") return "Bank transfer";
  // legacy name in data, but customer should see:
  if (paymentType === "paystack_escrow") return "Card payment";
  // fallback
  const provider = String(o?.payment?.provider || "");
  if (provider.toLowerCase() === "flutterwave") return "Card payment";
  if (provider.toLowerCase() === "paystack") return "Card payment";
  return "Payment";
}

function code4DigitsFromReference(ref: string) {
  let h = 0;
  for (let i = 0; i < ref.length; i++) h = (h * 31 + ref.charCodeAt(i)) | 0;
  const n = Math.abs(h) % 10000;
  return String(n).padStart(4, "0");
}

function isSettled(status: string) {
  const s = String(status || "").toLowerCase();
  return s === "paid" || s === "accepted";
}

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const sp = useSearchParams();

  const orderId = String((params as any)?.orderId ?? "");

  const [authLoading, setAuthLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  const [loading, setLoading] = useState(true);
  const [o, setO] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // installment UI state
  const [uploadingIdx, setUploadingIdx] = useState<string | null>(null);
  const [proofMsgMap, setProofMsgMap] = useState<Record<string, string>>({});
  const [fileMap, setFileMap] = useState<Record<string, File | null>>({});
  const [refMap, setRefMap] = useState<Record<string, string>>({});
  const [txIdMap, setTxIdMap] = useState<Record<string, string>>({});
  const [verifyingIdx, setVerifyingIdx] = useState<string | null>(null);
  const [payingIdx, setPayingIdx] = useState<string | null>(null);

  const items = useMemo(() => (Array.isArray(o?.items) ? o.items : []), [o]);
  const amount = Number(o?.amount || (o?.amountKobo ? o.amountKobo / 100 : 0) || 0);

  const paymentType = String(o?.paymentType || "");
  const isTransfer = paymentType === "direct_transfer";
  const isCard = paymentType === "paystack_escrow";

  const plan = o?.paymentPlan || null;
  const planEnabled = !!plan?.enabled;
  const installments: any[] = Array.isArray(plan?.installments) ? plan.installments : [];

  const planTotalKobo = Number(plan?.totalKobo || 0);
  const planPaidKobo = Number(plan?.paidKobo || 0);
  const planRemainingKobo = Math.max(0, planTotalKobo - planPaidKobo);

  const vendor = String(o?.businessSlug || "").trim() || "—";
  const statusLabel = customerStatusLabel(o);
  const payMethod = paymentMethodLabel(o);

  const paymentCode = useMemo(() => {
    const ref = String(o?.payment?.reference || "").trim();
    return ref ? code4DigitsFromReference(ref) : "";
  }, [o?.payment?.reference]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setAuthLoading(false);
      if (!u) {
        setLoggedIn(false);
        router.replace(`/account/login?next=${encodeURIComponent(`/orders/${orderId}`)}`);
        return;
      }
      setLoggedIn(true);
    });
    return () => unsub();
  }, [router, orderId]);

  async function authedFetchJson(path: string, init?: RequestInit) {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Not logged in");

    const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
    const isJsonBody = init?.body && !(init.body instanceof FormData);
    if (isJsonBody) headers["Content-Type"] = "application/json";

    const r = await fetch(path, { ...init, headers: { ...headers, ...(init?.headers as any) } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || data?.code || "Request failed");
    return data;
  }

  async function load() {
    let mounted = true;

    try {
      setLoading(true);
      setMsg(null);

      const data = await authedFetchJson(`/api/orders/${encodeURIComponent(orderId)}`);
      if (!mounted) return;
      setO(data.order || null);
    } catch (e: any) {
      setMsg(e?.message || "Failed to load order");
      setO(null);
    } finally {
      if (mounted) setLoading(false);
    }

    return () => {
      mounted = false;
    };
  }

  useEffect(() => {
    if (orderId && loggedIn) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, loggedIn]);

  // Auto-verify when redirected back from Flutterwave/Paystack for an installment
  useEffect(() => {
    if (!loggedIn || !orderId) return;

    const installmentIdxParam = sp.get("installmentIdx");
    const reference = sp.get("tx_ref") ?? sp.get("reference") ?? sp.get("trxref");
    const transactionId = sp.get("transaction_id") ?? sp.get("transactionId");

    const idxNum = installmentIdxParam != null ? Number(installmentIdxParam) : NaN;
    if (!Number.isFinite(idxNum) || idxNum < 0) return;
    if (!reference) return;

    let cancelled = false;

    (async () => {
      try {
        setMsg(null);
        setProofMsgMap((m) => ({ ...m, [String(idxNum)]: "Verifying payment..." }));

        await authedFetchJson(
          `/api/orders/${encodeURIComponent(orderId)}/installments/${encodeURIComponent(String(idxNum))}/paystack/verify?reference=${encodeURIComponent(
            String(reference)
          )}&transactionId=${encodeURIComponent(String(transactionId || ""))}`
        );

        if (cancelled) return;

        setProofMsgMap((m) => ({ ...m, [String(idxNum)]: "Payment verified." }));
        await load();

        router.replace(`/orders/${encodeURIComponent(orderId)}`);
      } catch (e: any) {
        if (cancelled) return;
        setProofMsgMap((m) => ({ ...m, [String(idxNum)]: e?.message || "Failed to verify payment" }));
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp, loggedIn, orderId]);

  const canDispute = o?.paymentType === "paystack_escrow" && o?.escrowStatus !== "released" && o?.escrowStatus !== "disputed";

  async function uploadInstallmentProof(idx: number) {
    if (!o) return;

    const key = String(idx);
    const f = fileMap[key] || null;
    if (!f) {
      setProofMsgMap((m) => ({ ...m, [key]: "Select a screenshot/PDF first." }));
      return;
    }

    const phone = String(o?.customer?.phone || "");
    const email = String(o?.customer?.email || "");

    setUploadingIdx(key);
    setProofMsgMap((m) => ({ ...m, [key]: "" }));
    setMsg(null);

    try {
      const fd = new FormData();
      fd.append("file", f);
      fd.append("customerPhone", phone);
      fd.append("customerEmail", email);

      const r = await fetch(
        `/api/public/orders/${encodeURIComponent(orderId)}/installments/${encodeURIComponent(String(idx))}/proof`,
        { method: "POST", body: fd }
      );

      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data?.error || data?.code || "Upload failed");

      setProofMsgMap((m) => ({ ...m, [key]: "Proof uploaded. Waiting for vendor confirmation." }));
      setFileMap((m) => ({ ...m, [key]: null }));
      await load();
    } catch (e: any) {
      setProofMsgMap((m) => ({ ...m, [key]: e?.message || "Failed to upload proof" }));
    } finally {
      setUploadingIdx(null);
    }
  }

  async function startInstallmentCardPayment(idx: number) {
    const key = String(idx);
    setPayingIdx(key);
    setProofMsgMap((m) => ({ ...m, [key]: "" }));
    setMsg(null);

    try {
      const data = await authedFetchJson(
        `/api/orders/${encodeURIComponent(orderId)}/installments/${encodeURIComponent(String(idx))}/paystack/init`,
        { method: "POST" }
      );

      const url = String(data?.authorization_url || "");
      if (!url) throw new Error("Failed to start payment");
      window.location.href = url;
    } catch (e: any) {
      setProofMsgMap((m) => ({ ...m, [key]: e?.message || "Failed to start payment" }));
    } finally {
      setPayingIdx(null);
    }
  }

  async function verifyInstallmentPayment(idx: number) {
    const key = String(idx);
    const reference = String(refMap[key] || "").trim();
    const transactionId = String(txIdMap[key] || "").trim();

    if (!reference) {
      setProofMsgMap((m) => ({ ...m, [key]: "Enter the payment reference." }));
      return;
    }

    setVerifyingIdx(key);
    setProofMsgMap((m) => ({ ...m, [key]: "" }));
    setMsg(null);

    try {
      await authedFetchJson(
        `/api/orders/${encodeURIComponent(orderId)}/installments/${encodeURIComponent(String(idx))}/paystack/verify?reference=${encodeURIComponent(
          reference
        )}&transactionId=${encodeURIComponent(transactionId)}`
      );

      setProofMsgMap((m) => ({ ...m, [key]: "Payment verified." }));
      await load();
    } catch (e: any) {
      setProofMsgMap((m) => ({ ...m, [key]: e?.message || "Failed to verify" }));
    } finally {
      setVerifyingIdx(null);
    }
  }

  if (authLoading || !loggedIn) {
    return (
      <div className="min-h-screen">
        <GradientHeader title="Order details" showBack={true} subtitle="Preparing..." />
        <div className="px-4 pb-24">
          <Card className="p-4">Loading...</Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="Order details" showBack={true} subtitle={orderId ? `#${orderId.slice(0, 8)}` : undefined} />

      <div className="px-4 pb-24 space-y-3">
        {loading ? <Card className="p-4">Loading...</Card> : null}
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}

        {!loading && o ? (
          <>
            <div className="rounded-[26px] p-4 text-white shadow-float bg-gradient-to-br from-biz-accent2 to-biz-accent">
              <p className="text-sm font-extrabold">Order summary</p>
              <p className="text-2xl font-extrabold mt-2">{fmtNaira(amount)}</p>

              <p className="text-xs opacity-95 mt-1">
                Status: <b>{statusLabel}</b>
              </p>

              <p className="text-[11px] opacity-90 mt-2">Created: {fmtDateAny(o.createdAt)}</p>

              <div className="mt-3">
                <Button variant="secondary" size="sm" onClick={() => load()} leftIcon={<RefreshCw className="h-4 w-4" />}>
                  Refresh
                </Button>
              </div>
            </div>

            {/* Installments (kept, but not showing technical stuff) */}
            {planEnabled ? (
              <SectionCard title="Installments" subtitle="Pay in parts">
                <Card className="p-3">
                  <p className="text-sm font-bold text-biz-ink">Plan summary</p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Paid: <b className="text-biz-ink">{fmtNaira(planPaidKobo / 100)}</b> • Remaining:{" "}
                    <b className="text-biz-ink">{fmtNaira(planRemainingKobo / 100)}</b>
                  </p>
                </Card>

                <div className="mt-2 space-y-2">
                  {installments.map((it: any, idx: number) => {
                    const status = String(it?.status || "pending");
                    const done = isSettled(status);
                    const proofUrl = it?.proofUrl ? String(it.proofUrl) : "";
                    const rejectReason = it?.rejectReason ? String(it.rejectReason) : "";
                    const key = String(idx);

                    return (
                      <Card key={idx} className="p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-biz-ink">
                              {it?.label || `Installment ${idx + 1}`} •{" "}
                              <span
                                className={
                                  status === "accepted" || status === "paid"
                                    ? "text-emerald-700"
                                    : status === "rejected"
                                      ? "text-rose-700"
                                      : status === "submitted"
                                        ? "text-orange-700"
                                        : "text-gray-700"
                                }
                              >
                                {status}
                              </span>
                            </p>

                            <p className="text-[11px] text-gray-500 mt-1">
                              Amount: <b className="text-biz-ink">{fmtNaira(Number(it?.amountKobo || 0) / 100)}</b>
                            </p>
                            <p className="text-[11px] text-gray-500 mt-1">
                              Due: <b className="text-biz-ink">{fmtDateMs(Number(it?.dueAtMs || 0))}</b>
                            </p>

                            {rejectReason ? (
                              <p className="text-[11px] text-rose-700 mt-2">
                                Reason: <b>{rejectReason}</b>
                              </p>
                            ) : null}
                          </div>

                          {proofUrl ? (
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => window.open(proofUrl, "_blank")}
                              leftIcon={<ExternalLink className="h-4 w-4" />}
                            >
                              View
                            </Button>
                          ) : null}
                        </div>

                        <div className="mt-3 space-y-2">
                          {isTransfer ? (
                            done ? (
                              <p className="text-[11px] text-biz-muted">Completed.</p>
                            ) : status === "submitted" ? (
                              <p className="text-[11px] text-biz-muted">Proof submitted. Waiting for confirmation.</p>
                            ) : (
                              <>
                                <input
                                  type="file"
                                  accept="image/*,application/pdf"
                                  className="w-full border border-biz-line rounded-2xl p-3 text-sm bg-white"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0] || null;
                                    setFileMap((m) => ({ ...m, [key]: f }));
                                  }}
                                />
                                <Button loading={uploadingIdx === key} disabled={uploadingIdx === key || !fileMap[key]} onClick={() => uploadInstallmentProof(idx)}>
                                  Upload proof
                                </Button>
                              </>
                            )
                          ) : null}

                          {isCard ? (
                            done ? (
                              <p className="text-[11px] text-biz-muted">Paid.</p>
                            ) : (
                              <>
                                <Button loading={payingIdx === key} disabled={payingIdx === key} onClick={() => startInstallmentCardPayment(idx)}>
                                  Pay installment
                                </Button>

                                {/* Keep manual verify for edge cases, but text simplified */}
                                <div className="grid grid-cols-1 gap-2">
                                  <input
                                    className="w-full border border-biz-line rounded-2xl p-3 text-sm outline-none bg-white"
                                    placeholder="Payment reference"
                                    value={String(refMap[key] || "")}
                                    onChange={(e) => setRefMap((m) => ({ ...m, [key]: e.target.value }))}
                                  />
                                  <input
                                    className="w-full border border-biz-line rounded-2xl p-3 text-sm outline-none bg-white"
                                    placeholder="Transaction ID (if shown)"
                                    value={String(txIdMap[key] || "")}
                                    onChange={(e) => setTxIdMap((m) => ({ ...m, [key]: e.target.value }))}
                                  />
                                </div>

                                <Button
                                  loading={verifyingIdx === key}
                                  disabled={verifyingIdx === key || !String(refMap[key] || "").trim()}
                                  onClick={() => verifyInstallmentPayment(idx)}
                                >
                                  Verify payment
                                </Button>
                              </>
                            )
                          ) : null}

                          {proofMsgMap[key] ? (
                            <p
                              className={
                                String(proofMsgMap[key]).toLowerCase().includes("uploaded") ||
                                String(proofMsgMap[key]).toLowerCase().includes("verified")
                                  ? "text-sm text-emerald-700"
                                  : "text-sm text-rose-700"
                              }
                            >
                              {proofMsgMap[key]}
                            </p>
                          ) : null}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </SectionCard>
            ) : null}

            <SectionCard title="Vendor" subtitle="Where you ordered from">
              <div className="text-sm text-gray-700 space-y-1">
                <div>
                  Vendor: <b className="text-biz-ink">{vendor}</b>
                </div>
                <div>
                  Payment: <b className="text-biz-ink">{payMethod}</b>
                </div>
                {paymentCode ? (
                  <div>
                    Payment code: <b className="text-biz-ink">{paymentCode}</b>
                  </div>
                ) : null}
              </div>

              {vendor !== "—" ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => router.push(`/b/${vendor}`)}>
                    Visit vendor
                  </Button>
                  <Button onClick={() => router.push("/market")}>Market</Button>
                </div>
              ) : null}
            </SectionCard>

            <SectionCard title="Items" subtitle={`${items.length} item(s)`}>
              <div className="space-y-2">
                {items.map((it: any, idx: number) => (
                  <div key={idx} className="rounded-2xl border border-biz-line bg-white p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-extrabold text-biz-ink truncate">{it?.name || "Item"}</p>

                        {it?.selectedOptions && Object.keys(it.selectedOptions).length ? (
                          <p className="text-[11px] text-gray-500 mt-1">
                            {Object.entries(it.selectedOptions)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(" • ")}
                          </p>
                        ) : null}

                        <p className="text-[11px] text-gray-500 mt-1">
                          Qty: <b className="text-biz-ink">{it?.qty ?? 1}</b>
                        </p>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="text-sm font-extrabold text-biz-ink">{fmtNaira(it?.price || 0)}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <SectionCard title="Customer" subtitle="Delivery information">
              <div className="text-sm text-gray-700 space-y-1">
                <div>
                  Name: <b className="text-biz-ink">{o?.customer?.fullName || "—"}</b>
                </div>
                <div>
                  Phone: <b className="text-biz-ink">{o?.customer?.phone || "—"}</b>
                </div>
                {o?.customer?.address ? (
                  <div>
                    Address: <b className="text-biz-ink">{o.customer.address}</b>
                  </div>
                ) : null}
              </div>
            </SectionCard>

            {canDispute ? (
              <Card className="p-4">
                <Button onClick={() => router.push(`/orders/${orderId}/dispute`)}>Raise an issue</Button>
                <p className="mt-2 text-[11px] text-biz-muted">Use this only if something is wrong with the order.</p>
              </Card>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}