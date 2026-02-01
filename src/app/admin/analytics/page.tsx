"use client";

import { useEffect, useMemo, useState } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SectionCard } from "@/components/ui/SectionCard";
import { auth } from "@/lib/firebase/client";
import { RefreshCw } from "lucide-react";

type Range = "today" | "week" | "month";
type Metric = "visits" | "leads" | "views";

function fmtNaira(n: number) {
  try {
    return `₦${Number(n || 0).toLocaleString()}`;
  } catch {
    return `₦${n}`;
  }
}

function pctText(v: any) {
  if (v == null) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  const s = n >= 0 ? "+" : "";
  return `${s}${n.toFixed(1)}%`;
}

function diffText(v: any) {
  if (v == null) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  const s = n >= 0 ? "+" : "";
  return `${s}${n.toLocaleString()}`;
}

export default function AdminPlatformAnalyticsPage() {
  const [range, setRange] = useState<Range>("week");
  const [metric, setMetric] = useState<Metric>("views");

  // Month history picker (YYYY-MM)
  const [month, setMonth] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [data, setData] = useState<any>(null);

  async function api(path: string) {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(path, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j?.error || "Request failed");
    return j;
  }

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const qs =
        range === "month" && month
          ? `?range=month&month=${encodeURIComponent(month)}`
          : `?range=${encodeURIComponent(range)}`;

      const j = await api(`/api/admin/analytics/platform${qs}`);
      setData(j);
    } catch (e: any) {
      setMsg(e?.message || "Failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const totals = data?.totals || {};
  const deltas = data?.deltas || null;
  const series: any[] = Array.isArray(data?.series) ? data.series : [];

  const maxMetric = useMemo(() => {
    return Math.max(1, ...series.map((d) => Number(d?.[metric] || 0)));
  }, [series, metric]);

  return (
    <div className="min-h-screen">
      <GradientHeader
        title="Admin Analytics"
        subtitle="Platform performance (daily tracking)"
        showBack={true}
        right={
          <Button
            variant="secondary"
            size="sm"
            onClick={load}
            leftIcon={<RefreshCw className="h-4 w-4" />}
            disabled={loading}
          >
            Refresh
          </Button>
        }
      />

      <div className="px-4 pb-24 space-y-3">
        <SegmentedControl<Range>
          value={range}
          onChange={setRange}
          options={[
            { value: "today", label: "Today" },
            { value: "week", label: "Week" },
            { value: "month", label: "Month" },
          ]}
        />

        {/* Month history selection */}
        <Card className="p-4">
          <p className="text-sm font-bold text-biz-ink">Month history</p>
          <p className="text-xs text-biz-muted mt-1">
            Choose a past month to recover old analysis (works best with tracking).
          </p>

          <div className="mt-3 flex items-center gap-2">
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="flex-1 rounded-2xl border border-biz-line bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-biz-accent/30"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                // only meaningful when range=month
                setRange("month");
                setTimeout(load, 0);
              }}
              disabled={!month}
            >
              Load
            </Button>
          </div>

          <p className="mt-2 text-[11px] text-biz-muted">
            Tip: Use Month view to compare growth patterns and spot declines.
          </p>
        </Card>

        {loading ? <Card className="p-4">Loading…</Card> : null}
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}

        {!loading && data ? (
          <>
            {/* Hero */}
            <div className="rounded-[26px] p-4 text-white shadow-float bg-gradient-to-br from-biz-accent2 to-biz-accent">
              <p className="text-xs opacity-95">Platform summary</p>
              <p className="text-xl font-bold mt-1">
                {totals.orders?.toLocaleString?.() || 0} order(s) • {fmtNaira(totals.revenue || 0)}
              </p>
              <p className="text-[11px] opacity-95 mt-2">
                Visits: <b>{Number(totals.visits || 0).toLocaleString()}</b> • Leads:{" "}
                <b>{Number(totals.leads || 0).toLocaleString()}</b> • Views:{" "}
                <b>{Number(totals.views || 0).toLocaleString()}</b>
              </p>
            </div>

            {/* Daily change */}
            <SectionCard title="Daily change" subtitle="Today vs yesterday (traffic)">
              {deltas ? (
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="rounded-2xl border border-biz-line bg-white p-3">
                    <p className="text-biz-muted">Visits</p>
                    <p className="font-bold text-biz-ink mt-1">{diffText(deltas.visits?.diff)}</p>
                    <p className="text-[11px] text-gray-500 mt-1">{pctText(deltas.visits?.pct)}</p>
                  </div>
                  <div className="rounded-2xl border border-biz-line bg-white p-3">
                    <p className="text-biz-muted">Leads</p>
                    <p className="font-bold text-biz-ink mt-1">{diffText(deltas.leads?.diff)}</p>
                    <p className="text-[11px] text-gray-500 mt-1">{pctText(deltas.leads?.pct)}</p>
                  </div>
                  <div className="rounded-2xl border border-biz-line bg-white p-3">
                    <p className="text-biz-muted">Views</p>
                    <p className="font-bold text-biz-ink mt-1">{diffText(deltas.views?.diff)}</p>
                    <p className="text-[11px] text-gray-500 mt-1">{pctText(deltas.views?.pct)}</p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-biz-muted">Not enough data yet (need at least 2 days).</p>
              )}
            </SectionCard>

            {/* Metric chart */}
            <SectionCard
              title="Daily chart"
              subtitle="Shows trend — use this to spot decline/increase"
              right={
                <select
                  value={metric}
                  onChange={(e) => setMetric(e.target.value as Metric)}
                  className="rounded-2xl border border-biz-line bg-white px-3 py-2 text-xs font-bold"
                >
                  <option value="views">Views</option>
                  <option value="leads">Leads</option>
                  <option value="visits">Visits</option>
                </select>
              }
            >
              <div className="flex items-end gap-2 h-28">
                {series.slice(-31).map((d) => {
                  const v = Number(d?.[metric] || 0);
                  const h = Math.max(6, Math.round((v / maxMetric) * 100));
                  const label = String(d.dayKey || "").slice(8, 10);
                  return (
                    <div key={d.dayKey} className="flex-1 flex flex-col items-center justify-end gap-2">
                      <div
                        className="w-full rounded-xl bg-gradient-to-b from-biz-accent to-biz-accent2"
                        style={{ height: `${h}%` }}
                        title={`${d.dayKey} • ${metric}: ${v.toLocaleString()}`}
                      />
                      <span className="text-[10px] text-gray-500">{label}</span>
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            <Card className="p-4">
              <div className="grid grid-cols-3 gap-2">
                <Button variant="secondary" onClick={() => (window.location.href = "/admin/vendors")}>
                  Vendors
                </Button>
                <Button variant="secondary" onClick={() => (window.location.href = "/admin/customers")}>
                  Customers
                </Button>
                <Button variant="secondary" onClick={() => (window.location.href = "/admin/finance")}>
                  Balance
                </Button>
              </div>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}