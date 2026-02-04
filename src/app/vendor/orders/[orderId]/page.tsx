"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { auth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import {
  MessageCircle,
  AlertTriangle,
  ExternalLink,
  Plus,
  Trash2,
  Send,
  Clock,
} from "lucide-react";

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

function digitsOnlyPhone(v: string) {
  return String(v || "").replace(/[^\d]/g, "");
}

function waLink(wa: string, text: string) {
  const digits = digitsOnlyPhone(wa);
  const t = encodeURIComponent(text);
  return `https://wa.me/${digits}?text=${t}`;
}

function toLocalDateTimeInput(ms?: number) {
  if (!ms) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  const yyyy = d.getFullYear();
  const mm = pad(d.getMonth() + 1);
  const dd = pad(d.getDate());
  const hh = pad(d.getHours());
  const mi = pad(d.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

function fromLocalDateTimeInput(v: string) {
  if (!v) return 0;
  const ms = new Date(v).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function parseNairaToKobo(v: string) {
  const s = String(v || "").replace(/[^\d.]/g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100);
}

function koboToNairaString(kobo: number) {
  const n = Number(kobo || 0) / 100;
  return Number.isFinite(n) ? String(n) : "0";
}

function isSettled(status: string) {
  const s = String(status || "");
  return s === "paid" || s === "accepted";
}

function fmtCountdown(msLeft: number) {
  const ms = Math.max(0, Math.floor(msLeft || 0));
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

type Ops = "new" | "contacted" | "paid" | "in_transit" | "delivered" | "cancelled";

const OPS_OPTIONS: { value: Ops; label: string }[] = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "paid", label: "Paid" },
  { value: "in_transit", label: "In transit" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

export default function VendorOrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = String((params as any)?.orderId ?? "");

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [meta, setMeta] = useState<any>(null);
  const [o, setO] = useState<any>(null);

  const [notes, setNotes] = useState<any[]>([]);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const [savingStatus, setSavingStatus] = useState(false);

  // Single transfer proof review (whole order)
  const [reviewing, setReviewing] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Installment plan
  const [planDraft, setPlanDraft] = useState<any[]>([]);
  const [savingPlan, setSavingPlan] = useState(false);
  const [planMsg, setPlanMsg] = useState<string | null>(null);

  // Installment review (bank transfer installments)
  const [reviewingInstallment, setReviewingInstallment] = useState<string | null>(null);
  const [rejectReasonMap, setRejectReasonMap] = useState<Record<string, string>>({});

  // Follow-ups
  const [followUpText, setFollowUpText] = useState("");
  const [sendingFollowUp, setSendingFollowUp] = useState(false);
  const [tick, setTick] = useState(0);

  const [followUpLimitInfo, setFollowUpLimitInfo] = useState<any>(null);

  const items = useMemo(() => (Array.isArray(o?.items) ? o.items : []), [o]);
  const amount = Number(o?.amount || (o?.amountKobo ? o.amountKobo / 100 : 0) || 0);
  const totalKobo = Number(o?.amountKobo || Math.round(amount * 100) || 0);

  const canUpdateStatus = !!meta?.limits?.canUpdateStatus;
  const canUseNotes = !!meta?.limits?.canUseNotes;

  const transferProofUnlocked = !!meta?.limits?.transferProofUnlocked;

  // ✅ now unlocks on Launch/Momentum via add-on, core on Apex
  const installmentPlansUnlocked = !!meta?.limits?.installmentPlansUnlocked;

  const vendorPlanKey = String(meta?.planKey || "FREE").toUpperCase();
  const showInstallmentBuyAddon = !installmentPlansUnlocked && (vendorPlanKey === "LAUNCH" || vendorPlanKey === "MOMENTUM");
  const installmentAddonTitle =
    vendorPlanKey === "LAUNCH"
      ? "Buy Installment plans (basic)"
      : vendorPlanKey === "MOMENTUM"
      ? "Buy Installment plans (advanced)"
      : "Upgrade";
  const installmentRulesHint =
    vendorPlanKey === "LAUNCH"
      ? "Launch basic: max 2 installments • max 30 days."
      : vendorPlanKey === "MOMENTUM"
      ? "Momentum advanced: max 4 installments • max 90 days."
      : vendorPlanKey === "APEX"
      ? "Apex: higher caps."
      : "Upgrade to unlock installment plans.";

  const followUpsUnlocked = !!meta?.limits?.followUpsUnlocked;
  const followUpsCap = Number(meta?.limits?.followUpsCap72h || 0);
  const followUpsUsed = Number(meta?.limits?.followUpsUsed72h || 0);
  const followUpsResetAtMs = Number(meta?.limits?.followUpsResetAtMs || 0);

  const followUpsBoostSuggestionFromMeta = meta?.limits?.followUpsBoostSuggestion || null;
  const followUpsSuggestion = followUpLimitInfo?.suggestion || followUpsBoostSuggestionFromMeta || null;

  const paymentType = String(o?.paymentType || "");
  const isTransfer = paymentType === "direct_transfer";
  const isPaystack = paymentType === "paystack_escrow";

  const plan = o?.paymentPlan || null;
  const planEnabled = !!plan?.enabled;
  const planInstallments: any[] = Array.isArray(plan?.installments) ? plan.installments : [];

  const tp = o?.transferProof || null;
  const tpStatus = String(tp?.status || "");
  const tpViewUrl = String(tp?.viewUrl || "");
  const disputed =
    String(o?.orderStatus || "").toLowerCase() === "disputed" ||
    String(o?.escrowStatus || "").toLowerCase() === "disputed";

  const planDraftSumKobo = useMemo(() => {
    return (planDraft || []).reduce((s, x) => s + Math.max(0, Number(x?.amountKobo || 0)), 0);
  }, [planDraft]);

  const planDraftValid = useMemo(() => {
    const list = Array.isArray(planDraft) ? planDraft : [];
    if (list.length < 2) return false;
    if (planDraftSumKobo !== totalKobo) return false;
    const hasAllDue = list.every((x) => Number(x?.dueAtMs || 0) > 0);
    if (!hasAllDue) return false;
    return true;
  }, [planDraft, planDraftSumKobo, totalKobo]);

  const planPaidKobo = Number(plan?.paidKobo || 0);
  const planRemainingKobo = Math.max(0, Number(plan?.totalKobo || 0) - planPaidKobo);

  const shouldHideSingleTransferProof = isTransfer && planEnabled;

  const followUpsRemaining = Math.max(0, followUpsCap - followUpsUsed);
  const followUpsLimitReached = followUpsCap > 0 && followUpsUsed >= followUpsCap;
  const countdownMs = followUpsResetAtMs ? Math.max(0, followUpsResetAtMs - Date.now()) : 0;

  useEffect(() => {
    if (!followUpsResetAtMs) return;
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [followUpsResetAtMs]);

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

  async function load() {
    setLoading(true);
    setMsg(null);
    setPlanMsg(null);
    setFollowUpLimitInfo(null);

    try {
      const data = await authedFetch(`/api/vendor/orders/${encodeURIComponent(orderId)}`);
      setMeta(data?.meta || null);
      setO(data?.order || null);

      if (data?.meta?.limits?.canUseNotes) {
        const n = await authedFetch(`/api/vendor/orders/${encodeURIComponent(orderId)}/notes`);
        setNotes(Array.isArray(n.notes) ? n.notes : []);
      } else {
        setNotes([]);
      }

      const order = data?.order || null;
      const p = order?.paymentPlan || null;
      const enabled = !!p?.enabled;
      if (!enabled) {
        setPlanDraft([
          { label: "Installment 1", amountKobo: 0, dueAtMs: 0 },
          { label: "Installment 2", amountKobo: 0, dueAtMs: 0 },
        ]);
      } else {
        setPlanDraft([]);
      }

      const custName = String(order?.customer?.fullName || "").trim();
      if (!followUpText) {
        const shortId = String(orderId).slice(0, 8);
        setFollowUpText(
          `Hello${custName ? ` ${custName}` : ""}, this is regarding your BizHub order #${shortId}. Just checking in—any update for me?`
        );
      }
    } catch (e: any) {
      setMsg(e?.message || "Failed to load order");
      setMeta(null);
      setO(null);
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (orderId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const opsValue: Ops = useMemo(() => {
    const v = String(o?.opsStatus || o?.opsStatusEffective || "").trim();
    const ok = (OPS_OPTIONS.map((x) => x.value) as string[]).includes(v);
    return (ok ? v : "new") as Ops;
  }, [o]);

  async function setOpsStatus(next: Ops) {
    if (!canUpdateStatus) return;
    setSavingStatus(true);
    setMsg(null);
    try {
      await authedFetch(`/api/vendor/orders/${encodeURIComponent(orderId)}/ops-status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opsStatus: next }),
      });
      await load();
    } catch (e: any) {
      setMsg(e?.message || "Failed to update status");
    } finally {
      setSavingStatus(false);
    }
  }

  async function addNote() {
    if (!canUseNotes) return;
    if (noteText.trim().length < 2) return;

    setSavingNote(true);
    setMsg(null);
    try {
      await authedFetch(`/api/vendor/orders/${encodeURIComponent(orderId)}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: noteText }),
      });
      setNoteText("");
      await load();
    } catch (e: any) {
      setMsg(e?.message || "Failed to add note");
    } finally {
      setSavingNote(false);
    }
  }

  async function reviewProof(action: "accept" | "reject") {
    if (!transferProofUnlocked) return;
    if (!isTransfer) return;

    setReviewing(true);
    setMsg(null);
    try {
      await authedFetch(`/api/vendor/orders/${encodeURIComponent(orderId)}/transfer-proof/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          rejectReason: action === "reject" ? rejectReason : "",
        }),
      });
      setRejectReason("");
      await load();
      setMsg(action === "accept" ? "Proof accepted." : "Proof rejected.");
    } catch (e: any) {
      setMsg(e?.message || "Failed to review proof");
    } finally {
      setReviewing(false);
    }
  }

  async function savePlan() {
    if (!installmentPlansUnlocked) return;

    setSavingPlan(true);
    setPlanMsg(null);

    try {
      const payload = {
        installments: (planDraft || []).map((x: any, idx: number) => ({
          label: String(x?.label || `Installment ${idx + 1}`),
          amountKobo: Math.floor(Number(x?.amountKobo || 0)),
          dueAtMs: Math.floor(Number(x?.dueAtMs || 0)),
        })),
      };

      await authedFetch(`/api/vendor/orders/${encodeURIComponent(orderId)}/payment-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setPlanMsg("Installment plan saved.");
      await load();
    } catch (e: any) {
      setPlanMsg(e?.message || "Failed to save plan");
    } finally {
      setSavingPlan(false);
    }
  }

  async function clearPlan() {
    if (!installmentPlansUnlocked) return;

    const ok = confirm("Clear this installment plan? Use only if no payment has been made yet.");
    if (!ok) return;

    setSavingPlan(true);
    setPlanMsg(null);

    try {
      await authedFetch(`/api/vendor/orders/${encodeURIComponent(orderId)}/payment-plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear" }),
      });

      setPlanMsg("Plan cleared.");
      await load();
    } catch (e: any) {
      setPlanMsg(e?.message || "Failed to clear plan");
    } finally {
      setSavingPlan(false);
    }
  }

  async function reviewInstallment(idx: number, action: "accept" | "reject") {
    setReviewingInstallment(String(idx));
    setMsg(null);

    try {
      await authedFetch(`/api/vendor/orders/${encodeURIComponent(orderId)}/installments/${idx}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          rejectReason: action === "reject" ? String(rejectReasonMap[String(idx)] || "") : "",
        }),
      });

      setRejectReasonMap((m) => ({ ...m, [String(idx)]: "" }));
      await load();
      setMsg(action === "accept" ? `Installment ${idx + 1} accepted.` : `Installment ${idx + 1} rejected.`);
    } catch (e: any) {
      setMsg(e?.message || "Failed to review installment");
    } finally {
      setReviewingInstallment(null);
    }
  }

  function renderFollowUpsSuggestion() {
    if (!followUpsSuggestion) return null;

    const action = String(followUpsSuggestion?.action || "");
    const title = String(followUpsSuggestion?.title || "");
    const url = String(followUpsSuggestion?.url || "");

    if (!action || !url) return null;

    return (
      <Card variant="soft" className="p-3">
        <p className="text-sm font-bold text-biz-ink">Need more follow-ups?</p>
        <p className="text-[11px] text-biz-muted mt-1">{title || "Increase your follow-up capacity."}</p>
        <div className="mt-2">
          <Button size="sm" onClick={() => router.push(url)}>
            {action === "buy_addon" ? "Buy boost" : "Upgrade"}
          </Button>
        </div>
      </Card>
    );
  }

  async function sendFollowUp() {
    if (!followUpsUnlocked) return;

    const phone = String(o?.customer?.phone || "").trim();
    if (!phone) {
      setMsg("No customer phone on this order.");
      return;
    }

    setSendingFollowUp(true);
    setMsg(null);
    setFollowUpLimitInfo(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      const r = await fetch(`/api/vendor/orders/${encodeURIComponent(orderId)}/followups`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ text: followUpText }),
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok) {
        if (String(data?.code || "") === "FOLLOWUP_LIMIT") {
          setFollowUpLimitInfo(data || { code: "FOLLOWUP_LIMIT" });
        }
        throw new Error(data?.error || data?.code || "Request failed");
      }

      const url = String(data?.waUrl || "");
      if (url) window.open(url, "_blank");

      await load();
    } catch (e: any) {
      setMsg(e?.message || "Failed to send follow-up");
      await load();
    } finally {
      setSendingFollowUp(false);
    }
  }

  function messageCustomer() {
    const phone = String(o?.customer?.phone || "").trim();
    if (!phone) {
      setMsg("No customer phone on this order. If this came from chat, continue the WhatsApp thread.");
      return;
    }

    const shortId = String(orderId).slice(0, 8);
    const text = `Hello, this is regarding your BizHub order #${shortId}.`;

    window.open(waLink(phone, text), "_blank");
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="Order details" subtitle={orderId ? `#${orderId.slice(0, 8)}` : undefined} showBack={true} />

      <div className="px-4 pb-6 space-y-3">
        {loading ? <Card className="p-4">Loading…</Card> : null}
        {msg ? (
          <Card
            className={
              msg.toLowerCase().includes("accepted") ||
              msg.toLowerCase().includes("saved") ||
              msg.toLowerCase().includes("cleared")
                ? "p-4 text-green-700"
                : "p-4 text-red-700"
            }
          >
            {msg}
          </Card>
        ) : null}

        {!loading && o ? (
          <>
            <div className="rounded-[26px] p-4 text-white shadow-float bg-gradient-to-br from-biz-accent2 to-biz-accent">
              <p className="text-xs opacity-95">Amount</p>
              <p className="text-2xl font-extrabold mt-1">{fmtNaira(amount)}</p>
              <p className="text-xs opacity-95 mt-1">
                {String(o?.paymentType || "—")} • <b>{String(o?.opsStatusEffective || o?.opsStatus || "—")}</b>
              </p>
              <p className="text-[11px] opacity-90 mt-2">Created: {fmtDate(o?.createdAt)}</p>

              {disputed ? (
                <p className="text-[11px] opacity-95 mt-2">
                  Dispute: <b>Open</b>
                </p>
              ) : null}
            </div>

            <SectionCard
              title="Customer contact"
              subtitle="Quick message shortcut"
              right={
                <Button size="sm" variant="secondary" onClick={messageCustomer} leftIcon={<MessageCircle className="h-4 w-4" />}>
                  Message
                </Button>
              }
            >
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
                <div className="text-[11px] text-gray-500 mt-2 break-all">
                  Order ID: <b className="text-biz-ink">{orderId}</b>
                </div>

                <div className="mt-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    leftIcon={<AlertTriangle className="h-4 w-4" />}
                    onClick={() => router.push(`/vendor/orders/${encodeURIComponent(orderId)}/dispute`)}
                  >
                    Report an issue
                  </Button>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Follow-up messages" subtitle="WhatsApp follow-ups with a 72-hour limit">
              {!followUpsUnlocked ? (
                <Card variant="soft" className="p-3">
                  <p className="text-sm font-bold text-biz-ink">Locked</p>
                  <p className="text-[11px] text-biz-muted mt-1">Upgrade your plan to send follow-up messages.</p>
                  <div className="mt-2">
                    <Button size="sm" onClick={() => router.push("/vendor/subscription")}>
                      Upgrade
                    </Button>
                  </div>
                </Card>
              ) : (
                <div className="space-y-2">
                  <Card className="p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-biz-ink">Usage</p>
                        <p className="text-[11px] text-gray-500 mt-1">
                          Sent: <b className="text-biz-ink">{followUpsUsed}</b> / <b className="text-biz-ink">{followUpsCap}</b> in 72 hours{" "}
                          • Remaining: <b className="text-biz-ink">{followUpsRemaining}</b>
                        </p>

                        {followUpsResetAtMs ? (
                          <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-2">
                            <Clock className="h-4 w-4" />
                            Resets in: <b className="text-biz-ink">{fmtCountdown(countdownMs)}</b>
                          </p>
                        ) : (
                          <p className="text-[11px] text-gray-500 mt-1">Timer starts after you send the first follow-up.</p>
                        )}
                      </div>
                    </div>
                  </Card>

                  {renderFollowUpsSuggestion()}

                  <textarea
                    className="w-full rounded-2xl border border-biz-line bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-biz-accent/30 focus:border-biz-accent/40"
                    value={followUpText}
                    onChange={(e) => setFollowUpText(e.target.value)}
                    rows={3}
                    placeholder="Write your follow-up message..."
                  />

                  <Button
                    onClick={sendFollowUp}
                    loading={sendingFollowUp}
                    disabled={sendingFollowUp || followUpsLimitReached || !String(o?.customer?.phone || "").trim()}
                    leftIcon={<Send className="h-4 w-4" />}
                  >
                    Send follow-up (WhatsApp)
                  </Button>

                  {followUpsLimitReached ? (
                    <p className="text-[11px] text-biz-muted">You’ve reached your limit. Wait for the timer to reset.</p>
                  ) : null}
                </div>
              )}
            </SectionCard>

            <SectionCard title="Installment plan" subtitle="Split payment into parts">
              {!installmentPlansUnlocked ? (
                <Card variant="soft" className="p-3">
                  <p className="text-sm font-bold text-biz-ink">Locked</p>
                  <p className="text-[11px] text-biz-muted mt-1">
                    {showInstallmentBuyAddon
                      ? "Installment plans are not included on your plan by default. Buy the add-on to unlock it."
                      : "Upgrade your plan to unlock installment plans."}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-2">{installmentRulesHint}</p>

                  <div className="mt-2 flex gap-2">
                    {showInstallmentBuyAddon ? (
                      <Button size="sm" onClick={() => router.push("/vendor/purchases")}>
                        {installmentAddonTitle}
                      </Button>
                    ) : null}

                    <Button size="sm" variant="secondary" onClick={() => router.push("/vendor/subscription")}>
                      Upgrade
                    </Button>
                  </div>
                </Card>
              ) : planEnabled ? (
                <div className="space-y-2">
                  <Card className="p-3">
                    <p className="text-sm font-bold text-biz-ink">Plan active</p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Paid: <b className="text-biz-ink">{fmtNaira(planPaidKobo / 100)}</b> • Remaining:{" "}
                      <b className="text-biz-ink">{fmtNaira(planRemainingKobo / 100)}</b>
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Completed: <b className="text-biz-ink">{plan?.completed ? "Yes" : "No"}</b>
                    </p>

                    <p className="text-[11px] text-gray-500 mt-2">{installmentRulesHint}</p>

                    <div className="mt-2">
                      <Button variant="secondary" size="sm" onClick={clearPlan} loading={savingPlan} disabled={savingPlan}>
                        Clear plan
                      </Button>
                    </div>

                    {planMsg ? (
                      <p
                        className={
                          planMsg.toLowerCase().includes("saved") || planMsg.toLowerCase().includes("cleared")
                            ? "text-[11px] text-emerald-700 mt-2"
                            : "text-[11px] text-rose-700 mt-2"
                        }
                      >
                        {planMsg}
                      </p>
                    ) : null}
                  </Card>

                  <div className="space-y-2">
                    {planInstallments.map((it, idx) => {
                      const status = String(it?.status || "pending");
                      const dueAtMs = Number(it?.dueAtMs || 0);
                      const proofUrl = it?.proof?.cloudinary?.secureUrl ? String(it.proof.cloudinary.secureUrl) : "";
                      const isSubmitted = status === "submitted";
                      const isDone = isSettled(status);

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
                                Due: <b className="text-biz-ink">{fmtDateMs(dueAtMs)}</b>
                              </p>

                              {it?.rejectReason ? (
                                <p className="text-[11px] text-rose-700 mt-2">
                                  Reason: <b>{String(it.rejectReason)}</b>
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
                                View proof
                              </Button>
                            ) : null}
                          </div>

                          {isTransfer ? (
                            isSubmitted ? (
                              <div className="mt-3 space-y-2">
                                <div>
                                  <p className="text-[11px] text-biz-muted mb-1 font-bold">Reject reason (optional)</p>
                                  <textarea
                                    className="w-full rounded-2xl border border-biz-line bg-white p-3 text-sm outline-none"
                                    rows={2}
                                    value={String(rejectReasonMap[String(idx)] || "")}
                                    onChange={(e) =>
                                      setRejectReasonMap((m) => ({ ...m, [String(idx)]: e.target.value }))
                                    }
                                    placeholder="e.g. Amount does not match / Receipt unclear"
                                  />
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <Button
                                    variant="secondary"
                                    loading={reviewingInstallment === String(idx)}
                                    disabled={reviewingInstallment === String(idx)}
                                    onClick={() => reviewInstallment(idx, "reject")}
                                  >
                                    Reject
                                  </Button>
                                  <Button
                                    loading={reviewingInstallment === String(idx)}
                                    disabled={reviewingInstallment === String(idx)}
                                    onClick={() => reviewInstallment(idx, "accept")}
                                  >
                                    Accept
                                  </Button>
                                </div>
                              </div>
                            ) : isDone ? null : (
                              <p className="text-[11px] text-biz-muted mt-2">Waiting for customer proof upload.</p>
                            )
                          ) : null}

                          {isPaystack ? (
                            <p className="text-[11px] text-biz-muted mt-2">
                              Paystack installments will show as <b>paid</b> after verification.
                            </p>
                          ) : null}
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Card variant="soft" className="p-3">
                    <p className="text-sm font-bold text-biz-ink">No plan yet</p>
                    <p className="text-[11px] text-biz-muted mt-1">
                      Add installment amounts and due dates. The total must match the order total exactly.
                    </p>
                    <p className="text-[11px] text-gray-500 mt-2">{installmentRulesHint}</p>
                  </Card>

                  <Card className="p-3">
                    <p className="text-[11px] text-gray-500">
                      Order total: <b className="text-biz-ink">{fmtNaira(totalKobo / 100)}</b> • Draft sum:{" "}
                      <b className={planDraftSumKobo === totalKobo ? "text-emerald-700" : "text-rose-700"}>
                        {fmtNaira(planDraftSumKobo / 100)}
                      </b>
                    </p>

                    <div className="mt-3 space-y-2">
                      {(planDraft || []).map((x, idx) => (
                        <div key={idx} className="rounded-2xl border border-biz-line bg-white p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-bold text-biz-ink">Installment {idx + 1}</p>
                            <button
                              type="button"
                              className="text-rose-700 text-xs font-bold"
                              onClick={() => setPlanDraft((prev) => prev.filter((_: any, i: number) => i !== idx))}
                              disabled={(planDraft || []).length <= 2}
                            >
                              <span className="inline-flex items-center gap-1">
                                <Trash2 className="h-4 w-4" /> Remove
                              </span>
                            </button>
                          </div>

                          <input
                            className="w-full border border-biz-line rounded-2xl p-3 text-sm outline-none bg-white"
                            placeholder={`Label (e.g. Week ${idx + 1})`}
                            value={String(x?.label || "")}
                            onChange={(e) =>
                              setPlanDraft((prev) =>
                                prev.map((p: any, i: number) => (i === idx ? { ...p, label: e.target.value } : p))
                              )
                            }
                          />

                          <input
                            className="w-full border border-biz-line rounded-2xl p-3 text-sm outline-none bg-white"
                            placeholder="Amount (₦)"
                            inputMode="decimal"
                            value={koboToNairaString(Number(x?.amountKobo || 0))}
                            onChange={(e) => {
                              const amountKobo = parseNairaToKobo(e.target.value);
                              setPlanDraft((prev) =>
                                prev.map((p: any, i: number) => (i === idx ? { ...p, amountKobo } : p))
                              );
                            }}
                          />

                          <div>
                            <p className="text-[11px] text-biz-muted mb-1 font-bold">Due date</p>
                            <input
                              type="datetime-local"
                              className="w-full border border-biz-line rounded-2xl p-3 text-sm outline-none bg-white"
                              value={toLocalDateTimeInput(Number(x?.dueAtMs || 0))}
                              onChange={(e) => {
                                const dueAtMs = fromLocalDateTimeInput(e.target.value);
                                setPlanDraft((prev) =>
                                  prev.map((p: any, i: number) => (i === idx ? { ...p, dueAtMs } : p))
                                );
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() =>
                          setPlanDraft((prev) => [
                            ...(prev || []),
                            { label: `Installment ${(prev || []).length + 1}`, amountKobo: 0, dueAtMs: 0 },
                          ])
                        }
                        leftIcon={<Plus className="h-4 w-4" />}
                      >
                        Add installment
                      </Button>

                      <Button size="sm" onClick={savePlan} loading={savingPlan} disabled={savingPlan || !planDraftValid}>
                        Save plan
                      </Button>
                    </div>

                    {!planDraftValid ? (
                      <p className="text-[11px] text-biz-muted mt-2">
                        At least 2 installments, all due dates set, and the sum equals the order total.
                      </p>
                    ) : null}

                    {planMsg ? (
                      <p
                        className={
                          planMsg.toLowerCase().includes("saved")
                            ? "text-[11px] text-emerald-700 mt-2"
                            : "text-[11px] text-rose-700 mt-2"
                        }
                      >
                        {planMsg}
                      </p>
                    ) : null}
                  </Card>
                </div>
              )}
            </SectionCard>

            {!shouldHideSingleTransferProof ? (
              <SectionCard title="Bank transfer proof" subtitle="Customer upload (paid plans)">
                {!isTransfer ? (
                  <Card variant="soft" className="p-3">
                    <p className="text-sm font-bold text-biz-ink">Not a bank transfer</p>
                    <p className="text-[11px] text-biz-muted mt-1">Proof upload is only for bank transfer orders.</p>
                  </Card>
                ) : !transferProofUnlocked ? (
                  <Card variant="soft" className="p-3">
                    <p className="text-sm font-bold text-biz-ink">Locked</p>
                    <p className="text-[11px] text-biz-muted mt-1">Upgrade to enable proof-of-payment upload and review.</p>
                    <div className="mt-2">
                      <Button size="sm" onClick={() => router.push("/vendor/subscription")}>
                        Upgrade
                      </Button>
                    </div>
                  </Card>
                ) : !tp ? (
                  <Card variant="soft" className="p-3">
                    <p className="text-sm font-bold text-biz-ink">No proof uploaded yet</p>
                    <p className="text-[11px] text-biz-muted mt-1">
                      The customer will upload on the bank details page after transfer.
                    </p>
                  </Card>
                ) : (
                  <div className="space-y-2">
                    <Card className="p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-biz-ink">
                            Status:{" "}
                            <b
                              className={
                                tpStatus === "accepted"
                                  ? "text-emerald-700"
                                  : tpStatus === "rejected"
                                  ? "text-rose-700"
                                  : "text-orange-700"
                              }
                            >
                              {tpStatus || "submitted"}
                            </b>
                          </p>
                          <p className="text-[11px] text-gray-500 mt-1 break-all">
                            File: <b className="text-biz-ink">{tp.originalName || "—"}</b>
                          </p>
                          <p className="text-[11px] text-gray-500 mt-1">
                            Uploaded: <b className="text-biz-ink">{fmtDateMs(Number(tp.uploadedAtMs || 0))}</b>
                          </p>

                          {tp.reviewedAtMs ? (
                            <p className="text-[11px] text-gray-500 mt-1">
                              Reviewed: <b className="text-biz-ink">{fmtDateMs(Number(tp.reviewedAtMs || 0))}</b>
                            </p>
                          ) : null}

                          {tp.rejectReason ? (
                            <p className="text-[11px] text-rose-700 mt-2">
                              Reason: <b>{String(tp.rejectReason)}</b>
                            </p>
                          ) : null}
                        </div>

                        {tpViewUrl ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => window.open(tpViewUrl, "_blank")}
                            leftIcon={<ExternalLink className="h-4 w-4" />}
                          >
                            View
                          </Button>
                        ) : null}
                      </div>
                    </Card>

                    {tpStatus === "submitted" ? (
                      <Card className="p-3 space-y-2">
                        <p className="text-[11px] text-biz-muted">
                          Accept if the transfer details look correct. Reject if it’s unclear or wrong.
                        </p>

                        <div>
                          <p className="text-[11px] text-biz-muted mb-1 font-bold">Reject reason (optional)</p>
                          <textarea
                            className="w-full rounded-2xl border border-biz-line bg-white p-3 text-sm outline-none"
                            rows={2}
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="e.g. Amount does not match / Receipt unclear"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="secondary" loading={reviewing} disabled={reviewing} onClick={() => reviewProof("reject")}>
                            Reject
                          </Button>
                          <Button loading={reviewing} disabled={reviewing} onClick={() => reviewProof("accept")}>
                            Accept
                          </Button>
                        </div>
                      </Card>
                    ) : null}
                  </div>
                )}
              </SectionCard>
            ) : (
              <SectionCard title="Bank transfer proof" subtitle="Installments active">
                <Card variant="soft" className="p-3">
                  <p className="text-sm font-bold text-biz-ink">Installment plan is active</p>
                  <p className="text-[11px] text-biz-muted mt-1">
                    Proof is collected and reviewed per installment (see installment list above).
                  </p>
                </Card>
              </SectionCard>
            )}

            <SectionCard title="Order progress" subtitle="Update how this order is moving">
              {!canUpdateStatus ? (
                <Card variant="soft" className="p-3">
                  <p className="text-sm font-bold text-biz-ink">Locked</p>
                  <p className="text-[11px] text-biz-muted mt-1">Upgrade to update order progress.</p>
                  <div className="mt-2">
                    <Button size="sm" onClick={() => router.push("/vendor/subscription")}>
                      Upgrade
                    </Button>
                  </div>
                </Card>
              ) : (
                <>
                  <SegmentedControl<Ops>
                    value={opsValue}
                    onChange={(v) => setOpsStatus(v)}
                    options={OPS_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
                    className="!grid-cols-3"
                  />
                  {savingStatus ? <p className="text-[11px] text-biz-muted mt-2">Updating…</p> : null}
                </>
              )}

              <p className="text-[11px] text-biz-muted mt-3">
                Payment state still exists separately (escrow/transfer/installments). This is the operational progress.
              </p>
            </SectionCard>

            <SectionCard title="Internal notes" subtitle="Private notes for your team">
              {!canUseNotes ? (
                <Card variant="soft" className="p-3">
                  <p className="text-sm font-bold text-biz-ink">Locked</p>
                  <p className="text-[11px] text-biz-muted mt-1">Upgrade to use internal notes.</p>
                  <div className="mt-2">
                    <Button size="sm" onClick={() => router.push("/vendor/subscription")}>
                      Upgrade
                    </Button>
                  </div>
                </Card>
              ) : (
                <>
                  <textarea
                    className="w-full rounded-2xl border border-biz-line bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-biz-accent/30 focus:border-biz-accent/40"
                    placeholder="Write a note (e.g. Customer asked for red color, dispatch tomorrow)…"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    rows={4}
                  />
                  <div className="mt-2">
                    <Button onClick={addNote} loading={savingNote} disabled={savingNote || noteText.trim().length < 2}>
                      Add note
                    </Button>
                  </div>

                  {notes.length === 0 ? (
                    <p className="text-sm text-biz-muted mt-3">No notes yet.</p>
                  ) : (
                    <div className="mt-3 space-y-2">
                      {notes.map((n) => (
                        <div key={n.id} className="rounded-2xl border border-biz-line bg-white p-3">
                          <p className="text-sm text-gray-800 whitespace-pre-wrap">{String(n.text || "")}</p>
                          <p className="text-[11px] text-gray-500 mt-2">
                            {n.createdAtMs ? new Date(Number(n.createdAtMs)).toLocaleString() : "—"}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </SectionCard>

            <Card className="p-4">
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => router.push("/vendor/orders")}>
                  Back to orders
                </Button>
                <Button onClick={() => router.push("/vendor")}>Dashboard</Button>
              </div>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}