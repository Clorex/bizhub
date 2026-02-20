// FILE: src/app/vendor/restock/settings/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { auth } from "@/lib/firebase/client";
import { toast } from "@/lib/ui/toast";
import { cn } from "@/lib/cn";
import { Loader2, Save } from "lucide-react";
import type { RestockAlertConfig } from "@/types/restock";
import { DEFAULT_RESTOCK_CONFIG } from "@/types/restock";

export default function RestockSettingsPage() {
  const router = useRouter();
  const [config, setConfig] = useState<RestockAlertConfig>(DEFAULT_RESTOCK_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const res = await fetch("/api/vendor/restock/config", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));

      if (res.status === 403) {
        router.replace("/vendor/restock");
        return;
      }

      if (json.ok && json.config) {
        setConfig(json.config);
      }
    } catch {
      setError("Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const res = await fetch("/api/vendor/restock/config", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(config),
      });
      const json = await res.json().catch(() => ({}));

      if (json.ok) {
        toast.success("Settings saved!");
        if (json.config) setConfig(json.config);
      } else {
        toast.error(json.error || "Save failed.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <GradientHeader title="Restock Settings" showBack={true} />
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 bg-gray-50">
      <GradientHeader
        title="Restock Settings"
        subtitle="Configure your alert preferences"
        showBack={true}
      />

      <div className="px-4 space-y-4 pt-4">
        {error && (
          <Card className="p-4 bg-red-50 border-red-200">
            <p className="text-sm text-red-800">{error}</p>
          </Card>
        )}

        <SectionCard title="General" subtitle="Enable or disable restock alerts">
          <div className="space-y-4">
            <ToggleRow
              label="Enable Smart Restock Alerts"
              description="Get notified about stock and demand changes"
              value={config.enabled}
              onChange={(v) => setConfig({ ...config, enabled: v })}
            />
            <ToggleRow
              label="Email Alerts"
              description="Also send alerts to your email"
              value={config.email_alerts_enabled}
              onChange={(v) =>
                setConfig({ ...config, email_alerts_enabled: v })
              }
            />
          </div>
        </SectionCard>

        <SectionCard
          title="Thresholds"
          subtitle="Control when alerts are triggered"
        >
          <div className="space-y-4">
            <NumberField
              label="Demand Rising Threshold"
              description="% growth to trigger 'Demand Rising' alert"
              value={config.growth_threshold_pct}
              onChange={(v) =>
                setConfig({ ...config, growth_threshold_pct: v })
              }
              min={10}
              max={300}
              suffix="%"
            />
            <NumberField
              label="Demand Spike Threshold"
              description="% growth to trigger 'Demand Spike' alert"
              value={config.spike_threshold_pct}
              onChange={(v) =>
                setConfig({ ...config, spike_threshold_pct: v })
              }
              min={50}
              max={500}
              suffix="%"
            />
            <NumberField
              label="Stockout Warning Days"
              description="Alert when stock may last this many days"
              value={config.stockout_warn_days}
              onChange={(v) =>
                setConfig({ ...config, stockout_warn_days: v })
              }
              min={1}
              max={30}
              suffix=" days"
            />
            <NumberField
              label="Stockout Urgent Days"
              description="Urgent alert when stock may last this many days"
              value={config.stockout_urgent_days}
              onChange={(v) =>
                setConfig({ ...config, stockout_urgent_days: v })
              }
              min={1}
              max={14}
              suffix=" days"
            />
            <NumberField
              label="Alert Cooldown"
              description="Minimum hours between repeat alerts per product"
              value={config.alert_cooldown_hours}
              onChange={(v) =>
                setConfig({ ...config, alert_cooldown_hours: v })
              }
              min={6}
              max={168}
              suffix=" hours"
            />
          </div>
        </SectionCard>

        <Button
          onClick={save}
          loading={saving}
          className="w-full"
          leftIcon={<Save className="w-4 h-4" />}
        >
          Save Settings
        </Button>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-bold text-gray-900">{label}</p>
        <p className="text-xs text-gray-500 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={cn(
          "w-12 h-7 rounded-full transition-colors relative shrink-0",
          value ? "bg-orange-500" : "bg-gray-300"
        )}
        role="switch"
        aria-checked={value}
      >
        <span
          className={cn(
            "absolute top-1 w-5 h-5 rounded-full bg-white shadow transition-transform",
            value ? "left-6" : "left-1"
          )}
        />
      </button>
    </div>
  );
}

function NumberField({
  label,
  description,
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  suffix: string;
}) {
  return (
    <div>
      <p className="text-sm font-bold text-gray-900">{label}</p>
      <p className="text-xs text-gray-500 mt-0.5 mb-2">{description}</p>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="flex-1 accent-orange-500"
        />
        <span className="text-sm font-bold text-gray-900 w-20 text-right">
          {value}
          {suffix}
        </span>
      </div>
    </div>
  );
}
