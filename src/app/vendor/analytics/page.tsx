"use client";

import { useEffect, useMemo, useState } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { auth } from "@/lib/firebase/client";

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

      // If server downgraded the range (e.g. FREE tried month), reflect it in UI.
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

  return (
    <div className="min-h-screen">
      <GradientHeader title="Business Analysis" subtitle="Sales, tips, and insights" showBack={true} />

      <div className="px-4 pb-24 space-y-3">
        {loading ? <Card className="p-4">Loading...</Card> : null}
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}
        {!loading && notice ? <Card className="p-4 text-orange-700">{notice}</Card> : null}

        {!loading && !msg && data ? (
          <>
            {/* Range selector */}
            <Card className="p-3">
              <p className="text-sm font-extrabold text-biz-ink">Range</p>
              <p className="text-[11px] text-biz-muted mt-1">
                Plan: <b className="text-biz-ink">{planKey}</b>
              </p>

              <div className="mt-2">
                <SegmentedControl<RangeKey>
                  value={range}
                  onChange={(v) => {
                    // If user taps month but plan doesn't allow, server will downgrade anyway
                    setRange(v);
                    load(v);
                  }}
                  options={[
                    { value: "today", label: "Today" },
                    { value: "week", label: "Week" },
                    { value: "month", label: canMonth ? "Month" : "Month (Locked)" },
                  ]}
                />
              </div>

              {!canMonth ? (
                <div className="mt-2">
                  <Button size="sm" onClick={() => (window.location.href = "/vendor/subscription")}>
                    Upgrade to unlock Month analytics
                  </Button>
                </div>
              ) : null}
            </Card>

            {/* Overview hero */}
            <div className="rounded-2xl p-4 text-white shadow-[0_12px_30px_rgba(17,24,39,0.10)] bg-gradient-to-br from-[#FF6A00] to-[#FF8A00]">
              <p className="text-sm font-extrabold">Overview</p>
              <p className="text-xs opacity-95 mt-1">Store: {me?.businessSlug || "—"}</p>
              <p className="text-xl font-extrabold mt-2">{fmtNaira(totals.revenue)}</p>
              <p className="text-xs opacity-95 mt-1">Total revenue (from recorded orders)</p>
            </div>

            {/* Minimal cards for Free, more cards for paid */}
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

            {/* Deep insights section (Momentum+) */}
            {tier >= 2 && insights ? (
              <Card className="p-4">
                <p className="font-extrabold text-[#111827]">Insights</p>
                <p className="text-xs text-gray-600 mt-1">More helpful signals for growing businesses.</p>

                <div className="mt-3 space-y-2 text-sm text-gray-700">
                  <div className="rounded-2xl border border-[#E7E7EE] p-3">
                    <p className="font-extrabold text-[#111827]">Average order value</p>
                    <p className="text-xs text-gray-600 mt-1">{fmtNaira(Number(insights.aov || 0))}</p>
                  </div>

                  <div className="rounded-2xl border border-[#E7E7EE] p-3">
                    <p className="font-extrabold text-[#111827]">Repeat buyers</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {Number(insights.repeatBuyers || 0)} customer(s) ordered 2+ times in this range.
                    </p>
                  </div>

                  {insights.bestDay ? (
                    <div className="rounded-2xl border border-[#E7E7EE] p-3">
                      <p className="font-extrabold text-[#111827]">Best revenue day</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {String(insights.bestDay.label || "")} — {fmtNaira(Number(insights.bestDay.revenue || 0))}
                      </p>
                    </div>
                  ) : null}
                </div>
              </Card>
            ) : (
              <Card className="p-4">
                <p className="font-extrabold text-[#111827]">Insights</p>
                <p className="text-sm text-gray-600 mt-1">
                  Locked. Upgrade to Momentum to unlock deeper insights (AOV, repeat buyers, best day, and more).
                </p>
                <div className="mt-3">
                  <Button size="sm" onClick={() => (window.location.href = "/vendor/subscription")}>
                    Upgrade
                  </Button>
                </div>
              </Card>
            )}

            {/* Apex advanced section */}
            {tier >= 3 ? (
              <Card className="p-4">
                <p className="font-extrabold text-[#111827]">Apex analysis</p>
                <p className="text-xs text-gray-600 mt-1">Advanced comparisons and top performers.</p>

                {comparisons?.deltas ? (
                  <div className="mt-3 space-y-2 text-sm text-gray-700">
                    <div className="rounded-2xl border border-[#E7E7EE] p-3">
                      <p className="font-extrabold text-[#111827]">Revenue change vs previous window</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {fmtNaira(Number(comparisons.deltas.revenueDelta || 0))}{" "}
                        {comparisons.deltas.revenueDeltaPct != null ? `(${Number(comparisons.deltas.revenueDeltaPct).toFixed(1)}%)` : ""}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-[#E7E7EE] p-3">
                      <p className="font-extrabold text-[#111827]">Orders change vs previous window</p>
                      <p className="text-xs text-gray-600 mt-1">
                        {Number(comparisons.deltas.ordersDelta || 0)}{" "}
                        {comparisons.deltas.ordersDeltaPct != null ? `(${Number(comparisons.deltas.ordersDeltaPct).toFixed(1)}%)` : ""}
                      </p>
                    </div>
                  </div>
                ) : null}

                {insights?.topProducts?.length ? (
                  <div className="mt-3">
                    <p className="text-sm font-extrabold text-[#111827]">Top products</p>
                    <div className="mt-2 space-y-2">
                      {insights.topProducts.map((p: any) => (
                        <div key={p.productId} className="rounded-2xl border border-[#E7E7EE] p-3">
                          <p className="text-sm font-extrabold text-[#111827]">{p.name || "Product"}</p>
                          <p className="text-[11px] text-gray-600 mt-1">
                            Qty: {Number(p.qty || 0)} • Revenue: {fmtNaira(Number(p.revenue || 0))}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </Card>
            ) : (
              <Card className="p-4">
                <p className="font-extrabold text-[#111827]">Apex analysis</p>
                <p className="text-sm text-gray-600 mt-1">
                  Locked. Upgrade to Apex to unlock comparisons and top products.
                </p>
                <div className="mt-3">
                  <Button size="sm" onClick={() => (window.location.href = "/vendor/subscription")}>
                    Upgrade
                  </Button>
                </div>
              </Card>
            )}

            {/* Tips (everyone sees, but Free is shorter) */}
            <Card className="p-4">
              <p className="font-extrabold text-[#111827]">Tips to make more sales</p>
              <ul className="mt-2 text-sm text-gray-700 list-disc pl-5 space-y-1">
                <li>Upload 3-5 clear photos per product (front, side, close-up).</li>
                <li>Add variations like Color/Size to reduce questions.</li>
                <li>Keep stock accurate to avoid cancellations and disputes.</li>
                {tier >= 1 ? <li>Use order progress updates to build buyer trust.</li> : null}
                {tier >= 2 ? <li>Follow up with past buyers weekly (re-engagement).</li> : null}
              </ul>
            </Card>

            {/* Simple “mistakes” / signals */}
            <Card className="p-4">
              <p className="font-extrabold text-[#111827]">Signals this period</p>

              <div className="mt-3 space-y-2 text-sm text-gray-700">
                {totals.count === 0 ? (
                  <div className="rounded-2xl border border-[#E7E7EE] p-3">
                    <p className="font-extrabold text-[#111827]">No orders yet</p>
                    <p className="text-xs text-gray-600 mt-1">Add products, improve photos, and share your store link.</p>
                  </div>
                ) : null}

                {totals.awaiting > 0 ? (
                  <div className="rounded-2xl border border-[#E7E7EE] p-3">
                    <p className="font-extrabold text-[#111827]">Slow confirmations</p>
                    <p className="text-xs text-gray-600 mt-1">
                      <b>{totals.awaiting}</b> order(s) are still awaiting confirmation.
                    </p>
                  </div>
                ) : null}

                {totals.disputed > 0 ? (
                  <div className="rounded-2xl border border-[#E7E7EE] p-3">
                    <p className="font-extrabold text-[#111827]">Disputes risk</p>
                    <p className="text-xs text-gray-600 mt-1">
                      <b>{totals.disputed}</b> order(s) are disputed.
                    </p>
                  </div>
                ) : null}
              </div>

              {tier === 0 ? (
                <p className="mt-3 text-xs text-gray-500">
                  Free plan shows limited analytics. Upgrade for deeper insights and comparisons.
                </p>
              ) : null}
            </Card>

            <Card className="p-4">
              <p className="font-extrabold text-[#111827]">Next actions</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  className="rounded-2xl py-3 text-sm font-extrabold text-white bg-gradient-to-br from-[#FF6A00] to-[#FF8A00]"
                  onClick={() => (window.location.href = "/vendor/products/new")}
                >
                  Add product
                </button>
                <button
                  className="rounded-2xl border border-[#E7E7EE] py-3 text-sm font-extrabold"
                  onClick={() => (window.location.href = "/vendor")}
                >
                  Vendor home
                </button>
              </div>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}