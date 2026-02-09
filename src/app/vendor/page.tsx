// FILE: src/app/vendor/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { auth } from "@/lib/firebase/client";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatCard } from "@/components/ui/StatCard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";

import { toast } from "@/lib/ui/toast";

import {
  RefreshCw,
  Link2,
  Store as StoreIcon,
  Plus,
  BarChart3,
  AlertTriangle,
  MessageCircle,
  Gem,
  BadgePercent,
  Shield,
} from "lucide-react";

type Range = "today" | "week" | "month";
type Mood = "great" | "okay" | "slow";

const MOOD_KEY = "mybizhub_mood_daily_v1";

function lagosDayKey(now = new Date()) {
  return now.toLocaleDateString("en-CA", { timeZone: "Africa/Lagos" }); 
}

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

function fmtDate(v: any) {
  try {
    if (!v) return "—";
    if (typeof v?.toDate === "function") return v.toDate().toLocaleString();
    return String(v);
  } catch {
    return "—";
  }
}

function waShareLink(text: string) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function loadMood(): any | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(MOOD_KEY);
    if (!raw) return null;
    const j = JSON.parse(raw);
    return j && typeof j === "object" ? j : null;
  } catch {
    return null;
  }
}

function saveMood(v: any) {
  if (typeof window === "undefined") return;
  localStorage.setItem(MOOD_KEY, JSON.stringify(v));
}

