// FILE: src/app/admin/smartmatch/page-client.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { auth } from "@/lib/firebase/client";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { AlertCircle, CheckCircle2, RefreshCw } from "lucide-react";

type WeightsState = {
  categoryMatch: number;
  locationProximity: number;
  reliabilityScore: number;
  activityScore: number;
  customerRatingScore: number;
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

type Toast = { text: string; type: "success" | "error" } | null;

export default function AdminSmartMatchPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [computing, setComputing] = useState(false);
  const [flagging, setFlagging] = useState(false);

  const [config, setConfig] = useState<ConfigState | null>(null);
  const [draft, setDraft] = useState<ConfigState | null>(null);
  const [toast, setToast] = useState<Toast>(null);

  const [singleBusinessId, setSingleBusinessId] = useState("");

  const [flagBusinessId, setFlagBusinessId] = useState("");
  const [flagReason, setFlagReason] = useState("");
  const [flagAction, setFlagAction] = useState<"flag" | "unflag">("flag");

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const weightsTotal = useMemo(() => {
    if (!draft) return 0;
    const w = draft.weights;
    return (
      Number(w.categoryMatch || 0) +
      Number(w.locationProximity || 0) +
      Number(w.reliabilityScore || 0) +
      Number(w.activityScore || 0) +
      Number(w.customerRatingScore || 0)
    );
  }, [draft]);

  function setWeight<K extends keyof WeightsState>(key: K, value: number) {
    setDraft((prev) => {
      if (!prev) return prev;
      return { ...prev, weights: { ...prev.weights, [key]: value } };
    });
  }

  async function saveConfig() {
    if (!draft) return;
    setSaving(true);
    setToast(null);
    try {
      if (weightsTotal !== 100) {
        throw new Error(`Weights must sum to 100. Current sum = ${weightsTotal}.`);
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
      } else {
        throw new Error(data?.error || "Failed to save");
      }
    } catch (e: any) {
      setToast({ text: e?.message || "Failed to save", type: "error" });
    } finally {
      setSaving(false);
    }
  }

  async function runCompute(businessId?: string) {
    setComputing(true);
    setToast(null);
    try {
      const body: any = {};
      if (businessId?.trim()) body.businessId = businessId.trim();

      const data = await authedFetch("/api/admin/smartmatch/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (data?.ok) {
        setToast({
          text:
            data.mode === "single"
              ? `Computed profile for ${data.businessId}`
              : `Computed ${data.computed} profiles (${data.failed} failed)`,
          type: "success",
        });
      } else {
        throw new Error(data?.error || "Compute failed");
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
      } else {
        throw new Error(data?.error || "Flag failed");
      }
    } catch (e: any) {
      setToast({ text: e?.message || "Flag failed", type: "error" });
    } finally {
      setFlagging(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <GradientHeader title="Smart Match" subtitle="Control scoring weights and vendor profiles" />

      <div className="mx-auto max-w-3xl p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="secondary" onClick={loadConfig} loading={loading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>

          <div className="text-sm text-gray-600">
            Weights total: <span className={weightsTotal === 100 ? "text-emerald-700 font-semibold" : "text-red-600 font-semibold"}>{weightsTotal}</span>
          </div>
        </div>

        {toast ? (
          <Card className="p-3">
            <div className={`flex items-start gap-2 text-sm ${toast.type === "success" ? "text-emerald-700" : "text-red-700"}`}>
              {toast.type === "success" ? <CheckCircle2 className="h-4 w-4 mt-0.5" /> : <AlertCircle className="h-4 w-4 mt-0.5" />}
              <div>{toast.text}</div>
            </div>
          </Card>
        ) : null}

        {!draft ? (
          <Card className="p-4 text-sm text-gray-600">Loading config…</Card>
        ) : (
          <>
            <SectionCard title="Smart Match Toggle">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm text-gray-700">
                  Enabled: <span className="font-semibold">{draft.enabled ? "Yes" : "No"}</span>
                </div>
                <Button
                  variant="secondary"
                  onClick={() => setDraft({ ...draft, enabled: !draft.enabled })}
                >
                  Toggle
                </Button>
              </div>
            </SectionCard>

            <SectionCard title="Spec Weights (must sum to 100)">
              <div className="grid grid-cols-1 gap-3">
                <Row label="Category Match (30%)">
                  <Input type="number" value={draft.weights.categoryMatch} onChange={(e) => setWeight("categoryMatch", Number(e.target.value))} />
                </Row>

                <Row label="Location Proximity (20%)">
                  <Input type="number" value={draft.weights.locationProximity} onChange={(e) => setWeight("locationProximity", Number(e.target.value))} />
                </Row>

                <Row label="Reliability Score (20%)">
                  <Input type="number" value={draft.weights.reliabilityScore} onChange={(e) => setWeight("reliabilityScore", Number(e.target.value))} />
                </Row>

                <Row label="Activity Score (15%)">
                  <Input type="number" value={draft.weights.activityScore} onChange={(e) => setWeight("activityScore", Number(e.target.value))} />
                </Row>

                <Row label="Customer Rating Score (15%)">
                  <Input type="number" value={draft.weights.customerRatingScore} onChange={(e) => setWeight("customerRatingScore", Number(e.target.value))} />
                </Row>
              </div>

              <div className="mt-4 flex gap-2">
                <Button onClick={saveConfig} loading={saving} disabled={saving || weightsTotal !== 100}>
                  Save Config
                </Button>
              </div>
            </SectionCard>

            <SectionCard title="Thresholds / Caching">
              <div className="grid grid-cols-1 gap-3">
                <Row label="Hide Threshold (0–100)">
                  <Input type="number" value={draft.hideThreshold} onChange={(e) => setDraft({ ...draft, hideThreshold: Number(e.target.value) })} />
                </Row>

                <Row label="Premium Bonus (0–20)">
                  <Input type="number" value={draft.premiumBonus} onChange={(e) => setDraft({ ...draft, premiumBonus: Number(e.target.value) })} />
                </Row>

                <Row label="Premium Min Score (0–100)">
                  <Input type="number" value={draft.premiumMinScore} onChange={(e) => setDraft({ ...draft, premiumMinScore: Number(e.target.value) })} />
                </Row>

                <Row label="Profile Cache TTL (ms)">
                  <Input type="number" value={draft.profileCacheTtlMs} onChange={(e) => setDraft({ ...draft, profileCacheTtlMs: Number(e.target.value) })} />
                </Row>

                <Row label="Score Cache TTL (ms)">
                  <Input type="number" value={draft.scoreCacheTtlMs} onChange={(e) => setDraft({ ...draft, scoreCacheTtlMs: Number(e.target.value) })} />
                </Row>
              </div>

              <div className="mt-4">
                <Button variant="secondary" onClick={saveConfig} loading={saving} disabled={saving}>
                  Save Thresholds / TTL
                </Button>
              </div>
            </SectionCard>

            <SectionCard title="Compute Vendor Profiles (Admin)">
              <div className="space-y-3">
                <Button variant="secondary" onClick={() => runCompute()} loading={computing} disabled={computing}>
                  Compute ALL vendor profiles
                </Button>

                <div className="flex gap-2">
                  <Input
                    placeholder="Business ID (optional)"
                    value={singleBusinessId}
                    onChange={(e) => setSingleBusinessId(e.target.value)}
                  />
                  <Button onClick={() => runCompute(singleBusinessId)} loading={computing} disabled={computing || !singleBusinessId.trim()}>
                    Compute single
                  </Button>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Flag / Unflag Vendor (Anti-abuse)">
              <div className="space-y-3">
                <div className="flex gap-2">
                  <Input
                    placeholder="Business ID"
                    value={flagBusinessId}
                    onChange={(e) => setFlagBusinessId(e.target.value)}
                  />
                  <Button variant="secondary" onClick={() => setFlagAction("flag")} disabled={flagAction === "flag"}>
                    Flag
                  </Button>
                  <Button variant="secondary" onClick={() => setFlagAction("unflag")} disabled={flagAction === "unflag"}>
                    Unflag
                  </Button>
                </div>

                {flagAction === "flag" ? (
                  <Input
                    placeholder="Reason (optional)"
                    value={flagReason}
                    onChange={(e) => setFlagReason(e.target.value)}
                  />
                ) : null}

                <Button variant="secondary" onClick={flagVendor} loading={flagging} disabled={flagging || !flagBusinessId.trim()}>
                  {flagAction === "flag" ? "Flag vendor" : "Remove flag"}
                </Button>
              </div>
            </SectionCard>

            <Card className="p-4 text-xs text-gray-600">
              Smart Match now follows your spec formula (category, location, reliability, activity, rating).
              Non-matching categories are excluded from ranking.
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function Row(props: { label: string; children: any }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-sm text-gray-700">{props.label}</div>
      <div className="w-40">{props.children}</div>
    </div>
  );
}
