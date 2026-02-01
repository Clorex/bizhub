// FILE: src/app/admin/verification/page.tsx
"use client";

import { useEffect, useState } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { auth } from "@/lib/firebase/client";

function fmtDateMs(ms?: number) {
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ms);
  }
}

export default function AdminVerificationPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [note, setNote] = useState("");

  async function api(path: string, init?: RequestInit) {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(path, { ...init, headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || "Request failed");
    return data;
  }

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const data = await api("/api/admin/verification?status=pending");
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e: any) {
      setMsg(e?.message || "Failed");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function act(submissionId: string, tier: string, decision: "approve" | "reject") {
    try {
      await api("/api/admin/verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submissionId, tier, decision, note }),
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
      <GradientHeader title="Verification" subtitle="Tier reviews" showBack={true} />

      <div className="px-4 pb-24 space-y-3">
        {loading ? <Card className="p-4">Loading…</Card> : null}
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}

        <Card className="p-4">
          <p className="text-sm font-bold text-biz-ink">Admin note (for rejection)</p>
          <p className="text-xs text-biz-muted mt-1">Example: “ID number mismatch” or “Address proof unclear”.</p>
          <div className="mt-2">
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (optional)" />
          </div>
          <div className="mt-3">
            <Button variant="secondary" onClick={load}>Refresh</Button>
          </div>
        </Card>

        {!loading && items.length === 0 ? (
          <Card className="p-4">No pending verification submissions.</Card>
        ) : null}

        <div className="space-y-3">
          {items.map((x) => {
            const biz = x.business || null;
            const tier = String(x.tier || "");
            const payload = x.payload || {};
            const proofUrls: string[] = Array.isArray(payload.proofUrls) ? payload.proofUrls : [];
            const selfieUrls: string[] = Array.isArray(payload.selfieUrls) ? payload.selfieUrls : [];

            return (
              <Card key={x.id} className="p-4">
                <p className="text-sm font-bold text-biz-ink">
                  {biz?.name || "Business"} <span className="text-biz-muted">({biz?.slug || "—"})</span>
                </p>

                <p className="text-[11px] text-gray-500 mt-1">
                  Tier: <b className="text-biz-ink">{tier}</b> • Submitted:{" "}
                  <b className="text-biz-ink">{fmtDateMs(Number(x.createdAtMs || 0))}</b>
                </p>

                {tier === "tier2" ? (
                  <div className="mt-2 rounded-2xl border border-biz-line bg-white p-3">
                    <p className="text-[11px] text-gray-500">ID Type</p>
                    <p className="text-sm font-bold text-biz-ink mt-1">{String(payload.idType || "—")}</p>
                    <p className="text-[11px] text-gray-500 mt-2">ID Number</p>
                    <p className="text-sm font-bold text-biz-ink mt-1 break-all">{String(payload.idNumber || "—")}</p>
                  </div>
                ) : null}

                {tier === "tier3" && proofUrls.length ? (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {proofUrls.slice(0, 9).map((u: string) => (
                      <a key={u} href={u} target="_blank" rel="noreferrer" className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="Proof" className="h-24 w-full object-cover rounded-2xl border" />
                      </a>
                    ))}
                  </div>
                ) : null}

                {tier === "tier1" && selfieUrls.length ? (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {selfieUrls.slice(0, 9).map((u: string) => (
                      <a key={u} href={u} target="_blank" rel="noreferrer" className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="Selfie" className="h-24 w-full object-cover rounded-2xl border" />
                      </a>
                    ))}
                  </div>
                ) : null}

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button onClick={() => act(String(x.id), tier, "approve")}>Approve</Button>
                  <Button variant="danger" onClick={() => act(String(x.id), tier, "reject")}>Reject</Button>
                </div>

                <p className="mt-2 text-[11px] text-biz-muted break-all">
                  BusinessId: {String(x.businessId || "—")}
                </p>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}