export default function VendorDashboardPage() {
  const router = useRouter();

  const [range, setRange] = useState<Range>("week");
  const [me, setMe] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [access, setAccess] = useState<any>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [assistant, setAssistant] = useState<any>(null);
  const [assistantMsg, setAssistantMsg] = useState<string | null>(null);

  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [moodState, setMoodState] = useState<any>(() => loadMood());
  const [moodBusy, setMoodBusy] = useState(false);

  useEffect(() => {
    const dk = lagosDayKey();
    if (moodState?.dayKey && moodState.dayKey !== dk) {
      setMoodState(null);
      saveMood(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const storeUrl = useMemo(() => {
    if (!me?.businessSlug) return "";
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/b/${me.businessSlug}`;
  }, [me]);

  async function load() {
    try {
      setLoading(true);
      setMsg(null);
      setNotice(null);
      setAssistantMsg(null);

      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Please log in again to continue.");

      const rMe = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
      const meData = await rMe.json().catch(() => ({}));
      if (!rMe.ok) throw new Error(meData?.error || "Could not load your profile.");
      setMe(meData.me);

      const r = await fetch(`/api/vendor/analytics?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const a = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(a?.error || "Could not load your analytics.");

      setData(a);
      setAccess(a?.meta?.access || null);

      const n = String(a?.meta?.notice || "");
      if (n) setNotice(n);

      const used = String(a?.meta?.usedRange || range) as Range;
      if (used !== range) setRange(used);

      try {
        const ra = await fetch("/api/vendor/assistant/summary", { headers: { Authorization: `Bearer ${token}` } });
        const aj = await ra.json().catch(() => ({}));
        if (!ra.ok) throw new Error(aj?.error || aj?.code || "Assistant locked");
        setAssistant(aj);
      } catch (e: any) {
        setAssistant(null);
        const m = String(e?.message || "");
        if (m && !m.toLowerCase().includes("locked")) setAssistantMsg(m);
      }
    } catch (e: any) {
      setMsg(e?.message || "Something went wrong. Please try again.");
      setData(null);
      setAccess(null);
      setAssistant(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  async function copyLink() {
    try {
      if (!storeUrl) return;
      await navigator.clipboard.writeText(storeUrl);
      toast.success("Link copied. Share it with customers.");
    } catch {
      toast.error("Couldn’t copy the link. Please copy it manually.");
    }
  }

  async function submitMood(mood: Mood) {
    try {
      setMoodBusy(true);

      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Please log in again to continue.");

      const snapshot = {
        range,
        overview: data?.overview || {},
        todo: data?.todo || {},
        traffic: {
          visits: Number(data?.overview?.visits || 0),
          leads: Number(data?.overview?.leads || 0),
          views: Number(data?.overview?.views || 0),
        },
      };

      const r = await fetch("/api/vendor/mood/tip", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ mood, storeSlug: me?.businessSlug || null, snapshot }),
      });

      const j = await r.json().catch(() => ({} as any));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "Could not load a tip.");

      const next = {
        dayKey: lagosDayKey(),
        mood,
        tip: String(j.tip || ""),
        actions: Array.isArray(j.actions) ? j.actions : [],
      };

      setMoodState(next);
      saveMood(next);
    } catch (e: any) {
      setMsg(e?.message || "Could not get a tip right now.");
    } finally {
      setMoodBusy(false);
    }
  }

  const ov = data?.overview || {};
  const todo = data?.todo || {};
  const chartDays: any[] = Array.isArray(data?.chartDays) ? data.chartDays : [];
  const recentOrders: any[] = Array.isArray(data?.recentOrders) ? data.recentOrders : [];

  // SMART CHART SCALING
  const maxRevRaw = Math.max(0, ...chartDays.map((d) => Number(d.revenue || 0)));
  const ySteps = getNiceYScale(maxRevRaw);
  const chartMax = ySteps[0];

  const monthUnlocked =
    access?.monthAnalyticsUnlocked !== undefined
      ? !!access.monthAnalyticsUnlocked
      : !!access?.features?.canUseMonthRange;

  const accessSource = String(access?.source || "free");
  const accessPlanKey = String(access?.planKey || "FREE").toUpperCase();
  const subscribed = accessSource === "subscription" && accessPlanKey !== "FREE";

  const disputeLevel = String(assistant?.dispute?.level || "none");
  const openDisputes = Number(assistant?.dispute?.openDisputes || 0);

  const riskShieldEnabled = assistant?.riskShield?.enabled === true;
  const riskShieldMode = String(assistant?.riskShield?.mode || "off");
  const riskNotes: string[] = Array.isArray(assistant?.riskShield?.notes) ? assistant.riskShield.notes : [];

  const momentumPlan = accessPlanKey === "MOMENTUM";

  return (
    <div className="min-h-screen pb-24 bg-gray-50">
      <GradientHeader
        title="Dashboard"
        subtitle="Your business overview"
        showBack={false}
        right={
          <div className="flex items-center gap-2">
            {!subscribed ? (
              <button
                type="button"
                onClick={() => router.push("/vendor/subscription")}
                className="h-10 w-10 rounded-2xl shadow-float bg-gradient-to-br from-biz-accent2 to-biz-accent flex items-center justify-center"
                aria-label="Upgrade"
                title="Upgrade"
              >
                <Gem className="h-5 w-5 text-white" />
              </button>
            ) : null}

            <IconButton aria-label="Refresh" onClick={load} disabled={loading}>
              <RefreshCw className="h-5 w-5 text-gray-700" />
            </IconButton>
          </div>
        }
      />

      <div className="px-4 space-y-4">
        <SegmentedControl<Range>
          value={range}
          onChange={setRange}
          options={[
            { value: "today", label: "Today" },
            { value: "week", label: "Week" },
            { value: "month", label: "Month", disabled: !monthUnlocked },
          ]}
        />

        {notice ? <Card className="p-4 text-orange-700 font-medium">{notice}</Card> : null}
        {msg ? <Card className="p-4 text-red-700 font-medium">{msg}</Card> : null}
        {loading ? <Card className="p-4 text-center font-bold text-gray-500">Loading your data...</Card> : null}

        {!loading && data ? (
          <>
            <div className="rounded-[24px] p-5 text-white shadow-lg bg-gradient-to-br from-biz-accent2 to-biz-accent relative overflow-hidden">
              <div className="relative z-10">
                <p className="text-xs font-bold uppercase tracking-widest opacity-80">Total Sales</p>
                <p className="text-3xl font-black mt-1 tracking-tight">{fmtNaira(ov.totalRevenue || 0)}</p>
                <p className="text-xs font-medium opacity-90 mt-1 flex items-center gap-1">
                  Store: <span className="bg-white/20 px-2 py-0.5 rounded-md">{me?.businessSlug || "—"}</span>
                </p>

                <div className="mt-5 grid grid-cols-2 gap-3">
                  <Button
                    variant="soft"
                    className="bg-white/20 hover:bg-white/30 text-white border-none shadow-none font-bold"
                    leftIcon={<Link2 className="h-4 w-4" />}
                    onClick={copyLink}
                    disabled={!storeUrl}
                  >
                    Copy Link
                  </Button>
                  <Button
                    variant="soft"
                    className="bg-white text-biz-accent hover:bg-gray-50 border-none shadow-none font-bold"
                    leftIcon={<StoreIcon className="h-4 w-4" />}
                    onClick={() => router.push(`/b/${me?.businessSlug || ""}`)}
                    disabled={!me?.businessSlug}
                  >
                    View Store
                  </Button>
                </div>
              </div>
            </div>

            <Card className="p-4">
              <p className="text-sm font-extrabold text-biz-ink">How’s business today?</p>

              {!moodState ? (
                <>
                  <p className="text-xs text-biz-muted mt-1">Pick one. I’ll give you a quick tip.</p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => submitMood("great")}
                      disabled={moodBusy}
                      className="rounded-2xl border border-biz-line bg-white py-3 text-sm font-bold text-biz-ink disabled:opacity-50"
                    >
                      Great
                    </button>
                    <button
                      type="button"
                      onClick={() => submitMood("okay")}
                      disabled={moodBusy}
                      className="rounded-2xl border border-biz-line bg-white py-3 text-sm font-bold text-biz-ink disabled:opacity-50"
                    >
                      Okay
                    </button>
                    <button
                      type="button"
                      onClick={() => submitMood("slow")}
                      disabled={moodBusy}
                      className="rounded-2xl border border-biz-line bg-white py-3 text-sm font-bold text-biz-ink disabled:opacity-50"
                    >
                      Slow
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-xs text-biz-muted mt-1">
                    Mood: <b className="text-biz-ink">{String(moodState.mood).toUpperCase()}</b>
                  </p>
                  {moodState.tip ? <p className="text-sm text-gray-800 mt-2">{moodState.tip}</p> : null}

                  {Array.isArray(moodState.actions) && moodState.actions.length ? (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      {moodState.actions.slice(0, 2).map((a: any) => (
                        <Button key={a.url} variant="secondary" onClick={() => router.push(a.url)}>
                          {a.label || "Open"}
                        </Button>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button variant="secondary" onClick={() => router.push("/vendor/orders")}>
                        Orders
                      </Button>
                      <Button variant="secondary" onClick={() => router.push("/vendor/products")}>
                        Products
                      </Button>
                    </div>
                  )}
                </>
              )}
            </Card>

            {/* RESTORED BRAND STAT CARDS */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Orders" value={ov.orders || 0} onClick={() => router.push("/vendor/orders")} />
              <StatCard label="Products sold" value={ov.productsSold || 0} onClick={() => router.push("/vendor/orders")} />
              <StatCard label="Customers" value={ov.customers || 0} hint="Buyers (phone/email)" />
              <StatCard label="Website visits" value={ov.visits || 0} hint="Store + product views" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Leads (clicks)" value={ov.leads || 0} />
              <StatCard label="Views (impressions)" value={ov.views || 0} />
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

            <SectionCard title="Todo" subtitle="Quick fixes that improve sales">
              <div className="space-y-2 text-sm">
                <TodoRow label="Out of stock products" value={todo.outOfStockCount || 0} onClick={() => router.push("/vendor/products")} />
                <TodoRow label="Low stock products" value={todo.lowStockCount || 0} onClick={() => router.push("/vendor/products")} />
                <TodoRow label="Direct transfers awaiting confirmation" value={todo.awaitingConfirmCount || 0} onClick={() => router.push("/vendor/orders")} />
                <TodoRow label="Disputed orders" value={todo.disputedCount || 0} onClick={() => router.push("/vendor/orders")} />
              </div>
            </SectionCard>

            <SectionCard title="Quick actions" subtitle="Create, manage, and grow">
              <div className="grid grid-cols-2 gap-2">
                <Button leftIcon={<Plus className="h-4 w-4" />} onClick={() => router.push("/vendor/products/new")}>
                  New listing
                </Button>
                <Button variant="secondary" leftIcon={<BarChart3 className="h-4 w-4" />} onClick={() => router.push("/vendor/analytics")}>
                  Analysis
                </Button>
                <Button variant="secondary" onClick={() => router.push("/vendor/orders")}>
                  Orders
                </Button>
                <Button variant="secondary" onClick={() => router.push("/vendor/store")}>
                  Store settings
                </Button>
              </div>
            </SectionCard>

            <SectionCard title="Recent orders" subtitle="Latest activity">
              {recentOrders.length === 0 ? (
                <div className="text-sm text-biz-muted font-medium bg-gray-50 p-4 rounded-xl text-center">No orders yet.</div>
              ) : (
                <div className="space-y-2">
                  {recentOrders.slice(0, 6).map((o) => (
                    <button
                      key={o.id}
                      className="w-full text-left rounded-2xl border border-gray-200 bg-white p-4 hover:border-biz-accent transition shadow-sm"
                      onClick={() => router.push(`/vendor/orders/${o.id}`)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-gray-900">Order #{String(o.id).slice(0, 8)}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600">
                              {o.paymentType || "Card"}
                            </span>
                            <span className="text-xs text-biz-muted font-medium">
                              {o.orderStatus || o.escrowStatus || "Pending"}
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-2 font-medium">{fmtDate(o.createdAt)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-black text-gray-900">{fmtNaira(o.amount || (o.amountKobo ? o.amountKobo / 100 : 0))}</p>
                        </div>
                      </div>
                    </button>
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

function TodoRow({ label, value, onClick }: { label: string; value: number; onClick: () => void }) {
  return (
    <button
      className="w-full rounded-2xl border border-gray-200 bg-white p-4 flex items-center justify-between hover:border-biz-accent transition shadow-sm"
      onClick={onClick}
    >
      <span className="text-sm font-bold text-gray-700">{label}</span>
      <span className="text-sm font-black text-gray-900 bg-gray-100 px-3 py-1 rounded-lg">{value}</span>
    </button>
  );
}