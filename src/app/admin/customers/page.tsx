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

function fmtNaira(n: number) {
  try {
    return `₦${Number(n || 0).toLocaleString()}`;
  } catch {
    return `₦${n}`;
  }
}

export default function AdminCustomersPage() {
  const [range, setRange] = useState<Range>("week");
  const [month, setMonth] = useState<string>("");

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

      const j = await api(`/api/admin/customers${qs}`);
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
  const topBuyers: any[] = Array.isArray(data?.topBuyers) ? data.topBuyers : [];
  const series: any[] = Array.isArray(data?.series) ? data.series : [];

  const maxOrders = useMemo(() => Math.max(1, ...series.map((d) => Number(d.orders || 0))), [series]);

  return (
    <div className="min-h-screen">
      <GradientHeader
        title="Customers"
        subtitle="Buyer analytics (phone/email)"
        showBack={true}
        right={
          <Button variant="secondary" size="sm" onClick={load} leftIcon={<RefreshCw className="h-4 w-4" />}>
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
          <p className="text-xs text-biz-muted mt-1">Load analysis for any month.</p>
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
              <p className="text-xs opacity-95">Customer summary</p>
              <p className="text-xl font-bold mt-1">
                {Number(totals.uniqueBuyers || 0).toLocaleString()} buyers • {fmtNaira(totals.revenue || 0)}
              </p>
              <p className="text-[11px] opacity-95 mt-2">
                Orders: <b>{Number(totals.orders || 0).toLocaleString()}</b> • Repeat buyers:{" "}
                <b>{Number(totals.repeatBuyers || 0).toLocaleString()}</b>
              </p>
            </div>

            <SectionCard title="Daily orders" subtitle="Trend line via bars">
              <div className="flex items-end gap-2 h-28">
                {series.slice(-31).map((d) => {
                  const v = Number(d.orders || 0);
                  const h = Math.max(6, Math.round((v / maxOrders) * 100));
                  const label = String(d.dayKey || "").slice(8, 10);
                  return (
                    <div key={d.dayKey} className="flex-1 flex flex-col items-center justify-end gap-2">
                      <div
                        className="w-full rounded-xl bg-gradient-to-b from-biz-accent to-biz-accent2"
                        style={{ height: `${h}%` }}
                        title={`${d.dayKey} • orders: ${v}`}
                      />
                      <span className="text-[10px] text-gray-500">{label}</span>
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard title="Top customers" subtitle="Highest spenders">
              {topBuyers.length === 0 ? (
                <div className="text-sm text-biz-muted">No buyers found in this window.</div>
              ) : (
                <div className="space-y-2">
                  {topBuyers.slice(0, 20).map((b) => (
                    <div key={b.key} className="rounded-2xl border border-biz-line bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-biz-ink">
                            {b.fullName || b.phone || b.email || "Customer"}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-1 break-all">
                            {b.phone ? `Phone: ${b.phone}` : b.email ? `Email: ${b.email}` : "—"}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-1">
                            Orders: <b className="text-biz-ink">{Number(b.orders || 0)}</b>
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-biz-ink">{fmtNaira(Number(b.spend || 0))}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </>
        ) : null}
      </div>
    </div>
  );
}