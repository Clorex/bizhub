"use client";

import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase/client";
import { Card } from "@/components/Card";
import { GradientHeader } from "@/components/GradientHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/ui/toast";
import { cn } from "@/lib/cn";
import { Banknote, AlertCircle, CheckCircle2, RefreshCw, Info, Eye } from "lucide-react";

type FormErrors = {
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
};

function validateForm(bankName: string, accountNumber: string, accountName: string): FormErrors {
  const errors: FormErrors = {};

  if (!bankName.trim()) {
    errors.bankName = "Bank name is required.";
  }

  const digits = accountNumber.replace(/\D/g, "");
  if (!digits) {
    errors.accountNumber = "Account number is required.";
  } else if (digits.length !== 10) {
    errors.accountNumber = "Account number must be exactly 10 digits.";
  }

  if (!accountName.trim()) {
    errors.accountName = "Account name is required.";
  } else if (accountName.trim().length < 3) {
    errors.accountName = "Account name must be at least 3 characters.";
  }

  return errors;
}

export default function VendorPayoutSettingsPage() {
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [msg, setMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState(false);

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
      setTouched(false);
      setErrors({});
    } catch (e: any) {
      const m = e?.message || "Failed to load payout details";
      setMsg({ text: m, type: "error" });
      toast.error(m);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Re-validate on change after first submit attempt
  useEffect(() => {
    if (!touched) return;
    setErrors(validateForm(bankName, accountNumber, accountName));
  }, [bankName, accountNumber, accountName, touched]);

  const hasErrors = Object.keys(errors).length > 0;

  async function save() {
    setTouched(true);

    const e = validateForm(bankName, accountNumber, accountName);
    setErrors(e);

    if (Object.keys(e).length > 0) {
      toast.error("Please fix the errors before saving.");
      return;
    }

    setSaving(true);
    setMsg(null);
    try {
      await api("/api/vendor/payout-details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bankName: bankName.trim(),
          accountNumber: accountNumber.replace(/\D/g, "").trim(),
          accountName: accountName.trim(),
        }),
      });
      setMsg({ text: "Payout details saved successfully!", type: "success" });
      toast.success("Payout details saved!");
      setTouched(false);
    } catch (e: any) {
      const m = e?.message || "Failed to save payout details.";
      setMsg({ text: m, type: "error" });
      toast.error(m);
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
            disabled={loading}
            className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn("w-5 h-5 text-white", loading && "animate-spin")} />
          </button>
        }
      />

      <div className="px-4 pb-32 space-y-4">
        {/* Status message */}
        {msg && (
          <Card className="p-4">
            <div className="flex items-start gap-3">
              {msg.type === "error" ? (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 shrink-0">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                </div>
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-semibold", msg.type === "error" ? "text-red-700" : "text-emerald-700")}>
                  {msg.type === "error" ? "Error" : "Success"}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{msg.text}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Important notice — bank details shown to buyers */}
        {!loading && (
          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                <Eye className="w-5 h-5 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-blue-800">Visible to customers</p>
                <p className="text-xs text-blue-700 mt-1 leading-relaxed">
                  These bank details are shown to customers who choose direct bank transfer at checkout,
                  and are also used for your payout withdrawals. Make sure they are correct.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Current status card */}
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50 shrink-0">
              <Banknote className="h-5 w-5 text-orange-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-gray-900">Bank account</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {loading
                  ? "Loading your payout details\u2026"
                  : hasDetails
                    ? `${bankName} \u00B7 ${accountNumber} \u00B7 ${accountName}`
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
          <SectionCard title="Bank details" subtitle="Enter your Nigerian bank account">
            <div className="space-y-4">
              {/* Bank name */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Bank name</label>
                <Input
                  placeholder="e.g. First Bank, GTBank, Access Bank"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                />
                {touched && errors.bankName ? (
                  <p className="text-[11px] text-red-600 mt-1">{errors.bankName}</p>
                ) : (
                  <p className="text-[10px] text-gray-400 mt-1">Your Nigerian bank name</p>
                )}
              </div>

              {/* Account number */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Account number</label>
                <Input
                  placeholder="e.g. 0123456789"
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                  inputMode="numeric"
                  maxLength={10}
                />
                {touched && errors.accountNumber ? (
                  <p className="text-[11px] text-red-600 mt-1">{errors.accountNumber}</p>
                ) : (
                  <p className="text-[10px] text-gray-400 mt-1">
                    Must be exactly 10 digits ({accountNumber.replace(/\D/g, "").length}/10)
                  </p>
                )}
              </div>

              {/* Account name */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">Account name</label>
                <Input
                  placeholder="e.g. John Doe or My Business Ltd"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                />
                {touched && errors.accountName ? (
                  <p className="text-[11px] text-red-600 mt-1">{errors.accountName}</p>
                ) : (
                  <p className="text-[10px] text-gray-400 mt-1">Must match the name on your bank account</p>
                )}
              </div>

              <Button
                onClick={save}
                loading={saving}
                disabled={saving || (touched && hasErrors)}
              >
                {saving ? "Saving\u2026" : "Save payout details"}
              </Button>
            </div>
          </SectionCard>
        )}

        {/* Tip card */}
        {!loading && (
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                <Info className="w-4 h-4 text-amber-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-gray-700">Tip</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">
                  Double-check that your account name matches your bank records exactly.
                  Mismatched names may cause withdrawal delays.
                </p>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
