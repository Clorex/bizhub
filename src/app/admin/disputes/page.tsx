// FILE: src/app/admin/disputes/page.tsx
"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase/client";
import { Card } from "@/components/Card";
import GradientHeader from "@/components/GradientHeader";
import { Button } from "@/components/ui/Button";

function fmtDate(v: any) {
  try {
    if (!v) return "—";
    if (typeof v?.toDate === "function") return v.toDate().toLocaleString();
    return String(v);
  } catch {
    return "—";
  }
}

export default function AdminDisputesPage() {
  const [items, setItems] = useState<any[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  async function api(path: string, init?: RequestInit) {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(path, { ...init, headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || "Request failed");
    return data;
  }

  async function load() {
    setMsg(null);
    try {
      const data = await api("/api/admin/disputes");
      setItems(data.disputes || []);
    } catch (e: any) {
      setMsg(e?.message || "Failed");
    }
  }

  async function resolve(disputeId: string, decision: "release" | "refund") {
    try {
      await api("/api/admin/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ disputeId, decision }),
      });
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed");
    }
  }

  async function freezeBuyer(key: string, frozen: boolean) {
    const reason = frozen ? "Open dispute" : "";
    try {
      await api("/api/admin/buyers/freeze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, frozen, reason }),
      });
      await load();
    } catch (e: any) {
      alert(e?.message || "Failed");
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <GradientHeader title="Disputes" showBack={true} />
      <div className="px-4 -mt-4 pb-24 space-y-3">
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}

        {items.length === 0 ? (
          <Card className="p-4">No disputes</Card>
        ) : (
          items.map((d) => {
            const evidence: string[] = Array.isArray(d.evidenceUrls) ? d.evidenceUrls : [];
            const buyerKey = String(d.buyerKey || "").trim();

            return (
              <Card key={d.id} className="p-4">
                <p className="font-semibold text-gray-900">Dispute</p>
                <p className="text-xs text-gray-600 break-all">{d.id}</p>

                <p className="text-sm mt-2">
                  Order: <b className="break-all">{d.orderId}</b>
                </p>
                <p className="text-sm mt-1">
                  Reason: <b>{d.reason}</b>
                </p>
                {d.details ? <p className="text-sm mt-1 text-gray-700 whitespace-pre-wrap">{String(d.details)}</p> : null}

                <p className="text-xs text-gray-600 mt-2">
                  Status: <b>{d.status}</b> • Created: {fmtDate(d.createdAt)}
                </p>

                <p className="text-xs text-gray-600 mt-2">
                  From: <b>{String(d.createdByType || "—")}</b> • Priority: <b>{Number(d.priority || 1)}</b> • Plan:{" "}
                  <b>{String(d.vendorPlanKey || "FREE")}</b>
                </p>

                {buyerKey ? (
                  <p className="text-[11px] text-gray-600 mt-2 break-all">
                    BuyerKey: <b className="text-gray-900">{buyerKey}</b>
                  </p>
                ) : null}

                {evidence.length ? (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {evidence.slice(0, 9).map((u) => (
                      <a key={u} href={u} target="_blank" rel="noreferrer" className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt="Evidence" className="h-24 w-full object-cover rounded-2xl border" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 mt-2">No evidence uploaded.</p>
                )}

                {d.status === "open" ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button className="rounded-2xl border py-2 text-sm font-semibold" onClick={() => resolve(d.id, "release")}>
                      Release
                    </button>
                    <button className="rounded-2xl border py-2 text-sm font-semibold" onClick={() => resolve(d.id, "refund")}>
                      Refund
                    </button>
                  </div>
                ) : null}

                {buyerKey ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button variant="secondary" size="sm" onClick={() => freezeBuyer(buyerKey, true)}>
                      Freeze buyer
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => freezeBuyer(buyerKey, false)}>
                      Unfreeze buyer
                    </Button>
                  </div>
                ) : null}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}