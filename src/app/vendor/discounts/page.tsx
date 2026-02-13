"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { auth } from "@/lib/firebase/client";

export default function VendorDiscountsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [discounts, setDiscounts] = useState<any[]>([]);
  const [meta, setMeta] = useState<any>(null);
  const [featureLocked, setFeatureLocked] = useState(false);

  async function load() {
    try {
      setLoading(true);
      setMsg(null);
      setFeatureLocked(false);

      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Not logged in");

      const r = await fetch("/api/vendor/discounts", { headers: { Authorization: `Bearer ${token}` } });
      const j = await r.json().catch(() => ({}));

      if (!r.ok) {
        const code = String(j?.code || "");
        if (code === "FEATURE_LOCKED" || code === "VENDOR_LOCKED") {
          setMeta(j?.meta || null);
          setDiscounts([]);
          setFeatureLocked(true);
          setMsg(String(j?.error || "Upgrade to use discounts."));
          return;
        }
        throw new Error(String(j?.error || "Failed to load discounts"));
      }

      setDiscounts(Array.isArray(j?.discounts) ? j.discounts : []);
      setMeta(j?.meta || null);
    } catch (e: any) {
      setMsg(e?.message || "Failed");
      setDiscounts([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Derive plan from API meta — this is the store/business plan, not the viewer
  const planKey = String(meta?.planKey || "").toUpperCase();
  const isLoadingPlan = loading && !meta;

  // Apex vendors should NEVER see upgrade prompts
  const isApexOrAbove = planKey === "APEX";
  // Show upgrade only if we know the plan AND it's not apex AND feature is locked or no discounts
  const shouldShowUpgrade = !isLoadingPlan && !isApexOrAbove && featureLocked;

  return (
    <div className="min-h-screen">
      <GradientHeader title="Sales" subtitle="Discounts on products" showBack={true} />

      <div className="px-4 pb-24 space-y-3">
        {loading ? (
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 rounded-full border-2 border-orange-300 border-t-transparent animate-spin" />
              <span className="text-sm text-gray-500">Loading discounts…</span>
            </div>
          </Card>
        ) : null}

        {msg && !loading ? (
          <Card className="p-4 text-red-700 text-sm">{msg}</Card>
        ) : null}

        {!loading && discounts.length === 0 ? (
          <Card variant="soft" className="p-5">
            <p className="text-sm font-extrabold text-biz-ink">No discounts yet</p>
            <p className="text-xs text-gray-500 mt-1">
              When you create discounts, they will show here.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={() => router.push("/vendor/products")}>
                Products
              </Button>
              {shouldShowUpgrade ? (
                <Button variant="secondary" onClick={() => router.push("/vendor/subscription")}>
                  Upgrade
                </Button>
              ) : null}
            </div>

            {planKey ? (
              <p className="mt-3 text-[11px] text-gray-500">
                Plan: <b className="text-biz-ink">{planKey}</b>
              </p>
            ) : null}
          </Card>
        ) : null}

        {!loading && discounts.length > 0 ? (
          <div className="space-y-2">
            {discounts.map((d: any) => (
              <Card key={String(d.id || d.discountId || JSON.stringify(d))} className="p-4">
                <p className="text-sm font-extrabold text-biz-ink">{d.title || d.name || "Discount"}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {d.active === false ? "Inactive" : "Active"}
                </p>
              </Card>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
