"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase/client";
import { Card } from "@/components/Card";
import { GradientHeader } from "@/components/GradientHeader";

export default function VendorPayoutSettingsPage() {
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function api(path: string, init?: RequestInit) {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(path, {
      ...init,
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || "Request failed");
    return data;
  }

  useEffect(() => {
    (async () => {
      try {
        const data = await api("/api/vendor/payout-details");
        const p = data?.payoutDetails || {};
        setBankName(p.bankName || "");
        setAccountNumber(p.accountNumber || "");
        setAccountName(p.accountName || "");
      } catch (e: any) {
        setMsg(e?.message || "Failed to load");
      }
    })();
  }, []);

  async function save() {
    setLoading(true);
    setMsg(null);
    try {
      await api("/api/vendor/payout-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankName, accountNumber, accountName }),
      });
      setMsg("Saved.");
    } catch (e: any) {
      setMsg(e?.message || "Save failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <GradientHeader title="Payout Details" showBack={true} />
      <div className="px-4 -mt-4 pb-24 space-y-3">
        <Card className="p-4">
          <p className="font-semibold text-gray-900">Bank details</p>

          <div className="mt-4 space-y-2">
            <input className="w-full border rounded-xl p-3" placeholder="Bank name" value={bankName} onChange={(e) => setBankName(e.target.value)} />
            <input className="w-full border rounded-xl p-3" placeholder="Account number" value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} />
            <input className="w-full border rounded-xl p-3" placeholder="Account name" value={accountName} onChange={(e) => setAccountName(e.target.value)} />
          </div>

          <button className="mt-4 w-full rounded-2xl bg-black py-3 text-sm font-semibold text-white disabled:opacity-50" onClick={save} disabled={loading}>
            {loading ? "Saving..." : "Save"}
          </button>

          {msg ? <p className="mt-3 text-sm text-gray-700">{msg}</p> : null}
        </Card>
      </div>
    </div>
  );
}