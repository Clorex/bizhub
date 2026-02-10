// FILE: src/app/admin/smartmatch/page-client.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase/client";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import {
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Settings2,
  Zap,
  Shield,
  Flag,
  BarChart3,
  Power,
  Sliders,
  Search,
  AlertTriangle,
} from "lucide-react";

type WeightsState = {
  location: number;
  delivery: number;
  reliability: number;
  paymentFit: number;
  vendorQuality: number;
  buyerHistory: number;
};

type ConfigState = {
  enabled: boolean;
  weights: WeightsState;
  hideThreshold: number;
  premiumBonus: number;
  premiumMinScore: number;
  profileCacheTtlMs: number;
  scoreCacheTtlMs: number;
};

type ComputeResult = {
  ok: boolean;
  mode?: string;
  computed?: number;
  failed?: number;
  errors?: string[];
  profile?: any;
  error?: string;
};

type Toast = { text: string; type: "success" | "error" } | null;

const WEIGHT_FIELDS: { key: keyof WeightsState; label: string; hint: string; icon: any; max: number }[] = [
  { key: "location", label: "Location Match", hint: "Same city/state proximity", icon: Search, max: 50 },
  { key: "delivery", label: "Delivery Speed", hint: "Fast delivery performance", icon: Zap, max: 50 },
  { key: "reliability", label: "Order Reliability", hint: "Fulfillment rate", icon: CheckCircle2, max: 50 },
  { key: "paymentFit", label: "Payment Fit", hint: "Supports buyer's payment method", icon: BarChart3, max: 50 },
  { key: "vendorQuality", label: "Vendor Quality", hint: "Verification + disputes + stock", icon: Shield, max: 50 },
  { key: "buyerHistory", label: "Buyer History", hint: "Repeat purchases boost", icon: Settings2, max: 50 },
];

