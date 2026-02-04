"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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

function fmtDate(v: any) {
  try {
    if (!v) return "—";
    if (typeof v?.toDate === "function") return v.toDate().toLocaleString();
    return String(v);
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
  if (s === "new") return "New";
  if (s === "contacted") return "Contacted";
  if (s === "paid") return "Paid";
  if (s === "in_transit") return "In transit";
  if (s === "delivered") return "Delivered";
  if (s === "cancelled") return "Cancelled";
  return s || "—";
}

function isSettled(status: string) {
  const s = String(status || "");
  return s === "paid" || s === "accepted";
}

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
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
  const [verifyingIdx, setVerifyingIdx] = useState<string | null>(null);

  const items = useMemo(() => (Array.isArray(o?.items) ? o.items : []), [o]);
  const amount = Number(o?.amount || (o?.amountKobo ? o.amountKobo / 100 : 0) || 0);

  const paymentType = String(o?.paymentType || "");
  const isTransfer = paymentType === "direct_transfer";
  const isPaystack = paymentType === "paystack_escrow";

  const plan = o?.paymentPlan || null;
  const planEnabled = !!plan?.enabled;
  const installments: any[] = Array.isArray(plan?.installments) ? plan.installments : [];

  const planTotalKobo = Number(plan?.totalKobo || 0);
  const planPaidKobo = Number(plan?.paidKobo || 0);
  const planRemainingKobo = Math.max(0, planTotalKobo - planPaidKobo);

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

  const canDispute =
    o?.paymentType === "paystack_escrow" &&
    o?.escrowStatus !== "released" &&
    o?.escrowStatus !== "disputed";

  const ops = String(o?.opsStatusEffective || o?.opsStatus || "").trim();
  const progressLabel = ops ? labelOps(ops) : null;

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

  async function verifyPaystackInstallment(idx: number) {
    const key = String(idx);
    const reference = String(refMap[key] || "").trim();
    if (!reference) {
      setProofMsgMap((m) => ({ ...m, [key]: "Enter your Paystack reference." }));
      return;
    }

    setVerifyingIdx(key);
    setProofMsgMap((m) => ({ ...m, [key]: "" }));
    setMsg(null);

    try {
      await authedFetchJson(
        `/api/orders/${encodeURIComponent(orderId)}/installments/${encodeURIComponent(String(idx))}/paystack/verify?reference=${encodeURIComponent(reference)}`
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
        <GradientHeader title="Order details" showBack={true} subtitle="Preparing…" />
        <div className="px-4 pb-24">
          <Card className="p-4">Loading…</Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="Order details" showBack={true} subtitle={orderId ? `#${orderId.slice(0, 8)}` : undefined} />

      <div className="px-4 pb-24 space-y-3">
        {loading ? <Card className="p-4">Loading…</Card> : null}
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}

        {!loading && o ? (
          <>
            <div className="rounded-[26px] p-4 text-white shadow-float bg-gradient-to-br from-biz-accent2 to-biz-accent">
              <p className="text-sm font-extrabold">Order summary</p>
              <p className="text-2xl font-extrabold mt-2">{fmtNaira(amount)}</p>

              <p className="text-xs opacity-95 mt-1">
                Status: <b>{o.orderStatus || o.escrowStatus || "—"}</b>
              </p>

              {progressLabel ? (
                <p className="text-[11px] opacity-95 mt-2">
                  Progress: <b>{progressLabel}</b>
                </p>
              ) : null}

              <p className="text-[11px] opacity-90 mt-2">Created: {fmtDate(o.createdAt)}</p>

              <div className="mt-3">
                <Button variant="secondary" size="sm" onClick={() => load()} leftIcon={<RefreshCw className="h-4 w-4" />}>
                  Refresh
                </Button>
              </div>
            </div>

            {/* Installments */}
            {planEnabled ? (
              <SectionCard title="Installments" subtitle="Pay in parts">
                <Card className="p-3">
                  <p className="text-sm font-bold text-biz-ink">Plan summary</p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Paid: <b className="text-biz-ink">{fmtNaira(planPaidKobo / 100)}</b> • Remaining:{" "}
                    <b className="text-biz-ink">{fmtNaira(planRemainingKobo / 100)}</b>
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Completed: <b className="text-biz-ink">{plan?.completed ? "Yes" : "No"}</b>
                    {plan?.completedAtMs ? <> • {fmtDateMs(Number(plan.completedAtMs))}</> : null}
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

                        {/* Actions */}
                        <div className="mt-3 space-y-2">
                          {/* Bank transfer installment proof */}
                          {isTransfer ? (
                            done ? (
                              <p className="text-[11px] text-biz-muted">This installment is completed.</p>
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
                                <Button
                                  loading={uploadingIdx === key}
                                  disabled={uploadingIdx === key || !fileMap[key]}
                                  onClick={() => uploadInstallmentProof(idx)}
                                >
                                  Upload proof for this installment
                                </Button>
                              </>
                            )
                          ) : null}

                          {/* Paystack installment verify */}
                          {isPaystack ? (
                            done ? (
                              <p className="text-[11px] text-biz-muted">This installment is paid.</p>
                            ) : (
                              <>
                                <input
                                  className="w-full border border-biz-line rounded-2xl p-3 text-sm outline-none bg-white"
                                  placeholder="Paystack reference (e.g. abc123...)"
                                  value={String(refMap[key] || "")}
                                  onChange={(e) => setRefMap((m) => ({ ...m, [key]: e.target.value }))}
                                />
                                <Button
                                  loading={verifyingIdx === key}
                                  disabled={verifyingIdx === key || !String(refMap[key] || "").trim()}
                                  onClick={() => verifyPaystackInstallment(idx)}
                                >
                                  Verify payment
                                </Button>
                                <p className="text-[11px] text-biz-muted">
                                  If you just paid, paste the Paystack reference here to confirm.
                                </p>
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

            <SectionCard title="Store" subtitle="Order source">
              <div className="text-sm text-gray-700 space-y-1">
                <div>
                  Slug: <b className="text-biz-ink">{o.businessSlug || "—"}</b>
                </div>
                <div>
                  Payment: <b className="text-biz-ink">{o.paymentType || "—"}</b>
                </div>
                {o?.payment?.reference ? (
                  <div className="text-[11px] text-gray-500 break-all">
                    Reference: <b className="text-biz-ink">{o.payment.reference}</b>
                  </div>
                ) : null}
              </div>

              {o.businessSlug ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => router.push(`/b/${o.businessSlug}`)}>
                    Visit store
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
                <Button onClick={() => router.push(`/orders/${orderId}/dispute`)}>Raise a dispute</Button>
                <p className="mt-2 text-[11px] text-biz-muted">
                  Only use disputes for real issues (wrong item, not delivered, etc).
                </p>
              </Card>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}