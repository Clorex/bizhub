// FILE: src/app/admin/packages/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { auth } from "@/lib/firebase/client";

type PlanKey = "FREE" | "LAUNCH" | "MOMENTUM" | "APEX";

function safeNum(v: any, fallback = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return n;
}

export default function AdminPackagesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [cfg, setCfg] = useState<any>(null);

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
      const j = await api("/api/admin/plan-config");
      setCfg(j.config);
    } catch (e: any) {
      setMsg(e?.message || "Failed");
      setCfg(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const plans: PlanKey[] = ["FREE", "LAUNCH", "MOMENTUM", "APEX"];

  const canSave = useMemo(() => !!cfg?.plans, [cfg]);

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setMsg(null);
    try {
      await api("/api/admin/plan-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plans: cfg.plans }),
      });
      setMsg("Saved.");
    } catch (e: any) {
      setMsg(e?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  function setFeature(plan: PlanKey, key: string, value: boolean) {
    setCfg((prev: any) => ({
      ...prev,
      plans: {
        ...(prev?.plans || {}),
        [plan]: {
          ...(prev?.plans?.[plan] || {}),
          features: {
            ...(prev?.plans?.[plan]?.features || {}),
            [key]: value,
          },
        },
      },
    }));
  }

  function setLimit(plan: PlanKey, key: string, value: number) {
    setCfg((prev: any) => ({
      ...prev,
      plans: {
        ...(prev?.plans || {}),
        [plan]: {
          ...(prev?.plans?.[plan] || {}),
          limits: {
            ...(prev?.plans?.[plan]?.limits || {}),
            [key]: value,
          },
        },
      },
    }));
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="Packages" subtitle="Edit features & limits (no code)" showBack={true} />

      <div className="px-4 pb-24 space-y-3">
        {loading ? <Card className="p-4">Loading…</Card> : null}
        {msg ? <Card className="p-4">{msg}</Card> : null}

        {!loading && cfg ? (
          <>
            {plans.map((p) => {
              const f = cfg?.plans?.[p]?.features || {};
              const l = cfg?.plans?.[p]?.limits || {};

              return (
                <Card key={p} className="p-4 space-y-3">
                  <p className="text-sm font-bold text-biz-ink">{p}</p>

                  <div className="rounded-2xl border border-biz-line bg-white p-3">
                    <p className="text-xs font-bold text-gray-500">FEATURES</p>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Toggle label="Marketplace" value={!!f.marketplace} onClick={(v) => setFeature(p, "marketplace", v)} />
                      <Toggle label="Store customization" value={!!f.storeCustomize} onClick={(v) => setFeature(p, "storeCustomize", v)} />
                      <Toggle label="Continue in Chat" value={!!f.continueInChat} onClick={(v) => setFeature(p, "continueInChat", v)} />
                      <Toggle label="Coupons" value={!!f.coupons} onClick={(v) => setFeature(p, "coupons", v)} />
                      <Toggle label="Assistant" value={!!f.assistant} onClick={(v) => setFeature(p, "assistant", v)} />
                      <Toggle label="Re‑engagement" value={!!f.reengagement} onClick={(v) => setFeature(p, "reengagement", v)} />
                      <Toggle label="Staff" value={!!f.staff} onClick={(v) => setFeature(p, "staff", v)} />
                      <Toggle label="Promotions" value={!!f.promotions} onClick={(v) => setFeature(p, "promotions", v)} />
                      <Toggle label="Month analytics" value={!!f.monthAnalytics} onClick={(v) => setFeature(p, "monthAnalytics", v)} />
                    </div>

                    <p className="mt-3 text-[11px] text-biz-muted">
                      Tip: keep FREE usable, but restrict important growth tools.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-biz-line bg-white p-3">
                    <p className="text-xs font-bold text-gray-500">LIMITS</p>

                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <LimitInput label="Max products" value={safeNum(l.maxProducts, 0)} onChange={(n) => setLimit(p, "maxProducts", n)} />
                      <LimitInput label="Orders visible" value={safeNum(l.ordersVisible, 0)} onChange={(n) => setLimit(p, "ordersVisible", n)} />
                      <LimitInput label="Re‑engagement/day" value={safeNum(l.reengagementDaily, 0)} onChange={(n) => setLimit(p, "reengagementDaily", n)} />
                      <LimitInput label="Chat orders/day" value={safeNum(l.chatOrdersDaily, 0)} onChange={(n) => setLimit(p, "chatOrdersDaily", n)} />
                      <LimitInput label="Staff max" value={safeNum(l.staffMax, 0)} onChange={(n) => setLimit(p, "staffMax", n)} />
                      <LimitInput label="Coupons max" value={safeNum(l.couponsMax, 0)} onChange={(n) => setLimit(p, "couponsMax", n)} />
                      <LimitInput label="Shipping options max" value={safeNum(l.shippingOptionsMax, 0)} onChange={(n) => setLimit(p, "shippingOptionsMax", n)} />
                      <LimitInput label="Promotions max active" value={safeNum(l.promotionsMaxActive, 0)} onChange={(n) => setLimit(p, "promotionsMaxActive", n)} />
                    </div>
                  </div>
                </Card>
              );
            })}

            <Card className="p-4 space-y-2">
              <Button onClick={save} loading={saving} disabled={saving || !canSave}>
                Save changes
              </Button>
              <Button variant="secondary" onClick={load} disabled={saving}>
                Refresh
              </Button>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}

function Toggle({ label, value, onClick }: { label: string; value: boolean; onClick: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onClick(!value)}
      className="rounded-2xl border border-biz-line bg-white p-3 flex items-center justify-between hover:bg-black/[0.02] transition"
    >
      <span className="text-xs font-bold text-biz-ink">{label}</span>
      <span
        className={
          value
            ? "px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100"
            : "px-3 py-1 rounded-full text-[11px] font-bold bg-orange-50 text-orange-700 border border-orange-100"
        }
      >
        {value ? "ON" : "OFF"}
      </span>
    </button>
  );
}

function LimitInput({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="rounded-2xl border border-biz-line bg-white p-3">
      <p className="text-[11px] text-gray-500">{label}</p>
      <Input
        type="number"
        value={String(value)}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2"
      />
    </div>
  );
}