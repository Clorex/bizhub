"use client";

import { useEffect, useMemo, useState } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { auth } from "@/lib/firebase/client";
import { Link2, PackagePlus } from "lucide-react";

function fmtNaira(n: number) {
  try {
    return `₦${Number(n || 0).toLocaleString()}`;
  } catch {
    return `₦${n}`;
  }
}

type RangeKey = "today" | "week" | "month";

export default function VendorAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [range, setRange] = useState<RangeKey>("week");

  const storeUrl = useMemo(() => {
    const slug = String(me?.businessSlug || "").trim();
    if (!slug) return "";
    if (typeof window === "undefined") return "";
    return `${window.location.origin}/b/${slug}`;
  }, [me]);

  async function copyStoreLink() {
    try {
      if (!storeUrl) throw new Error("Store link not ready yet.");
      await navigator.clipboard.writeText(storeUrl);
      setMsg("Store link copied.");
      setTimeout(() => setMsg(null), 1200);
    } catch (e: any) {
      setMsg(e?.message || "Copy failed");
      setTimeout(() => setMsg(null), 1200);
    }
  }

  async function load(nextRange?: RangeKey) {
    try {
      setLoading(true);
      setMsg(null);

      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not logged in");

      const rMe = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
      const meData = await rMe.json().catch(() => ({}));
      if (!rMe.ok) throw new Error(meData?.error || "Failed to load profile");
      setMe(meData?.me);

      const used = nextRange || range;
      const r = await fetch(`/api/vendor/analytics?range=${encodeURIComponent(used)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j?.error || "Failed to load analytics");

      const usedRange = String(j?.meta?.usedRange || used) as RangeKey;
      if (usedRange !== range) setRange(usedRange);

      setData(j);
    } catch (e: any) {
      setMsg(e?.message || "Failed to load analytics");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load("week");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const planKey = String(data?.meta?.access?.planKey || "FREE").toUpperCase();
  const tier = Number(data?.meta?.access?.tier || 0);
  const features = data?.meta?.access?.features || {};

  const notice = String(data?.meta?.notice || "");

  const totals = useMemo(() => {
    const ov = data?.overview || {};
    return {
      revenue: Number(ov.totalRevenue || 0),
      count: Number(ov.orders || 0),
      paid: Number(ov.paystackOrders || 0),
      direct: Number(ov.directOrders || 0),
      disputed: Number(ov.disputedOrders || 0),
      awaiting: Number(ov.awaitingConfirmOrders || 0),

      customers: Number(ov.customers || 0),
      productsSold: Number(ov.productsSold || 0),
      visits: Number(ov.visits || 0),
      leads: Number(ov.leads || 0),
      views: Number(ov.views || 0),
    };
  }, [data]);

  const insights = data?.insights || null;
  const comparisons = data?.comparisons || null;

  const canMonth = !!features?.canUseMonthRange;

  const hasAnyTraffic = totals.visits > 0 || totals.views > 0 || totals.leads > 0;
  const hasAnyOrder = totals.count > 0 || totals.revenue > 0;
  const emptyAll = !hasAnyTraffic && !hasAnyOrder;

  return (
    <div className="min-h-screen">
      <GradientHeader title="Business Analysis" subtitle="Sales, tips, and insights" showBack={true} />

      <div className="px-4 pb-24 space-y-3">
        {loading ? <Card className="p-4">Loading...</Card> : null}
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}
        {!loading && notice ? <Card className="p-4 text-orange-700">{notice}</Card> : null}

        {!loading && !msg && data ? (
          <>
            <Card className="p-3">
              <p className="text-sm font-extrabold text-biz-ink">Range</p>
              <p className="text-[11px] text-gray-500 mt-1">
                Plan: <b className="text-biz-ink">{planKey}</b>
              </p>

              <div className="mt-2">
                <SegmentedControl<RangeKey>
                  value={range}
                  onChange={(v) => {
                    setRange(v);
                    load(v);
                  }}
                  options={[
                    { value: "today", label: "Today" },
                    { value: "week", label: "Week" },
                    { value: "month", label: canMonth ? "Month" : "Month (Locked)", disabled: !canMonth },
                  ]}
                />
              </div>

              {!canMonth ? (
                <div className="mt-2">
                  <Button size="sm" onClick={() => (window.location.href = "/vendor/subscription")}>
                    Upgrade for Month
                  </Button>
                </div>
              ) : null}
            </Card>

            {/* ✅ Minimal empty state */}
            {emptyAll ? (
              <Card variant="soft" className="p-5">
                <p className="text-sm font-extrabold text-biz-ink">No activity yet</p>
                <p className="text-xs text-gray-500 mt-1">This page will fill up after visits and orders.</p>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    onClick={() => (window.location.href = "/vendor/products/new")}
                    leftIcon={<PackagePlus className="h-4 w-4" />}
                  >
                    Add product
                  </Button>

                  <Button
                    variant="secondary"
                    onClick={copyStoreLink}
                    disabled={!storeUrl}
                    leftIcon={<Link2 className="h-4 w-4" />}
                  >
                    Copy link
                  </Button>
                </div>
              </Card>
            ) : null}

            {/* Overview hero */}
            <div className="rounded-2xl p-4 text-white shadow-[0_12px_30px_rgba(17,24,39,0.10)] bg-gradient-to-br from-[#FF6A00] to-[#FF8A00]">
              <p className="text-sm font-extrabold">Overview</p>
              <p className="text-xs opacity-95 mt-1">Store: {me?.businessSlug || "—"}</p>
              <p className="text-xl font-extrabold mt-2">{fmtNaira(totals.revenue)}</p>
              <p className="text-xs opacity-95 mt-1">Total revenue (recorded orders)</p>
            </div>

            {/* Minimal helper: traffic but no orders */}
            {!emptyAll && !hasAnyOrder && hasAnyTraffic ? (
              <Card variant="soft" className="p-4">
                <p className="text-sm font-extrabold text-biz-ink">Views are coming in</p>
                <p className="text-xs text-gray-500 mt-1">Try clearer photos and prices to get first orders.</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <Button variant="secondary" onClick={() => (window.location.href = "/vendor/products")}>
                    Products
                  </Button>
                  <Button variant="secondary" onClick={copyStoreLink} disabled={!storeUrl}>
                    Copy link
                  </Button>
                </div>
              </Card>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4">
                <p className="text-xs text-gray-600">Orders</p>
                <p className="text-lg font-extrabold text-[#111827] mt-1">{totals.count}</p>
              </Card>

              <Card className="p-4">
                <p className="text-xs text-gray-600">Disputes</p>
                <p className="text-lg font-extrabold text-[#111827] mt-1">{totals.disputed}</p>
              </Card>

              {tier >= 1 ? (
                <>
                  <Card className="p-4">
                    <p className="text-xs text-gray-600">Paystack</p>
                    <p className="text-lg font-extrabold text-[#111827] mt-1">{totals.paid}</p>
                  </Card>

                  <Card className="p-4">
                    <p className="text-xs text-gray-600">Bank transfer</p>
                    <p className="text-lg font-extrabold text-[#111827] mt-1">{totals.direct}</p>
                  </Card>
                </>
              ) : null}

              {tier >= 2 ? (
                <>
                  <Card className="p-4">
                    <p className="text-xs text-gray-600">Customers</p>
                    <p className="text-lg font-extrabold text-[#111827] mt-1">{totals.customers}</p>
                  </Card>

                  <Card className="p-4">
                    <p className="text-xs text-gray-600">Products sold</p>
                    <p className="text-lg font-extrabold text-[#111827] mt-1">{totals.productsSold}</p>
                  </Card>
                </>
              ) : null}
            </div>

            {/* Keep the rest as-is (already compact) */}
            {tier >= 2 && insights ? (
              <Card className="p-4">
                <p className="font-extrabold text-[#111827]">Insights</p>
                <p className="text-xs text-gray-600 mt-1">Extra signals for growth.</p>

                <div className="mt-3 space-y-2 text-sm text-gray-700">
                  <div className="rounded-2xl border border-[#E7E7EE] p-3">
                    <p className="font-extrabold text-[#111827]">Average order value</p>
                    <p className="text-xs text-gray-600 mt-1">{fmtNaira(Number(insights.aov || 0))}</p>
                  </div>

                  <div className="rounded-2xl border border-[#E7E7EE] p-3">
                    <p className="font-extrabold text-[#111827]">Repeat buyers</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {Number(insights.repeatBuyers || 0)} customer(s) ordered 2+ times.
                    </p>
                  </div>
                </div>
              </Card>
            ) : (
              <Card className="p-4">
                <p className="font-extrabold text-[#111827]">Insights</p>
                <p className="text-xs text-gray-500 mt-1">Locked. Upgrade to Momentum for deeper insights.</p>
                <div className="mt-3">
                  <Button size="sm" onClick={() => (window.location.href = "/vendor/subscription")}>
                    Upgrade
                  </Button>
                </div>
              </Card>
            )}

            {tier >= 3 ? (
              <Card className="p-4">
                <p className="font-extrabold text-[#111827]">Apex analysis</p>
                <p className="text-xs text-gray-600 mt-1">Advanced comparisons.</p>

                {comparisons?.deltas ? (
                  <div className="mt-3 space-y-2 text-sm text-gray-700">
                    <div className="rounded-2xl border border-[#E7E7EE] p-3">
                      <p className="font-extrabold text-[#111827]">Revenue change</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {fmtNaira(Number(comparisons.deltas.revenueDelta || 0))}
                      </p>
                    </div>
                  </div>
                ) : null}
              </Card>
            ) : (
              <Card className="p-4">
                <p className="font-extrabold text-[#111827]">Apex analysis</p>
                <p className="text-xs text-gray-500 mt-1">Locked. Upgrade to Apex.</p>
                <div className="mt-3">
                  <Button size="sm" onClick={() => (window.location.href = "/vendor/subscription")}>
                    Upgrade
                  </Button>
                </div>
              </Card>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}