export default function AdminSmartMatchPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [computing, setComputing] = useState(false);
  const [flagging, setFlagging] = useState(false);

  const [config, setConfig] = useState<ConfigState | null>(null);
  const [draft, setDraft] = useState<ConfigState | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  const [computeResult, setComputeResult] = useState<ComputeResult | null>(null);

  // Flag vendor state
  const [flagBusinessId, setFlagBusinessId] = useState("");
  const [flagReason, setFlagReason] = useState("");
  const [flagAction, setFlagAction] = useState<"flag" | "unflag">("flag");

  // Single vendor compute
  const [singleBusinessId, setSingleBusinessId] = useState("");

  async function authedFetch(path: string, init?: RequestInit) {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(path, {
      ...init,
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || "Request failed");
    return data;
  }

  async function loadConfig() {
    setLoading(true);
    setToast(null);
    try {
      const data = await authedFetch("/api/admin/smartmatch/config");
      if (data?.ok && data?.config) {
        setConfig(data.config);
        setDraft(JSON.parse(JSON.stringify(data.config)));
      } else {
        throw new Error("Failed to load config");
      }
    } catch (e: any) {
      setToast({ text: e?.message || "Failed to load", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadConfig();
  }, []);

  async function saveConfig() {
    if (!draft) return;
    setSaving(true);
    setToast(null);
    try {
      const total =
        draft.weights.location +
        draft.weights.delivery +
        draft.weights.reliability +
        draft.weights.paymentFit +
        draft.weights.vendorQuality +
        draft.weights.buyerHistory;

      if (total > 150) {
        throw new Error(`Total weight (${total}) is too high. Keep around 100 for balanced scoring.`);
      }

      const data = await authedFetch("/api/admin/smartmatch/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });

      if (data?.ok && data?.config) {
        setConfig(data.config);
        setDraft(JSON.parse(JSON.stringify(data.config)));
        setToast({ text: "Config saved successfully", type: "success" });
      }
    } catch (e: any) {
      setToast({ text: e?.message || "Failed to save", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function runCompute(businessId?: string) {
    setComputing(true);
    setComputeResult(null);
    setToast(null);
    try {
      const body: any = {};
      if (businessId?.trim()) body.businessId = businessId.trim();

      const data = await authedFetch("/api/admin/smartmatch/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      setComputeResult(data);

      if (data?.ok) {
        const msg =
          data.mode === "single"
            ? `Profile computed for ${data.businessId}`
            : `Computed ${data.computed} profiles (${data.failed} failed)`;
        setToast({ text: msg, type: "success" });
      } else {
        setToast({ text: data?.error || "Compute failed", type: "error" });
      }
    } catch (e: any) {
      setToast({ text: e?.message || "Compute failed", type: "error" });
    } finally {
      setComputing(false);
    }
  }

  async function flagVendor() {
    if (!flagBusinessId.trim()) return;
    setFlagging(true);
    setToast(null);
    try {
      const data = await authedFetch("/api/admin/smartmatch/flag", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: flagBusinessId.trim(),
          flagged: flagAction === "flag",
          reason: flagReason.trim(),
        }),
      });

      if (data?.ok) {
        setToast({
          text: `Vendor ${flagAction === "flag" ? "flagged" : "unflagged"} successfully`,
          type: "success",
        });
        setFlagBusinessId("");
        setFlagReason("");
      }
    } catch (e: any) {
      setToast({ text: e?.message || "Flag operation failed", type: "error" });
    } finally {
      setFlagging(false);
    }
  }

  const weightsTotal = draft
    ? draft.weights.location +
      draft.weights.delivery +
      draft.weights.reliability +
      draft.weights.paymentFit +
      draft.weights.vendorQuality +
      draft.weights.buyerHistory
    : 0;

  const hasUnsaved =
    draft && config ? JSON.stringify(draft) !== JSON.stringify(config) : false;

  return (
    <div className="min-h-screen bg-gray-50/30">
      <GradientHeader
        title="Smart Match"
        subtitle="Control scoring weights and vendor profiles"
        showBack={true}
        right={
          <button
            onClick={loadConfig}
            className="flex items-center gap-1.5 rounded-full border border-gray-100 bg-white px-3 py-2 text-xs font-semibold text-gray-600 shadow-sm"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        }
      />

      <div className="px-4 pb-32 space-y-4">
        {/* Toast */}
        {toast ? (
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  toast.type === "error" ? "bg-red-50" : "bg-emerald-50"
                }`}
              >
                {toast.type === "error" ? (
                  <AlertCircle className="h-5 w-5 text-red-500" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-semibold ${
                    toast.type === "error" ? "text-red-700" : "text-emerald-700"
                  }`}
                >
                  {toast.type === "error" ? "Error" : "Success"}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{toast.text}</p>
              </div>
            </div>
          </Card>
        ) : null}

        {/* Loading */}
        {loading ? (
          <>
            <div className="h-20 rounded-2xl bg-gray-100 animate-pulse" />
            <div className="h-64 rounded-2xl bg-gray-100 animate-pulse" />
            <div className="h-40 rounded-2xl bg-gray-100 animate-pulse" />
          </>
        ) : null}

        {!loading && draft ? (
          <>
            {/* Enable / Disable */}
            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      draft.enabled ? "bg-emerald-50" : "bg-gray-100"
                    }`}
                  >
                    <Power
                      className={`h-5 w-5 ${
                        draft.enabled ? "text-emerald-600" : "text-gray-400"
                      }`}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      Smart Match {draft.enabled ? "Enabled" : "Disabled"}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {draft.enabled
                        ? "Buyers see personalized rankings and badges"
                        : "Standard marketplace sorting only"}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() =>
                    setDraft((d) => (d ? { ...d, enabled: !d.enabled } : d))
                  }
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                    draft.enabled ? "bg-emerald-500" : "bg-gray-300"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                      draft.enabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </Card>

            {/* Scoring Weights */}
            <SectionCard
              title="Scoring Weights"
              subtitle={`Total: ${weightsTotal} points (recommended ~100)`}
            >
              {weightsTotal > 120 ? (
                <div className="flex items-start gap-2 mb-3 p-3 rounded-2xl border border-amber-200 bg-amber-50">
                  <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">
                    Total weight is high ({weightsTotal}). Scores above 100 are capped.
                    Consider keeping the total around 100 for balanced results.
                  </p>
                </div>
              ) : null}

              <div className="space-y-4">
                {WEIGHT_FIELDS.map((field) => {
                  const Icon = field.icon;
                  const value = draft.weights[field.key];

                  return (
                    <div key={field.key}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-gray-500" />
                          <span className="text-sm font-semibold text-gray-900">
                            {field.label}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-gray-900">
                          {value}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mb-2">{field.hint}</p>

                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={0}
                          max={field.max}
                          step={1}
                          value={value}
                          onChange={(e) =>
                            setDraft((d) =>
                              d
                                ? {
                                    ...d,
                                    weights: {
                                      ...d.weights,
                                      [field.key]: Number(e.target.value),
                                    },
                                  }
                                : d
                            )
                          }
                          className="flex-1 h-2 rounded-full appearance-none bg-gray-200 accent-orange-500"
                        />
                        <Input
                          inputMode="numeric"
                          value={String(value)}
                          onChange={(e) => {
                            const n = Math.max(
                              0,
                              Math.min(field.max, Math.floor(Number(e.target.value) || 0))
                            );
                            setDraft((d) =>
                              d
                                ? {
                                    ...d,
                                    weights: { ...d.weights, [field.key]: n },
                                  }
                                : d
                            );
                          }}
                          className="w-16 text-center"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            {/* Advanced Settings */}
            <SectionCard title="Advanced" subtitle="Fine-tune scoring behavior">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Hide threshold (0–100)
                  </label>
                  <p className="text-[11px] text-gray-400 mb-1.5">
                    Products below this score are hidden unless explicitly searched.
                    Set to 0 to show everything.
                  </p>
                  <Input
                    inputMode="numeric"
                    value={String(draft.hideThreshold)}
                    onChange={(e) =>
                      setDraft((d) =>
                        d
                          ? {
                              ...d,
                              hideThreshold: Math.max(
                                0,
                                Math.min(100, Math.floor(Number(e.target.value) || 0))
                              ),
                            }
                          : d
                      )
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Premium bonus points (0–20)
                  </label>
                  <p className="text-[11px] text-gray-400 mb-1.5">
                    Extra points for paid vendors. Cannot push total above 100.
                    Only applies if base score ≥ minimum below.
                  </p>
                  <Input
                    inputMode="numeric"
                    value={String(draft.premiumBonus)}
                    onChange={(e) =>
                      setDraft((d) =>
                        d
                          ? {
                              ...d,
                              premiumBonus: Math.max(
                                0,
                                Math.min(20, Math.floor(Number(e.target.value) || 0))
                              ),
                            }
                          : d
                      )
                    }
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Premium minimum score (0–100)
                  </label>
                  <p className="text-[11px] text-gray-400 mb-1.5">
                    Premium bonus only applies if vendor's base score is at least this
                    value. Prevents pay-to-win for bad vendors.
                  </p>
                  <Input
                    inputMode="numeric"
                    value={String(draft.premiumMinScore)}
                    onChange={(e) =>
                      setDraft((d) =>
                        d
                          ? {
                              ...d,
                              premiumMinScore: Math.max(
                                0,
                                Math.min(100, Math.floor(Number(e.target.value) || 0))
                              ),
                            }
                          : d
                      )
                    }
                  />
                </div>
              </div>
            </SectionCard>

            {/* Save button */}
            <Card className="p-4">
              <Button onClick={saveConfig} loading={saving} disabled={saving || !hasUnsaved}>
                <Sliders className="h-4 w-4 mr-1.5" />
                {hasUnsaved ? "Save changes" : "No changes"}
              </Button>
            </Card>

            {/* Compute profiles */}
            <SectionCard
              title="Compute Vendor Profiles"
              subtitle="Recalculate reliability scores from order data"
            >
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Single vendor (optional)
                  </label>
                  <Input
                    placeholder="Business ID (leave empty for bulk)"
                    value={singleBusinessId}
                    onChange={(e) => setSingleBusinessId(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => runCompute(singleBusinessId || undefined)}
                    loading={computing}
                    disabled={computing}
                  >
                    <Zap className="h-4 w-4 mr-1.5" />
                    {singleBusinessId.trim()
                      ? "Compute single"
                      : "Compute ALL"}
                  </Button>

                  {singleBusinessId.trim() ? (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setSingleBusinessId("");
                      }}
                    >
                      Clear
                    </Button>
                  ) : null}
                </div>

                {!singleBusinessId.trim() ? (
                  <p className="text-[11px] text-gray-400">
                    Bulk compute will process all vendors. This may take a moment
                    for large platforms.
                  </p>
                ) : null}

                {/* Compute result */}
                {computeResult ? (
                  <div className="rounded-2xl border border-gray-100 bg-white p-3">
                    {computeResult.ok ? (
                      <>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <p className="text-sm font-semibold text-emerald-700">
                            {computeResult.mode === "single"
                              ? "Profile computed"
                              : `${computeResult.computed} computed, ${computeResult.failed} failed`}
                          </p>
                        </div>

                        {computeResult.errors && computeResult.errors.length > 0 ? (
                          <div className="mt-2 space-y-1 max-h-32 overflow-y-auto">
                            {computeResult.errors.map((err, idx) => (
                              <p
                                key={idx}
                                className="text-[11px] text-red-600 font-mono"
                              >
                                {err}
                              </p>
                            ))}
                          </div>
                        ) : null}

                        {computeResult.profile ? (
                          <div className="mt-2">
                            <p className="text-[11px] text-gray-500 font-mono break-all">
                              {JSON.stringify(computeResult.profile, null, 2).slice(0, 500)}
                            </p>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-red-500" />
                        <p className="text-sm font-semibold text-red-700">
                          {computeResult.error || "Failed"}
                        </p>
                      </div>
                    )}
                  </div>
                ) : null}
              </div>
            </SectionCard>

            {/* Flag vendor */}
            <SectionCard
              title="Flag Vendor"
              subtitle="Flag vendors exploiting the Smart Match system"
            >
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Business ID
                  </label>
                  <Input
                    placeholder="Enter business document ID"
                    value={flagBusinessId}
                    onChange={(e) => setFlagBusinessId(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Action
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setFlagAction("flag")}
                      className={`rounded-2xl border p-3 text-sm font-bold transition ${
                        flagAction === "flag"
                          ? "border-red-300 bg-red-50 text-red-700"
                          : "border-gray-100 bg-white text-gray-700"
                      }`}
                    >
                      <Flag className="h-4 w-4 inline mr-1.5" />
                      Flag
                    </button>
                    <button
                      onClick={() => setFlagAction("unflag")}
                      className={`rounded-2xl border p-3 text-sm font-bold transition ${
                        flagAction === "unflag"
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                          : "border-gray-100 bg-white text-gray-700"
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4 inline mr-1.5" />
                      Unflag
                    </button>
                  </div>
                </div>

                {flagAction === "flag" ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Reason (optional)
                    </label>
                    <Input
                      placeholder="Why are you flagging this vendor?"
                      value={flagReason}
                      onChange={(e) => setFlagReason(e.target.value)}
                    />
                  </div>
                ) : null}

                <Button
                  variant="secondary"
                  onClick={flagVendor}
                  loading={flagging}
                  disabled={flagging || !flagBusinessId.trim()}
                >
                  <Flag className="h-4 w-4 mr-1.5" />
                  {flagAction === "flag" ? "Flag vendor" : "Remove flag"}
                </Button>
              </div>
            </SectionCard>

            {/* Info */}
            <Card className="p-4">
              <p className="text-xs text-gray-500 leading-relaxed">
                <span className="font-semibold text-gray-700">How it works:</span>{" "}
                Vendor profiles are computed from order fulfillment data, disputes,
                verification status, and stock accuracy. Profiles are cached for{" "}
                {Math.round((draft.profileCacheTtlMs || 0) / 60000)} minutes.
                Match scores are computed per-buyer at query time using the weights
                above. Set <code className="text-orange-600">NEXT_PUBLIC_SMARTMATCH_ENABLED=true</code> in
                your environment to enable the feature for all users.
              </p>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}