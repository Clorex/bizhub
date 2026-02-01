// FILE: src/app/vendor/orders/[orderId]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { auth } from "@/lib/firebase/client";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { MessageCircle, AlertTriangle } from "lucide-react";

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

function digitsOnlyPhone(v: string) {
  return String(v || "").replace(/[^\d]/g, "");
}

function waLink(wa: string, text: string) {
  const digits = digitsOnlyPhone(wa);
  const t = encodeURIComponent(text);
  return `https://wa.me/${digits}?text=${t}`;
}

type Ops =
  | "new"
  | "contacted"
  | "paid"
  | "in_transit"
  | "delivered"
  | "cancelled";

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

  const items = useMemo(() => (Array.isArray(o?.items) ? o.items : []), [o]);
  const amount = Number(o?.amount || (o?.amountKobo ? o.amountKobo / 100 : 0) || 0);

  const canUpdateStatus = !!meta?.limits?.canUpdateStatus;
  const canUseNotes = !!meta?.limits?.canUseNotes;

  const disputed = String(o?.orderStatus || "").toLowerCase() === "disputed" || String(o?.escrowStatus || "").toLowerCase() === "disputed";

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
        {msg ? <Card className={msg.toLowerCase().includes("saved") ? "p-4 text-green-700" : "p-4 text-red-700"}>{msg}</Card> : null}

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
                Payment state still exists separately (escrow/transfer). This is the operational progress.
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