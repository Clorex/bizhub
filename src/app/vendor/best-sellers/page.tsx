// FILE: src/app/vendor/best-sellers/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { auth } from "@/lib/firebase/client";
import { RefreshCw, TrendingUp, TrendingDown, Flame } from "lucide-react";

function fmtNaira(n: number) {
  try {
    return `₦${Number(n || 0).toLocaleString()}`;
  } catch {
    return `₦${n}`;
  }
}

function fmtDateMs(ms?: number) {
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ms);
  }
}

type MetricMode = "revenue" | "units" | "orders";

function Chip({ children, tone }: { children: any; tone: "green" | "orange" | "red" | "gray" }) {
  const cls =
    tone === "green"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : tone === "orange"
      ? "bg-orange-50 text-orange-700 border-orange-100"
      : tone === "red"
      ? "bg-rose-50 text-rose-700 border-rose-100"
      : "bg-gray-50 text-gray-700 border-gray-100";

  return <span className={`px-2 py-1 rounded-full text-[11px] font-bold border ${cls}`}>{children}</span>;
}

export default function VendorBestSellersPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [meta, setMeta] = useState<any>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [dailySeries, setDailySeries] = useState<any[]>([]);
  const [apexInsights, setApexInsights] = useState<any>(null);

  const [days, setDays] = useState<number>(7);
  const [mode, setMode] = useState<MetricMode>("revenue");

  async function authedFetchJson(path: string) {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || data?.code || "Request failed");
    return data;
  }

  async function load(nextDays?: number) {
    try {
      setLoading(true);
      setMsg(null);

      const d = typeof nextDays === "number" ? nextDays : days;

      const data = await authedFetchJson(`/api/vendor/best-sellers?days=${encodeURIComponent(String(d))}&insights=1`);

      setMeta(data?.meta || null);
      setProducts(Array.isArray(data?.products) ? data.products : []);
      setDailySeries(Array.isArray(data?.dailySeries) ? data.dailySeries : []);
      setApexInsights(data?.apexInsights || null);
      setDays(Number(data?.meta?.days || d));
    } catch (e: any) {
      setMsg(e?.message || "Failed to load best-sellers");
      setMeta(null);
      setProducts([]);
      setDailySeries([]);
      setApexInsights(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load(7);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const planKey = String(meta?.planKey || "FREE").toUpperCase();
  const allowedDays: number[] = Array.isArray(meta?.allowedDays) ? meta.allowedDays : [7];
  const maxRows = Number(meta?.maxRows || 0);
  const maxDays = Number(meta?.maxDays || 0);

  const expansionSuggestion = meta?.bestSellersExpansionSuggestion || null;

  const chartsUnlocked = planKey === "MOMENTUM" || planKey === "APEX";
  const apexUnlocked = planKey === "APEX";

  const series = useMemo(() => {
    const s = Array.isArray(dailySeries) ? dailySeries : [];
    return s.slice(-Math.max(1, Number(days || 7)));
  }, [dailySeries, days]);

  const totals = useMemo(() => {
    const revenueKobo = series.reduce((s, r) => s + Number(r?.revenueKobo || 0), 0);
    const units = series.reduce((s, r) => s + Number(r?.unitsSold || 0), 0);
    const orders = series.reduce((s, r) => s + Number(r?.ordersCount || 0), 0);
    return { revenueKobo, units, orders };
  }, [series]);

  const chartStats = useMemo(() => {
    if (!series.length) return null;

    const getV = (r: any) =>
      mode === "revenue"
        ? Number(r?.revenueKobo || 0)
        : mode === "units"
        ? Number(r?.unitsSold || 0)
        : Number(r?.ordersCount || 0);

    let best = series[0];
    let worst = series[0];

    for (const r of series) {
      if (getV(r) > getV(best)) best = r;
      if (getV(r) < getV(worst)) worst = r;
    }

    const today = series[series.length - 1] || null;
    const yesterday = series.length >= 2 ? series[series.length - 2] : null;

    const tv = today ? getV(today) : 0;
    const yv = yesterday ? getV(yesterday) : 0;
    const diff = tv - yv;

    return {
      bestDayKey: String(best?.dayKey || ""),
      worstDayKey: String(worst?.dayKey || ""),
      todayValue: tv,
      yesterdayValue: yv,
      diff,
    };
  }, [series, mode]);

  const bars = useMemo(() => {
    const getV = (r: any) =>
      mode === "revenue"
        ? Number(r?.revenueKobo || 0)
        : mode === "units"
        ? Number(r?.unitsSold || 0)
        : Number(r?.ordersCount || 0);

    const max = Math.max(1, ...series.map((r) => getV(r)));
    return { max, getV };
  }, [series, mode]);

  function InsightRow({
    name,
    changeNgn,
    recentRevenueNgn,
    prevRevenueNgn,
    isNew,
    tone,
  }: {
    name: string;
    changeNgn: number;
    recentRevenueNgn: number;
    prevRevenueNgn: number;
    isNew?: boolean;
    tone: "green" | "red" | "orange";
  }) {
    const abs = Math.abs(Number(changeNgn || 0));
    const badge =
      tone === "green"
        ? `+${fmtNaira(abs)}`
        : tone === "red"
        ? `-${fmtNaira(abs)}`
        : `${fmtNaira(abs)}`;

    return (
      <div className="rounded-2xl border border-biz-line bg-white p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-biz-ink truncate">{name}</p>
            <p className="text-[11px] text-gray-500 mt-1">
              Recent: <b className="text-biz-ink">{fmtNaira(recentRevenueNgn)}</b> • Previous:{" "}
              <b className="text-biz-ink">{fmtNaira(prevRevenueNgn)}</b>
            </p>
          </div>

          <div className="text-right shrink-0 flex flex-col items-end gap-1">
            <Chip tone={tone === "green" ? "green" : tone === "red" ? "red" : "orange"}>{badge}</Chip>
            {isNew ? <Chip tone="orange">New</Chip> : null}
          </div>
        </div>

        <p className="text-[11px] text-biz-muted mt-2">
          Tip:{" "}
          {tone === "green"
            ? "Increase stock, promote it, or raise price slightly if demand is strong."
            : "Consider a discount, better photos, or bundling to revive sales."}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <GradientHeader
        title="Best-selling products"
        subtitle="What customers buy the most"
        showBack={true}
        right={
          <IconButton aria-label="Refresh" onClick={() => load()} disabled={loading}>
            <RefreshCw className="h-5 w-5 text-gray-700" />
          </IconButton>
        }
      />

      <div className="px-4 pb-24 space-y-3">
        {msg ? (
          <Card className="p-4 text-red-700">
            {msg}
            {String(msg || "").toLowerCase().includes("locked") ? (
              <div className="mt-2">
                <Button size="sm" onClick={() => router.push("/vendor/subscription")}>
                  Upgrade
                </Button>
              </div>
            ) : null}
          </Card>
        ) : null}

        <Card className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-extrabold text-biz-ink">Overview</p>
              <p className="text-xs text-biz-muted mt-1">
                Plan: <b className="text-biz-ink">{planKey}</b> • Showing up to{" "}
                <b className="text-biz-ink">{maxRows || "—"}</b>
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                Time range: last <b>{days}</b> days (max: <b>{maxDays || "—"}</b>)
              </p>

              <p className="text-[11px] text-gray-500 mt-2">
                Total revenue: <b className="text-biz-ink">{fmtNaira(totals.revenueKobo / 100)}</b> • Units:{" "}
                <b className="text-biz-ink">{totals.units}</b> • Orders:{" "}
                <b className="text-biz-ink">{totals.orders}</b>
              </p>
            </div>

            <Button variant="secondary" size="sm" onClick={() => load()} loading={loading}>
              Refresh
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {allowedDays.map((d) => (
              <Button
                key={d}
                size="sm"
                variant={days === d ? "primary" : "secondary"}
                onClick={() => load(d)}
                disabled={loading}
              >
                Last {d} days
              </Button>
            ))}
          </div>
        </Card>

        {expansionSuggestion ? (
          <Card className="p-4">
            <p className="font-extrabold text-biz-ink">Want more?</p>
            <p className="text-[11px] text-biz-muted mt-1">{String(expansionSuggestion?.title || "")}</p>
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={() => router.push(String(expansionSuggestion?.url || "/vendor/purchases"))}>
                Buy expansion
              </Button>
              <Button size="sm" variant="secondary" onClick={() => router.push("/vendor/subscription")}>
                Upgrade plan
              </Button>
            </div>
          </Card>
        ) : null}

        {chartsUnlocked ? (
          <Card className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-extrabold text-biz-ink">Daily performance</p>
                <p className="text-[11px] text-biz-muted mt-1">
                  Switch between revenue, units sold, and orders. (No chart library)
                </p>
              </div>

              <div className="flex gap-2">
                <Button size="sm" variant={mode === "revenue" ? "primary" : "secondary"} onClick={() => setMode("revenue")}>
                  Revenue
                </Button>
                <Button size="sm" variant={mode === "units" ? "primary" : "secondary"} onClick={() => setMode("units")}>
                  Units
                </Button>
                <Button size="sm" variant={mode === "orders" ? "primary" : "secondary"} onClick={() => setMode("orders")}>
                  Orders
                </Button>
              </div>
            </div>

            {chartStats ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Card variant="soft" className="p-3">
                  <p className="text-[11px] text-biz-muted">Best day</p>
                  <p className="text-sm font-extrabold text-biz-ink mt-1">{chartStats.bestDayKey || "—"}</p>
                </Card>
                <Card variant="soft" className="p-3">
                  <p className="text-[11px] text-biz-muted">Worst day</p>
                  <p className="text-sm font-extrabold text-biz-ink mt-1">{chartStats.worstDayKey || "—"}</p>
                </Card>

                <Card variant="soft" className="p-3">
                  <p className="text-[11px] text-biz-muted">Today vs yesterday</p>
                  <p className="text-sm font-extrabold mt-1">
                    <span className={chartStats.diff >= 0 ? "text-emerald-700" : "text-rose-700"}>
                      {chartStats.diff >= 0 ? "+" : ""}
                      {mode === "revenue" ? fmtNaira(chartStats.diff / 100) : String(chartStats.diff)}
                    </span>
                  </p>
                </Card>

                <Card variant="soft" className="p-3">
                  <p className="text-[11px] text-biz-muted">Current max</p>
                  <p className="text-sm font-extrabold text-biz-ink mt-1">
                    {mode === "revenue" ? fmtNaira(bars.max / 100) : String(bars.max)}
                  </p>
                </Card>
              </div>
            ) : null}

            {series.length === 0 ? (
              <p className="text-sm text-biz-muted mt-3">No chart data yet.</p>
            ) : (
              <div className="mt-4 flex items-end gap-2 h-28">
                {series.map((d: any) => {
                  const v = bars.getV(d);
                  const h = Math.max(6, Math.round((v / bars.max) * 100));
                  const label = String(d.dayKey || "").slice(8, 10);

                  const title =
                    mode === "revenue"
                      ? `${d.dayKey} • Revenue: ${fmtNaira(Number(d.revenueKobo || 0) / 100)}`
                      : mode === "units"
                      ? `${d.dayKey} • Units: ${Number(d.unitsSold || 0)}`
                      : `${d.dayKey} • Orders: ${Number(d.ordersCount || 0)}`;

                  return (
                    <div key={d.dayKey} className="flex-1 flex flex-col items-center justify-end gap-2">
                      <div
                        className="w-full rounded-xl bg-gradient-to-b from-biz-accent to-biz-accent2"
                        style={{ height: `${h}%` }}
                        title={title}
                      />
                      <span className="text-[10px] text-gray-500">{label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        ) : (
          <Card className="p-4">
            <p className="font-extrabold text-biz-ink">Charts locked</p>
            <p className="text-[11px] text-biz-muted mt-1">
              Daily charts are available on <b>Momentum</b> and <b>Apex</b>.
            </p>
            <div className="mt-2">
              <Button size="sm" onClick={() => router.push("/vendor/subscription")}>
                Upgrade
              </Button>
            </div>
          </Card>
        )}

        {apexUnlocked ? (
          apexInsights ? (
            <>
              <Card className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-extrabold text-biz-ink">APEX insights</p>
                    <p className="text-[11px] text-biz-muted mt-1">
                      Comparing <b>{apexInsights.prevLabel}</b> vs <b>{apexInsights.recentLabel}</b>
                    </p>
                  </div>
                  <Chip tone="green">APEX</Chip>
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-emerald-700" />
                  <p className="font-extrabold text-biz-ink">Rising products</p>
                </div>
                <p className="text-[11px] text-biz-muted mt-1">Products whose revenue increased in the last 7 days.</p>

                <div className="mt-3 space-y-2">
                  {(apexInsights?.risers || []).length === 0 ? (
                    <p className="text-sm text-biz-muted">No risers yet.</p>
                  ) : (
                    apexInsights.risers.map((x: any) => (
                      <InsightRow
                        key={x.productId}
                        name={x.name}
                        changeNgn={Number(x.changeNgn || 0)}
                        recentRevenueNgn={Number(x.recentRevenueNgn || 0)}
                        prevRevenueNgn={Number(x.prevRevenueNgn || 0)}
                        isNew={!!x.isNew}
                        tone="green"
                      />
                    ))
                  )}
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <TrendingDown className="h-5 w-5 text-rose-700" />
                  <p className="font-extrabold text-biz-ink">Products dropping</p>
                </div>
                <p className="text-[11px] text-biz-muted mt-1">
                  Products losing revenue compared to the previous 7 days.
                </p>

                <div className="mt-3 space-y-2">
                  {(apexInsights?.droppers || []).length === 0 ? (
                    <p className="text-sm text-biz-muted">No droppers yet.</p>
                  ) : (
                    apexInsights.droppers.map((x: any) => (
                      <InsightRow
                        key={x.productId}
                        name={x.name}
                        changeNgn={Number(x.changeNgn || 0)}
                        recentRevenueNgn={Number(x.recentRevenueNgn || 0)}
                        prevRevenueNgn={Number(x.prevRevenueNgn || 0)}
                        tone="red"
                      />
                    ))
                  )}
                </div>
              </Card>

              <Card className="p-4">
                <div className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-700" />
                  <p className="font-extrabold text-biz-ink">New hot products</p>
                </div>
                <p className="text-[11px] text-biz-muted mt-1">
                  Products that sold this week but did not sell last week.
                </p>

                <div className="mt-3 space-y-2">
                  {(apexInsights?.newHot || []).length === 0 ? (
                    <p className="text-sm text-biz-muted">No new hot products yet.</p>
                  ) : (
                    apexInsights.newHot.map((x: any) => (
                      <div key={x.productId} className="rounded-2xl border border-biz-line bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-extrabold text-biz-ink truncate">{x.name}</p>
                            <p className="text-[11px] text-gray-500 mt-1">
                              Revenue: <b className="text-biz-ink">{fmtNaira(Number(x.revenueNgn || 0))}</b> • Units:{" "}
                              <b className="text-biz-ink">{Number(x.units || 0)}</b>
                            </p>
                          </div>
                          <Chip tone="orange">New</Chip>
                        </div>
                        <p className="text-[11px] text-biz-muted mt-2">
                          Tip: promote it or restock early so you don’t miss the trend.
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </>
          ) : (
            <Card className="p-4">
              <p className="font-extrabold text-biz-ink">APEX insights</p>
              <p className="text-[11px] text-biz-muted mt-1">Not enough data yet to generate insights.</p>
            </Card>
          )
        ) : null}

        {loading ? <Card className="p-4">Loading…</Card> : null}

        {!loading && products.length === 0 ? (
          <Card className="p-5 text-center">
            <p className="text-base font-extrabold text-biz-ink">No sales data yet</p>
            <p className="text-sm text-biz-muted mt-2">Best-sellers will appear after paid orders come in.</p>
          </Card>
        ) : null}

        <div className="space-y-2">
          {products.map((p, idx) => (
            <Card key={p.productId || idx} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-extrabold text-biz-ink truncate">{p.name || "Product"}</p>
                  <p className="text-[11px] text-gray-500 mt-1 break-all">
                    Product ID: <b className="text-biz-ink">{p.productId}</b>
                  </p>
                  <p className="text-[11px] text-gray-500 mt-2">
                    Units sold: <b className="text-biz-ink">{Number(p.unitsSold || 0)}</b>
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Last sold: <b className="text-biz-ink">{fmtDateMs(Number(p.lastSoldAtMs || 0))}</b>
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm font-extrabold text-biz-ink">{fmtNaira(Number(p.revenueNgn || 0))}</p>
                  <p className="text-[11px] text-gray-500 mt-1">Revenue</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}