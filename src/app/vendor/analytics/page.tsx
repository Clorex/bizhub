// FILE: src/app/vendor/analytics/page.tsx
"use client";

import { useEffect, useState } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatCard } from "@/components/ui/StatCard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { auth } from "@/lib/firebase/client";

type Range = "week" | "month";

function fmtNaira(n: number) {
  try {
    return `₦${Number(n || 0).toLocaleString()}`;
  } catch {
    return `₦${n}`;
  }
}

// Formats big numbers for the Chart Axis smoothly (e.g., 50000 -> ₦50k)
function compactNaira(n: number) {
  if (!n || n <= 0) return "0";
  if (n >= 1000000) return `₦${Number((n / 1000000).toFixed(1))}M`;
  if (n >= 1000) return `₦${Number((n / 1000).toFixed(1))}k`;
  return `₦${n}`;
}

// "Smart Scale" Algorithm: Automatically rounds your chart axis to beautiful numbers (1k, 2k, 10k, 50k, etc.)
function getNiceYScale(maxValue: number) {
  if (maxValue <= 0) return [4000, 3000, 2000, 1000, 0]; 
  const roughStep = maxValue / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(roughStep || 1)));
  const norm = roughStep / mag;
  
  let niceNorm;
  if (norm < 1.5) niceNorm = 1;
  else if (norm < 3) niceNorm = 2;
  else if (norm < 7) niceNorm = 5;
  else niceNorm = 10;
  
  const step = niceNorm * mag;
  return [step * 4, step * 3, step * 2, step, 0];
}

function getDayName(dateStr: string) {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr.slice(8, 10);
    return d.toLocaleDateString("en-US", { weekday: "short" });
  } catch {
    return dateStr.slice(8, 10);
  }
}

export default function VendorAnalyticsPage() {
  const [range, setRange] = useState<Range>("week");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setMsg(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Please log in again to continue.");

      const r = await fetch(`/api/vendor/analytics?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(json.error || "Could not load analytics.");

      setData(json);
    } catch (e: any) {
      setMsg(e.message || "Failed to load analytics data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const ov = data?.overview || {};
  const chartDays: any[] = Array.isArray(data?.chartDays) ? data.chartDays : [];
  
  // SMART CHART SCALING
  const maxRevRaw = Math.max(0, ...chartDays.map((d) => Number(d.revenue || 0)));
  const ySteps = getNiceYScale(maxRevRaw);
  const chartMax = ySteps[0];
  const totalRev = Number(ov.totalRevenue || 0);

  return (
    <div className="min-h-screen">
      <GradientHeader title="Business Analysis" subtitle="Track your store's performance" showBack={true} />

      <div className="px-4 pb-24 space-y-4">
        <SegmentedControl<Range>
          value={range}
          onChange={setRange}
          options={[
            { value: "week", label: "Last 7 Days" },
            { value: "month", label: "Last 30 Days" },
          ]}
        />

        {msg && <Card className="p-4 text-red-700">{msg}</Card>}
        {loading && <Card className="p-4 text-gray-500">Generating charts...</Card>}

        {!loading && data && (
          <>
            <div className="rounded-[26px] p-5 text-white shadow-float bg-gradient-to-br from-biz-accent2 to-biz-accent">
              <p className="text-sm font-bold opacity-90">Total Revenue ({range === "week" ? "7 Days" : "30 Days"})</p>
              <p className="text-3xl font-black mt-1">{fmtNaira(totalRev)}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Orders Received" value={ov.orders || 0} />
              <StatCard label="Store Views" value={ov.visits || 0} />
            </div>

            {/* SMART BRAND CHART */}
            <Card className="p-4 border border-biz-line shadow-sm bg-white">
              <p className="text-sm font-extrabold text-biz-ink">Revenue Analysis</p>
              <p className="text-xs text-gray-500 font-medium mt-0.5 mb-6">Performance for the selected period</p>

              {chartDays.length === 0 ? (
                <div className="h-40 flex items-center justify-center text-gray-400 font-bold text-sm bg-gray-50 rounded-xl">
                  No sales data yet
                </div>
              ) : (
                <div className="relative h-56 w-full">
                  {/* Y-Axis Grid Lines & Labels */}
                  <div className="absolute inset-0 flex flex-col justify-between pb-6">
                    {ySteps.map((val, i) => (
                      <div key={i} className="flex items-center w-full">
                        <span className="text-[10px] font-bold text-gray-400 w-10 text-right pr-2 shrink-0">
                          {compactNaira(val)}
                        </span>
                        <div className="flex-1 border-b border-gray-100" />
                      </div>
                    ))}
                  </div>

                  {/* X-Axis & Actual Bars */}
                  <div className="absolute inset-0 left-10 flex items-end justify-around pb-6 px-2">
                    {chartDays.map((d) => {
                      const rev = Number(d.revenue || 0);
                      const heightPct = chartMax > 0 ? (rev / chartMax) * 100 : 0;
                      const h = Math.max(0, heightPct); 
                      const isZero = rev === 0;

                      return (
                        <div key={d.dayKey} className="flex flex-col items-center justify-end h-full w-full relative group cursor-pointer">
                          {/* Tooltip on Tap/Hover */}
                          <div className="opacity-0 group-hover:opacity-100 absolute -top-8 bg-gray-900 text-white text-[10px] font-bold py-1 px-2 rounded-md whitespace-nowrap transition-opacity z-20 pointer-events-none shadow-lg">
                            {fmtNaira(rev)}
                          </div>

                          {/* The Bar */}
                          <div
                            className={`w-full max-w-[24px] rounded-t-sm transition-all duration-700 relative z-10 ${
                              isZero ? "bg-gray-200" : "bg-gradient-to-t from-biz-accent to-biz-accent2 hover:opacity-80"
                            }`}
                            style={{ height: `${h}%`, minHeight: isZero ? "2px" : "4px" }}
                          />

                          {/* Date Label at Bottom */}
                          <div className="absolute -bottom-6 w-full text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                            {getDayName(String(d.label))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          </>
        )}
      </div>
    </div>
  );
}