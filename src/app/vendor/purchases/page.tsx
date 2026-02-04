"use client";

import { useEffect, useMemo, useState } from "react";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { auth } from "@/lib/firebase/client";
import { CheckCircle2, ShoppingBag } from "lucide-react";

type BizhubPlanKey = "FREE" | "LAUNCH" | "MOMENTUM" | "APEX";
type AddonCycle = "monthly" | "yearly";

function fmtNaira(n: number) {
  try {
    return `₦${Number(n || 0).toLocaleString("en-NG")}`;
  } catch {
    return `₦${n}`;
  }
}

type CatalogItem = {
  sku: string;
  kind: "item" | "bundle";
  title: string;
  description: string;
  includesSkus?: string[];
  priceNgn: { monthly: number; yearly: number };
  status?: "active" | "paused" | "inactive";
  expiresAtMs?: number;
};

type CatalogResponse = {
  ok: boolean;
  planKey: BizhubPlanKey;
  subscriptionActive: boolean;
  cycleDefault: AddonCycle;
  items: CatalogItem[];
};

export default function VendorPurchasesPage() {
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [cycle, setCycle] = useState<AddonCycle>("yearly");
  const [planKey, setPlanKey] = useState<BizhubPlanKey>("FREE");
  const [subscriptionActive, setSubscriptionActive] = useState(false);

  const [items, setItems] = useState<CatalogItem[]>([]);
  const [buyingSku, setBuyingSku] = useState<string>("");

  async function authedFetch(path: string, init?: RequestInit) {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(path, {
      ...init,
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || data?.code || "Request failed");
    return data;
  }

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const data = (await authedFetch("/api/vendor/purchases/catalog")) as CatalogResponse;
      setPlanKey(data.planKey);
      setSubscriptionActive(!!data.subscriptionActive);
      setCycle(data.cycleDefault || "yearly");
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e: any) {
      setMsg(e?.message || "Failed");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const grouped = useMemo(() => {
    const bundles = items.filter((x) => x.kind === "bundle");
    const singles = items.filter((x) => x.kind === "item");
    return { bundles, singles };
  }, [items]);

  async function buy(sku: string) {
    setBuyingSku(sku);
    setMsg(null);
    try {
      const data = await authedFetch("/api/vendor/purchases/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku, cycle }),
      });

      if (!data?.authorization_url) throw new Error("Failed to start payment");
      window.location.href = String(data.authorization_url);
    } catch (e: any) {
      setMsg(e?.message || "Failed to start purchase");
    } finally {
      setBuyingSku("");
    }
  }

  return (
    <div className="min-h-screen">
      <GradientHeader title="Plan purchases" subtitle="Buy add-ons based on your plan" showBack={true} />

      <div className="px-4 pb-24 space-y-3">
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}
        {loading ? <Card className="p-4">Loading…</Card> : null}

        {!loading ? (
          <>
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-2xl bg-biz-cream flex items-center justify-center">
                  <ShoppingBag className="h-5 w-5 text-orange-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-extrabold text-biz-ink">Your plan: {planKey}</p>
                  <p className="text-[11px] text-biz-muted mt-1">
                    Add-ons pause when your subscription expires and resume when your subscription is active again.
                  </p>
                  {!subscriptionActive ? (
                    <p className="mt-2 text-[11px] font-bold text-orange-700">Subscription is not active right now.</p>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setCycle("yearly")}
                  className={
                    cycle === "yearly"
                      ? "rounded-2xl py-2 text-xs font-extrabold text-white bg-gradient-to-br from-biz-accent2 to-biz-accent shadow-float"
                      : "rounded-2xl py-2 text-xs font-extrabold bg-white border border-biz-line text-biz-ink"
                  }
                >
                  Yearly (best value)
                </button>
                <button
                  type="button"
                  onClick={() => setCycle("monthly")}
                  className={
                    cycle === "monthly"
                      ? "rounded-2xl py-2 text-xs font-extrabold text-white bg-gradient-to-br from-biz-accent2 to-biz-accent shadow-float"
                      : "rounded-2xl py-2 text-xs font-extrabold bg-white border border-biz-line text-gray-500"
                  }
                >
                  Monthly
                </button>
              </div>
            </Card>

            {grouped.bundles.length ? (
              <Card className="p-4">
                <p className="text-sm font-extrabold text-biz-ink">Bundles</p>
                <p className="text-[11px] text-biz-muted mt-1">Bundles are cheaper than buying items separately.</p>

                <div className="mt-3 space-y-2">
                  {grouped.bundles.map((a) => {
                    const price = cycle === "yearly" ? a.priceNgn.yearly : a.priceNgn.monthly;
                    const disabled = buyingSku === a.sku;

                    return (
                      <div key={a.sku} className="rounded-2xl border border-biz-line bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-extrabold text-biz-ink">{a.title}</p>
                            <p className="text-[11px] text-biz-muted mt-1">{a.description}</p>
                            <p className="text-[11px] text-biz-muted mt-2">
                              Includes: <b className="text-biz-ink">{(a.includesSkus || []).length}</b> items
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-extrabold text-biz-ink">{fmtNaira(price)}</p>
                            <p className="text-[11px] text-biz-muted">{cycle}</p>
                          </div>
                        </div>

                        <div className="mt-3">
                          <Button onClick={() => buy(a.sku)} loading={disabled} disabled={disabled}>
                            Buy
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ) : null}

            {grouped.singles.length ? (
              <Card className="p-4">
                <p className="text-sm font-extrabold text-biz-ink">Add-ons</p>
                <div className="mt-3 space-y-2">
                  {grouped.singles.map((a) => {
                    const price = cycle === "yearly" ? a.priceNgn.yearly : a.priceNgn.monthly;
                    const disabled = buyingSku === a.sku;

                    return (
                      <div key={a.sku} className="rounded-2xl border border-biz-line bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-extrabold text-biz-ink">{a.title}</p>
                            <p className="text-[11px] text-biz-muted mt-1">{a.description}</p>
                            {a.status ? (
                              <p className="mt-2 text-[11px] text-biz-muted">
                                Status:{" "}
                                <b className="text-biz-ink">
                                  {a.status.toUpperCase()}
                                  {a.expiresAtMs ? ` • expires: ${new Date(a.expiresAtMs).toLocaleDateString()}` : ""}
                                </b>
                              </p>
                            ) : null}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-extrabold text-biz-ink">{fmtNaira(price)}</p>
                            <p className="text-[11px] text-biz-muted">{cycle}</p>
                          </div>
                        </div>

                        <div className="mt-3">
                          <Button onClick={() => buy(a.sku)} loading={disabled} disabled={disabled}>
                            Buy
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ) : null}

            {!grouped.bundles.length && !grouped.singles.length ? (
              <Card className="p-4">
                <p className="text-sm text-biz-muted">No purchases available on this plan.</p>
              </Card>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}