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

import {
  RefreshCw,
  Link2,
  Store as StoreIcon,
  Plus,
  BarChart3,
  AlertTriangle,
  MessageCircle,
  Gem,
} from "lucide-react";

type Range = "today" | "week" | "month";

function fmtNaira(n: number) {
  try {
    return `₦${Number(n || 0).toLocaleString()}`;
  } catch {
    return `₦${n}`;
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
      if (!token) throw new Error("Not logged in");

      const rMe = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
      const meData = await rMe.json().catch(() => ({}));
      if (!rMe.ok) throw new Error(meData?.error || "Failed to load profile");
      setMe(meData.me);

      const r = await fetch(`/api/vendor/analytics?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const a = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(a?.error || "Failed to load analytics");

      setData(a);
      setAccess(a?.meta?.access || null);

      const n = String(a?.meta?.notice || "");
      if (n) setNotice(n);

      const used = String(a?.meta?.usedRange || range) as Range;
      if (used !== range) setRange(used);

      // Assistant summary
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
      setMsg(e?.message || "Failed");
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
      alert("Store link copied");
    } catch {
      alert("Copy failed");
    }
  }

  const ov = data?.overview || {};
  const todo = data?.todo || {};
  const chartDays: any[] = Array.isArray(data?.chartDays) ? data.chartDays : [];
  const recentOrders: any[] = Array.isArray(data?.recentOrders) ? data.recentOrders : [];

  const maxRev = Math.max(1, ...chartDays.map((d) => Number(d.revenue || 0)));

  const monthUnlocked = !!access?.monthAnalyticsUnlocked;

  const accessSource = String(access?.source || "free");
  const accessPlanKey = String(access?.planKey || "FREE");
  const subscribed = accessSource === "subscription" && accessPlanKey !== "FREE";

  const disputeLevel = String(assistant?.dispute?.level || "none");
  const openDisputes = Number(assistant?.dispute?.openDisputes || 0);

  return (
    <div className="min-h-screen">
      <GradientHeader
        title="Dashboard"
        subtitle="Your business overview"
        showBack={false}
        right={
          <div className="flex items-center gap-2">
            {/* PRO/Upgrade (only for FREE) */}
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

      <div className="px-4 pb-6 space-y-3">
        <SegmentedControl<Range>
          value={range}
          onChange={setRange}
          options={[
            { value: "today", label: "Today" },
            { value: "week", label: "Week" },
            { value: "month", label: "Month", disabled: !monthUnlocked },
          ]}
        />

        {notice ? <Card className="p-4 text-orange-700">{notice}</Card> : null}
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}
        {loading ? <Card className="p-4">Loading…</Card> : null}

        {/* Dispute warning */}
        {!loading && assistant && disputeLevel !== "none" ? (
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-2xl bg-red-50 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-700" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-biz-ink">Dispute warning</p>
                <p className="text-xs text-biz-muted mt-1">
                  You have <b className="text-biz-ink">{openDisputes}</b> open dispute(s). If ignored, your marketplace
                  visibility reduces.
                </p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button onClick={() => router.push("/vendor/orders")}>View orders</Button>
                  <Button variant="secondary" onClick={() => router.push("/vendor/more")}>
                    More
                  </Button>
                </div>
                <p className="mt-2 text-[11px] text-biz-muted">
                  Tip: update delivery progress and respond fast to prevent disputes.
                </p>
              </div>
            </div>
          </Card>
        ) : null}

        {!loading && data ? (
          <>
            <div className="rounded-[26px] p-4 text-white shadow-float bg-gradient-to-br from-biz-accent2 to-biz-accent">
              <p className="text-xs opacity-95">Total sales</p>
              <p className="text-2xl font-bold mt-1">{fmtNaira(ov.totalRevenue || 0)}</p>
              <p className="text-xs opacity-95 mt-1">
                Store: <b>{me?.businessSlug || "—"}</b>
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  variant="soft"
                  className="bg-white/15 text-white border border-white/20"
                  leftIcon={<Link2 className="h-4 w-4" />}
                  onClick={copyLink}
                  disabled={!storeUrl}
                >
                  Copy link
                </Button>

                <Button
                  variant="soft"
                  className="bg-white/15 text-white border border-white/20"
                  leftIcon={<StoreIcon className="h-4 w-4" />}
                  onClick={() => router.push(`/b/${me?.businessSlug || ""}`)}
                  disabled={!me?.businessSlug}
                >
                  View store
                </Button>
              </div>
            </div>

            {/* Assistant summary card */}
            {assistant ? (
              <SectionCard
                title="Assistant"
                subtitle="Daily + weekly summary"
                right={
                  assistant?.meta?.limits?.canSendWhatsappSummary ? (
                    <button
                      className="rounded-2xl border border-biz-line bg-white px-3 py-2 text-xs font-bold shadow-soft inline-flex items-center gap-2"
                      onClick={() => window.open(waShareLink(String(assistant.whatsappText || "")), "_blank")}
                    >
                      <MessageCircle className="h-4 w-4 text-gray-700" />
                      WhatsApp
                    </button>
                  ) : null
                }
              >
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-biz-line bg-white p-3">
                    <p className="text-[11px] text-biz-muted">Today</p>
                    <p className="text-sm font-bold text-biz-ink mt-1">
                      {Number(assistant?.today?.orders || 0)} order(s)
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">{fmtNaira(Number(assistant?.today?.revenue || 0))}</p>
                  </div>

                  <div className="rounded-2xl border border-biz-line bg-white p-3">
                    <p className="text-[11px] text-biz-muted">This week</p>
                    <p className="text-sm font-bold text-biz-ink mt-1">
                      {Number(assistant?.week?.orders || 0)} order(s)
                    </p>
                    <p className="text-[11px] text-gray-500 mt-1">{fmtNaira(Number(assistant?.week?.revenue || 0))}</p>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => router.push("/vendor/products")}>
                    Share a product
                  </Button>
                  <Button variant="secondary" onClick={() => router.push("/vendor/orders")}>
                    Manage orders
                  </Button>
                </div>
              </SectionCard>
            ) : assistantMsg ? (
              <Card className="p-4 text-red-700">{assistantMsg}</Card>
            ) : null}

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

            <SectionCard title="Sales trend" subtitle="Last 7 days">
              <div className="flex items-end gap-2 h-28">
                {chartDays.map((d) => {
                  const h = Math.max(6, Math.round((Number(d.revenue || 0) / maxRev) * 100));
                  return (
                    <div key={d.dayKey} className="flex-1 flex flex-col items-center justify-end gap-2">
                      <div
                        className="w-full rounded-xl bg-gradient-to-b from-biz-accent to-biz-accent2"
                        style={{ height: `${h}%` }}
                        title={`${d.label}: ₦${Number(d.revenue || 0).toLocaleString()}`}
                      />
                      <span className="text-[10px] text-gray-500">{String(d.label).slice(8, 10)}</span>
                    </div>
                  );
                })}
              </div>
            </SectionCard>

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
              <p className="mt-3 text-[11px] text-biz-muted">
                Use the <b className="text-biz-ink">Gem</b> icon above to upgrade and unlock more tools.
              </p>
            </SectionCard>

            <SectionCard title="Recent orders" subtitle="Latest activity">
              {recentOrders.length === 0 ? (
                <div className="text-sm text-biz-muted">No orders yet.</div>
              ) : (
                <div className="space-y-2">
                  {recentOrders.slice(0, 6).map((o) => (
                    <button
                      key={o.id}
                      className="w-full text-left rounded-2xl border border-biz-line bg-white p-3 hover:bg-black/[0.02] transition"
                      onClick={() => router.push(`/vendor/orders/${o.id}`)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-biz-ink">Order #{String(o.id).slice(0, 8)}</p>
                          <p className="text-xs text-biz-muted mt-1">
                            {o.paymentType || "—"} • {o.orderStatus || o.escrowStatus || "—"}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-1">Created: {fmtDate(o.createdAt)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-bold text-biz-ink">
                            {fmtNaira(o.amount || (o.amountKobo ? o.amountKobo / 100 : 0))}
                          </p>
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

function TodoRow({
  label,
  value,
  onClick,
}: {
  label: string;
  value: number;
  onClick: () => void;
}) {
  return (
    <button
      className="w-full rounded-2xl border border-biz-line bg-white p-3 flex items-center justify-between hover:bg-black/[0.02] transition"
      onClick={onClick}
    >
      <span className="text-biz-ink">{label}</span>
      <span className="text-xs font-bold text-biz-ink">{value}</span>
    </button>
  );
}