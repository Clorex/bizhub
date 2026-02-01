"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SectionCard } from "@/components/ui/SectionCard";
import { auth } from "@/lib/firebase/client";
import { RefreshCw } from "lucide-react";

type Range = "today" | "week" | "month";
type Metric = "revenue" | "views" | "leads" | "visits";

function fmtNaira(n: number) {
  try {
    return `₦${Number(n || 0).toLocaleString()}`;
  } catch {
    return `₦${n}`;
  }
}

function toMs(v: any) {
  try {
    if (!v) return 0;
    if (typeof v?.toDate === "function") return v.toDate().getTime();
    if (typeof v?.seconds === "number") return v.seconds * 1000;
    return 0;
  } catch {
    return 0;
  }
}

function fmtDateTime(v: any) {
  const ms = toMs(v);
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ms);
  }
}

function fmtDate(ms?: number) {
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleDateString();
  } catch {
    return String(ms);
  }
}

export default function AdminVendorDetailPage() {
  const router = useRouter();
  const params = useParams();
  const businessId = String((params as any)?.businessId ?? "");

  const [range, setRange] = useState<Range>("week");
  const [month, setMonth] = useState<string>("");
  const [metric, setMetric] = useState<Metric>("views");

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  async function api(path: string) {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
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

      const j = await api(`/api/admin/vendors/${encodeURIComponent(businessId)}/analytics${qs}`);
      setData(j);
    } catch (e: any) {
      setMsg(e?.message || "Failed");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (businessId) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId, range]);

  const biz = data?.business || {};
  const ov = data?.overview || {};
  const revenueSeries: any[] = Array.isArray(data?.charts?.revenueSeries) ? data.charts.revenueSeries : [];
  const trafficSeries: any[] = Array.isArray(data?.charts?.trafficSeries) ? data.charts.trafficSeries : [];
  const recentOrders: any[] = Array.isArray(data?.recentOrders) ? data.recentOrders : [];

  const series = useMemo(() => {
    if (metric === "revenue") return revenueSeries.map((d) => ({ dayKey: d.dayKey, value: Number(d.revenue || 0) }));
    return trafficSeries.map((d) => ({ dayKey: d.dayKey, value: Number(d[metric] || 0) }));
  }, [metric, revenueSeries, trafficSeries]);

  const maxV = useMemo(() => Math.max(1, ...series.map((d) => Number(d.value || 0))), [series]);

  const planLabel = useMemo(() => {
    if (biz?.subscription?.planKey && Number(biz?.subscription?.expiresAtMs || 0) > Date.now()) {
      return `Subscribed • ${biz.subscription.planKey}`;
    }
    if (biz?.trial?.planKey && Number(biz?.trial?.endsAtMs || 0) > Date.now()) {
      return `Trial • ${biz.trial.planKey}`;
    }
    return "Free";
  }, [biz]);

  return (
    <div className="min-h-screen">
      <GradientHeader
        title="Vendor analysis"
        subtitle={biz?.slug ? `${biz.slug}` : "Vendor"}
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

        <Card className="p-4">
          <p className="text-sm font-bold text-biz-ink">Month history</p>
          <p className="text-xs text-biz-muted mt-1">Recover analytics from any month.</p>

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
                setRange("month");
                setTimeout(load, 0);
              }}
              disabled={!month}
            >
              Load
            </Button>
          </div>
        </Card>

        {loading ? <Card className="p-4">Loading…</Card> : null}
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}

        {!loading && data ? (
          <>
            <div className="rounded-[26px] p-4 text-white shadow-float bg-gradient-to-br from-biz-accent2 to-biz-accent">
              <p className="text-xs opacity-95">Vendor</p>
              <p className="text-xl font-bold mt-1">
                {biz?.name || "Business"}{" "}
                <span className="opacity-95 text-[11px]">({biz?.slug || "—"})</span>
              </p>
              <p className="text-[11px] opacity-95 mt-2">
                Plan: <b>{planLabel}</b>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4">
                <p className="text-xs text-biz-muted">Revenue</p>
                <p className="text-lg font-bold text-biz-ink mt-1">{fmtNaira(Number(ov.revenue || 0))}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-biz-muted">Orders</p>
                <p className="text-lg font-bold text-biz-ink mt-1">{Number(ov.orders || 0).toLocaleString()}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-biz-muted">Customers</p>
                <p className="text-lg font-bold text-biz-ink mt-1">{Number(ov.customers || 0).toLocaleString()}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-biz-muted">Products sold</p>
                <p className="text-lg font-bold text-biz-ink mt-1">{Number(ov.productsSold || 0).toLocaleString()}</p>
              </Card>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Card className="p-4">
                <p className="text-xs text-biz-muted">Visits</p>
                <p className="text-lg font-bold text-biz-ink mt-1">{Number(ov.visits || 0).toLocaleString()}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-biz-muted">Leads</p>
                <p className="text-lg font-bold text-biz-ink mt-1">{Number(ov.leads || 0).toLocaleString()}</p>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-biz-muted">Views</p>
                <p className="text-lg font-bold text-biz-ink mt-1">{Number(ov.views || 0).toLocaleString()}</p>
              </Card>
            </div>

            <SectionCard
              title="Trend chart"
              subtitle="Use this to spot decline or increase"
              right={
                <select
                  value={metric}
                  onChange={(e) => setMetric(e.target.value as Metric)}
                  className="rounded-2xl border border-biz-line bg-white px-3 py-2 text-xs font-bold"
                >
                  <option value="views">Views</option>
                  <option value="leads">Leads</option>
                  <option value="visits">Visits</option>
                  <option value="revenue">Revenue</option>
                </select>
              }
            >
              <div className="flex items-end gap-2 h-28">
                {series.slice(-31).map((d) => {
                  const v = Number(d.value || 0);
                  const h = Math.max(6, Math.round((v / maxV) * 100));
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

            <SectionCard
              title="Recent orders"
              subtitle="Latest orders in this window"
              right={
                biz?.slug ? (
                  <Button variant="secondary" size="sm" onClick={() => router.push(`/b/${biz.slug}`)}>
                    View store
                  </Button>
                ) : null
              }
            >
              {recentOrders.length === 0 ? (
                <p className="text-sm text-biz-muted">No orders in this period.</p>
              ) : (
                <div className="space-y-2">
                  {recentOrders.map((o) => (
                    <div key={o.id} className="rounded-2xl border border-biz-line bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-biz-ink">Order #{String(o.id).slice(0, 8)}</p>
                          <p className="text-[11px] text-gray-500 mt-1">
                            {String(o.paymentType || "—")} • {String(o.orderStatus || o.escrowStatus || "—")}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-1">Created: {fmtDateTime(o.createdAt)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-biz-ink">{fmtNaira(Number(o.amount || 0))}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button variant="secondary" onClick={() => router.push("/admin/vendors")}>
                  Back to vendors
                </Button>
                <Button onClick={() => router.push("/admin/analytics")}>Platform analytics</Button>
              </div>
            </SectionCard>
          </>
        ) : null}
      </div>
    </div>
  );
}