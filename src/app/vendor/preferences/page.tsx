"use client";

import { useEffect, useMemo, useState } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";

type VendorPrefs = {
  notificationsOrders: boolean;
  notificationsPayments: boolean;
  notificationsTips: boolean;

  defaultMarketEnabled: boolean;
  openWhatsAppInNewTab: boolean;

  reduceDataUsage: boolean;
};

const KEY = "bizhub_vendor_prefs_v1";

function loadPrefs(): VendorPrefs {
  const fallback: VendorPrefs = {
    notificationsOrders: true,
    notificationsPayments: true,
    notificationsTips: true,

    defaultMarketEnabled: true,
    openWhatsAppInNewTab: true,

    reduceDataUsage: false,
  };

  if (typeof window === "undefined") return fallback;

  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback;

    const v = JSON.parse(raw);
    return {
      notificationsOrders: typeof v?.notificationsOrders === "boolean" ? v.notificationsOrders : fallback.notificationsOrders,
      notificationsPayments: typeof v?.notificationsPayments === "boolean" ? v.notificationsPayments : fallback.notificationsPayments,
      notificationsTips: typeof v?.notificationsTips === "boolean" ? v.notificationsTips : fallback.notificationsTips,

      defaultMarketEnabled: typeof v?.defaultMarketEnabled === "boolean" ? v.defaultMarketEnabled : fallback.defaultMarketEnabled,
      openWhatsAppInNewTab: typeof v?.openWhatsAppInNewTab === "boolean" ? v.openWhatsAppInNewTab : fallback.openWhatsAppInNewTab,

      reduceDataUsage: typeof v?.reduceDataUsage === "boolean" ? v.reduceDataUsage : fallback.reduceDataUsage,
    };
  } catch {
    return fallback;
  }
}

function savePrefs(p: VendorPrefs) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(p));
}

function ToggleRow({
  title,
  subtitle,
  value,
  onChange,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="w-full text-left rounded-2xl border border-biz-line bg-white p-4 hover:bg-black/[0.02] transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-biz-ink">{title}</p>
          <p className="text-xs text-biz-muted mt-1">{subtitle}</p>
        </div>

        <span
          className={
            value
              ? "px-3 py-1 rounded-full text-[11px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-100"
              : "px-3 py-1 rounded-full text-[11px] font-extrabold bg-orange-50 text-orange-700 border border-orange-100"
          }
        >
          {value ? "ON" : "OFF"}
        </span>
      </div>
    </button>
  );
}

export default function VendorPreferencesPage() {
  const [prefs, setPrefs] = useState<VendorPrefs>(() => loadPrefs());
  const [msg, setMsg] = useState<string | null>(null);

  // auto-save (debounced)
  useEffect(() => {
    const t = setTimeout(() => {
      savePrefs(prefs);
      setMsg("Saved.");
      setTimeout(() => setMsg(null), 1200);
    }, 250);
    return () => clearTimeout(t);
  }, [prefs]);

  const summary = useMemo(() => {
    const onCount = Object.values(prefs).filter(Boolean).length;
    return `${onCount} setting(s) enabled`;
  }, [prefs]);

  function reset() {
    const ok = confirm("Reset preferences to default?");
    if (!ok) return;
    const next = loadPrefs();
    setPrefs(next);
    setMsg("Reset done.");
    setTimeout(() => setMsg(null), 1200);
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="Preferences" subtitle="Control how BizHub works for you" showBack={true} />

      <div className="px-4 pb-24 space-y-3">
        {msg ? <Card className="p-4 text-emerald-700">{msg}</Card> : null}

        <Card className="p-4">
          <p className="text-sm font-extrabold text-biz-ink">Overview</p>
          <p className="text-xs text-biz-muted mt-1">{summary}</p>
          <p className="text-[11px] text-biz-muted mt-2">
            These settings are saved on this device.
          </p>
        </Card>

        <Card className="p-4 space-y-2">
          <p className="text-sm font-extrabold text-biz-ink">Notifications</p>

          <ToggleRow
            title="Order updates"
            subtitle="Get alerts for new orders and important order changes."
            value={prefs.notificationsOrders}
            onChange={(v) => setPrefs((p) => ({ ...p, notificationsOrders: v }))}
          />

          <ToggleRow
            title="Payment updates"
            subtitle="Get alerts when payments are confirmed or need attention."
            value={prefs.notificationsPayments}
            onChange={(v) => setPrefs((p) => ({ ...p, notificationsPayments: v }))}
          />

          <ToggleRow
            title="Tips to sell better"
            subtitle="Short suggestions to help you improve views and sales."
            value={prefs.notificationsTips}
            onChange={(v) => setPrefs((p) => ({ ...p, notificationsTips: v }))}
          />
        </Card>

        <Card className="p-4 space-y-2">
          <p className="text-sm font-extrabold text-biz-ink">Selling defaults</p>

          <ToggleRow
            title="Show new products on Market by default"
            subtitle="If OFF, you can still turn Market ON per product."
            value={prefs.defaultMarketEnabled}
            onChange={(v) => setPrefs((p) => ({ ...p, defaultMarketEnabled: v }))}
          />

          <ToggleRow
            title="Open WhatsApp in a new tab"
            subtitle="Keeps BizHub open while you chat with customers."
            value={prefs.openWhatsAppInNewTab}
            onChange={(v) => setPrefs((p) => ({ ...p, openWhatsAppInNewTab: v }))}
          />
        </Card>

        <Card className="p-4 space-y-2">
          <p className="text-sm font-extrabold text-biz-ink">Data & speed</p>

          <ToggleRow
            title="Use less data"
            subtitle="Loads fewer heavy items when your network is slow."
            value={prefs.reduceDataUsage}
            onChange={(v) => setPrefs((p) => ({ ...p, reduceDataUsage: v }))}
          />

          <p className="text-[11px] text-biz-muted mt-2">
            Tip: If your phone is slow, turn this ON.
          </p>
        </Card>

        <Card className="p-4">
          <Button variant="secondary" onClick={reset}>
            Reset preferences
          </Button>
        </Card>
      </div>
    </div>
  );
}