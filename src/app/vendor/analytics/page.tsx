// FILE: src/app/vendor/analytics/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { auth } from "@/lib/firebase/client";

function fmtNaira(n: number) {
  try {
    return `₦${Number(n || 0).toLocaleString()}`;
  } catch {
    return `₦${n}`;
  }
}

export default function VendorAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<any>(null);
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function run() {
      try {
        setLoading(true);
        setMsg(null);

        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error("Not logged in");

        const rMe = await fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } });
        const meData = await rMe.json().catch(() => ({}));
        if (!rMe.ok) throw new Error(meData?.error || "Failed to load profile");
        if (!mounted) return;
        setMe(meData?.me);

        const r = await fetch(`/api/vendor/analytics?range=week`, { headers: { Authorization: `Bearer ${token}` } });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j?.error || "Failed to load analytics");
        if (!mounted) return;

        setData(j);
      } catch (e: any) {
        if (!mounted) return;
        setMsg(e?.message || "Failed to load analytics");
        setData(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    run();
    return () => {
      mounted = false;
    };
  }, []);

  const totals = useMemo(() => {
    const ov = data?.overview || {};
    return {
      revenue: Number(ov.totalRevenue || 0),
      count: Number(ov.orders || 0),
      paid: Number(ov.paystackOrders || 0),
      direct: Number(ov.directOrders || 0),
      disputed: Number(ov.disputedOrders || 0),
      awaiting: Number(ov.awaitingConfirmOrders || 0),
    };
  }, [data]);

  return (
    <div className="min-h-screen">
      <GradientHeader title="Business Analysis" subtitle="Sales, tips, and insights" showBack={true} />

      <div className="px-4 pb-24 space-y-3">
        {loading ? <Card className="p-4">Loading...</Card> : null}
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}

        {!loading && !msg && data ? (
          <>
            <div className="rounded-2xl p-4 text-white shadow-[0_12px_30px_rgba(17,24,39,0.10)] bg-gradient-to-br from-[#FF6A00] to-[#FF8A00]">
              <p className="text-sm font-extrabold">Overview</p>
              <p className="text-xs opacity-95 mt-1">Store: {me?.businessSlug || "—"}</p>
              <p className="text-xl font-extrabold mt-2">{fmtNaira(totals.revenue)}</p>
              <p className="text-xs opacity-95 mt-1">Total revenue (from recorded orders)</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Card className="p-4">
                <p className="text-xs text-gray-600">Orders</p>
                <p className="text-lg font-extrabold text-[#111827] mt-1">{totals.count}</p>
              </Card>

              <Card className="p-4">
                <p className="text-xs text-gray-600">Paystack</p>
                <p className="text-lg font-extrabold text-[#111827] mt-1">{totals.paid}</p>
              </Card>

              <Card className="p-4">
                <p className="text-xs text-gray-600">Bank transfer</p>
                <p className="text-lg font-extrabold text-[#111827] mt-1">{totals.direct}</p>
              </Card>

              <Card className="p-4">
                <p className="text-xs text-gray-600">Disputes</p>
                <p className="text-lg font-extrabold text-[#111827] mt-1">{totals.disputed}</p>
              </Card>
            </div>

            <Card className="p-4">
              <p className="font-extrabold text-[#111827]">Tips to make more sales</p>
              <ul className="mt-2 text-sm text-gray-700 list-disc pl-5 space-y-1">
                <li>Upload 3-5 clear photos per product (front, side, close-up).</li>
                <li>Add variations like Color/Size so customers feel confident.</li>
                <li>Keep stock accurate to avoid cancellations and disputes.</li>
                <li>Reply quickly to delivery/confirmation messages.</li>
              </ul>
            </Card>

            <Card className="p-4">
              <p className="font-extrabold text-[#111827]">Possible mistakes this period</p>
              <p className="text-sm text-gray-600 mt-1">
                These are simple signals BizHub can detect from your orders. Fixing them can increase sales.
              </p>

              <div className="mt-3 space-y-2 text-sm text-gray-700">
                {totals.count === 0 ? (
                  <div className="rounded-2xl border border-[#E7E7EE] p-3">
                    <p className="font-extrabold text-[#111827]">No orders yet</p>
                    <p className="text-xs text-gray-600 mt-1">
                      Add more products + upload clearer photos. Share your store link to customers.
                    </p>
                  </div>
                ) : null}

                {totals.awaiting > 0 ? (
                  <div className="rounded-2xl border border-[#E7E7EE] p-3">
                    <p className="font-extrabold text-[#111827]">Slow confirmations</p>
                    <p className="text-xs text-gray-600 mt-1">
                      <b>{totals.awaiting}</b> order(s) are still awaiting confirmation. Customers may lose trust if orders don’t move fast.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-[#E7E7EE] p-3">
                    <p className="font-extrabold text-[#111827]">Good speed</p>
                    <p className="text-xs text-gray-600 mt-1">You have no "awaiting confirmation" signals right now.</p>
                  </div>
                )}

                {totals.disputed > 0 ? (
                  <div className="rounded-2xl border border-[#E7E7EE] p-3">
                    <p className="font-extrabold text-[#111827]">Disputes risk</p>
                    <p className="text-xs text-gray-600 mt-1">
                      <b>{totals.disputed}</b> order(s) are disputed. Improve photos/descriptions and confirm delivery steps clearly.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-[#E7E7EE] p-3">
                    <p className="font-extrabold text-[#111827]">Healthy record</p>
                    <p className="text-xs text-gray-600 mt-1">No disputes detected. Keep it up.</p>
                  </div>
                )}
              </div>

              <p className="mt-3 text-xs text-gray-500">
                Note: MVP analytics. Next versions will include charts, top products, repeat customers, and week/month comparisons.
              </p>
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