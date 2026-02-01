"use client";

import { useEffect, useState } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { auth } from "@/lib/firebase/client";

function fmtNairaFromKobo(kobo: number) {
  const n = Number(kobo || 0) / 100;
  try {
    return `₦${n.toLocaleString()}`;
  } catch {
    return `₦${n}`;
  }
}

function fmtDate(ms?: number) {
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ms);
  }
}

export default function AdminWithdrawalsPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [note, setNote] = useState("");

  async function api(path: string, init?: RequestInit) {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(path, { ...init, headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error || "Request failed");
    return j;
  }

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const j = await api("/api/admin/withdrawals");
      setItems(Array.isArray(j.withdrawals) ? j.withdrawals : []);
    } catch (e: any) {
      setMsg(e?.message || "Failed");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function act(withdrawalId: string, action: "reject" | "mark_paid") {
    try {
      await api("/api/admin/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ withdrawalId, action, note }),
      });
      setNote("");
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed");
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="min-h-screen">
      <GradientHeader title="Withdrawals" subtitle="Admin payout processing" showBack={true} />

      <div className="px-4 pb-24 space-y-3">
        {loading ? <Card className="p-4">Loading…</Card> : null}
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}

        <Card className="p-4">
          <p className="text-sm font-bold text-biz-ink">Admin note (optional)</p>
          <p className="text-xs text-biz-muted mt-1">This note will be saved on the withdrawal record.</p>
          <div className="mt-2">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Paid via transfer at 2:30pm" />
          </div>
          <div className="mt-3">
            <Button variant="secondary" onClick={load}>Refresh</Button>
          </div>
        </Card>

        {items.length === 0 && !loading ? (
          <Card className="p-4">No withdrawal requests yet.</Card>
        ) : (
          items.map((w) => (
            <Card key={w.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-biz-ink">{w.status || "pending"}</p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {fmtDate(Number(w.createdAtMs || 0))}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1 break-all">
                    Business: <b className="text-biz-ink">{w.businessId}</b> • Slug: <b className="text-biz-ink">{w.businessSlug || "—"}</b>
                  </p>

                  <div className="mt-2 rounded-2xl border border-biz-line bg-white p-3">
                    <p className="text-[11px] text-gray-500">Bank</p>
                    <p className="text-sm font-bold text-biz-ink mt-1">{w?.payoutDetails?.bankName || "—"}</p>
                    <p className="text-[11px] text-gray-500 mt-1">
                      {w?.payoutDetails?.accountNumber || "—"} • {w?.payoutDetails?.accountName || "—"}
                    </p>
                  </div>

                  {w.adminNote ? (
                    <p className="text-[11px] text-gray-600 mt-2">
                      Note: {String(w.adminNote)}
                    </p>
                  ) : null}
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-biz-ink">
                    {fmtNairaFromKobo(Number(w.amountKobo || 0))}
                  </p>
                </div>
              </div>

              {String(w.status || "") === "pending" ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => act(w.id, "reject")}>Reject</Button>
                  <Button onClick={() => act(w.id, "mark_paid")}>Mark paid</Button>
                </div>
              ) : null}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}