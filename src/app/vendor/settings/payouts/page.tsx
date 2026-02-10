"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase/client";
import { Card } from "@/components/Card";
import { GradientHeader } from "@/components/GradientHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Banknote, AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";

export default function VendorPayoutSettingsPage() {
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

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

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const data = await api("/api/vendor/payout-details");
      const p = data?.payoutDetails || {};
      setBankName(p.bankName || "");
      setAccountNumber(p.accountNumber || "");
      setAccountName(p.accountName || "");
    } catch (e: any) {
      setMsg({ text: e?.message || "Failed to load payout details", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      if (!bankName.trim()) throw new Error("Please enter your bank name");
      if (!accountNumber.trim()) throw new Error("Please enter your account number");
      if (!accountName.trim()) throw new Error("Please enter your account name");

      await api("/api/vendor/payout-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankName: bankName.trim(), accountNumber: accountNumber.trim(), accountName: accountName.trim() }),
      });
      setMsg({ text: "Payout details saved successfully", type: "success" });
    } catch (e: any) {
      setMsg({ text: e?.message || "Failed to save", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  const hasDetails = !!(bankName.trim() && accountNumber.trim() && accountName.trim());

  return (
    <div className="min-h-screen bg-gray-50/30">
      <GradientHeader
        title="Payout Details"
        subtitle="Your bank account for withdrawals"
        showBack={true}
        right={
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-full border border-gray-100 bg-white px-3 py-2 text-xs font-semibold text-gray-600 shadow-sm"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        }
      />

      <div className="px-4 pb-32 space-y-4">
        {/* Status message */}
        {msg ? (
          <Card className="p-4">
            <div className="flex items-start gap-3">
              {msg.type === "error" ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                </div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-semibold ${msg.type === "error" ? "text-red-700" : "text-emerald-700"}`}>
                  {msg.type === "error" ? "Error" : "Success"}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{msg.text}</p>
              </div>
            </div>
          </Card>
        ) : null}

        {/* Current status card */}
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50">
              <Banknote className="h-5 w-5 text-orange-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900">Bank account</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {loading
                  ? "Loading your payout details…"
                  : hasDetails
                    ? `${bankName} · ${accountNumber}`
                    : "No bank details saved yet. Add your details below."}
              </p>
            </div>
          </div>
        </Card>

        {/* Loading skeleton */}
        {loading ? (
          <Card className="p-4 space-y-4">
            <div className="space-y-3">
              <div className="h-4 w-24 rounded bg-gray-100 animate-pulse" />
              <div className="h-12 w-full rounded-xl bg-gray-100 animate-pulse" />
              <div className="h-4 w-32 rounded bg-gray-100 animate-pulse" />
              <div className="h-12 w-full rounded-xl bg-gray-100 animate-pulse" />
              <div className="h-4 w-28 rounded bg-gray-100 animate-pulse" />
              <div className="h-12 w-full rounded-xl bg-gray-100 animate-pulse" />
            </div>
          </Card>
        ) : (
          <SectionCard title="Bank details" subtitle="Enter your Nigerian bank account for payouts">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Bank name</label>
                <Input
                  placeholder="e.g. First Bank, GTBank, Access Bank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Account number</label>
                <Input
                  placeholder="e.g. 0123456789"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value)}
                  inputMode="numeric"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Account name</label>
                <Input
                  placeholder="e.g. John Doe"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                />
              </div>

              <Button onClick={save} loading={saving} disabled={saving}>
                {saving ? "Saving…" : "Save payout details"}
              </Button>
            </div>
          </SectionCard>
        )}

        {/* Info card */}
        {!loading ? (
          <Card className="p-4">
            <p className="text-xs text-gray-500">
              Your payout details are used when you request a withdrawal from your available balance.
              Make sure the account name matches your bank records.
            </p>
          </Card>
        ) : null}
      </div>
    </div>
  );
}