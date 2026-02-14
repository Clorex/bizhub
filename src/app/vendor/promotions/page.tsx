"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { auth } from "@/lib/firebase/client";
import { toast } from "@/lib/ui/toast";
import { cn } from "@/lib/cn";
import { formatMoneyNGN } from "@/lib/money";
import {
  Megaphone,
  RefreshCw,
  HelpCircle,
  Plus,
  Zap,
  Wallet,
  Package,
  Eye,
} from "lucide-react";

function fmtNaira(kobo: number) {
  return formatMoneyNGN(Number(kobo || 0) / 100);
}

function fmtDate(ms?: number) {
  if (!ms) return "\u2014";
  try {
    return new Date(ms).toLocaleDateString();
  } catch {
    return "\u2014";
  }
}

function remainingText(endsAtMs: number) {
  if (!endsAtMs) return "\u2014";
  const diff = endsAtMs - Date.now();
  if (diff <= 0) return "Ended";
  const hours = Math.ceil(diff / (60 * 60 * 1000));
  const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
  if (days >= 2) return `${days} days left`;
  return `${hours}h left`;
}

function niceError(e: any, fallback: string) {
  const m = String(e?.message || "").trim();
  if (!m) return fallback;
  return m.length > 140 ? fallback : m;
}

type Tab = "all" | "active" | "ended";

export default function VendorPromotionsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [tab, setTab] = useState<Tab>("all");

  async function api(path: string, init?: RequestInit) {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Please log in again to continue.");

    const r = await fetch(path, {
      ...init,
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || "We couldn't complete that request.");
    return data;
  }

  async function load(isRefresh = false) {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setMsg(null);
    try {
      const data = await api("/api/promotions/my");
      setCampaigns(Array.isArray(data.campaigns) ? data.campaigns : []);
      if (isRefresh) toast.success("Refreshed!");
    } catch (e: any) {
      const m = niceError(e, "Could not load campaigns. Please try again.");
      setMsg(m);
      setCampaigns([]);
      toast.error(m);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const now = Date.now();

  const activeCampaigns = useMemo(
    () => campaigns.filter((c) => Number(c.endsAtMs || 0) > now),
    [campaigns, now]
  );

  const endedCampaigns = useMemo(
    () => campaigns.filter((c) => Number(c.endsAtMs || 0) <= now),
    [campaigns, now]
  );

  // All promoted product IDs (from active campaigns)
  const promotedProductIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of activeCampaigns) {
      const pids = Array.isArray(c.productIds) ? c.productIds : [];
      for (const id of pids) ids.add(String(id));
    }
    return ids;
  }, [activeCampaigns]);

  // All promoted products with details (from active campaigns)
  const promotedProducts = useMemo(() => {
    const map = new Map<string, any>();
    for (const c of activeCampaigns) {
      const products = Array.isArray(c.products) ? c.products : [];
      for (const p of products) {
        if (p?.id && !map.has(p.id)) map.set(p.id, p);
      }
    }
    return Array.from(map.values());
  }, [activeCampaigns]);

  const totalSpentKobo = useMemo(
    () => campaigns.reduce((s, c) => s + Number(c.totalBudgetKobo || 0), 0),
    [campaigns]
  );

  const filteredCampaigns = useMemo(() => {
    if (tab === "active") return activeCampaigns;
    if (tab === "ended") return endedCampaigns;
    return campaigns;
  }, [tab, campaigns, activeCampaigns, endedCampaigns]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <GradientHeader title="Promotions" subtitle="Loading..." showBack />
        <div className="px-4 pt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 bg-gray-50">
      <GradientHeader
        title="Promotions"
        subtitle="Boost your products in the marketplace"
        showBack
        right={
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push("/vendor/promote/faq")}
              className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition"
              aria-label="Help"
            >
              <HelpCircle className="w-5 h-5 text-white" />
            </button>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={cn("w-5 h-5 text-white", refreshing && "animate-spin")} />
            </button>
          </div>
        }
      />

      <div className="px-4 space-y-4 pt-4">
        {msg && (
          <Card className="p-4 bg-red-50 border-red-200">
            <p className="text-sm text-red-800">{msg}</p>
          </Card>
        )}

        {/* ──────────── Overview Stats - Wallet icon instead of Dollar ──────────── */}
        <div className="grid grid-cols-3 gap-3">
          <OverviewStat
            icon={Zap}
            label="Active"
            value={String(activeCampaigns.length)}
            color="green"
          />
          <OverviewStat
            icon={Package}
            label="Products"
            value={String(promotedProductIds.size)}
            color="orange"
          />
          <OverviewStat
            icon={Wallet}
            label="Total Spent"
            value={fmtNaira(totalSpentKobo)}
            color="blue"
          />
        </div>

        {/* ──────────── Create Campaign CTA - Centered ──────────── */}
        <Card className="p-6 bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <div className="flex flex-col items-center text-center">
            <p className="text-base font-bold">Boost your products</p>
            <p className="text-sm text-orange-100 mt-1">
              Show your products at the top of the marketplace
            </p>
            <Button
              onClick={() => router.push("/vendor/promote")}
              className="mt-4 bg-white text-orange-600 hover:bg-orange-50"
              size="sm"
              leftIcon={<Plus className="w-4 h-4" />}
            >
              New campaign
            </Button>
          </div>
        </Card>

        {/* ──────────── Empty State ──────────── */}
        {campaigns.length === 0 && (
          <Card className="p-6 text-center">
            <div className="flex justify-center mb-3">
              <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center">
                <Megaphone className="w-7 h-7 text-orange-500" />
              </div>
            </div>
            <p className="text-sm font-bold text-gray-900">No campaigns yet</p>
            <p className="text-xs text-gray-500 mt-1.5 max-w-[280px] mx-auto leading-relaxed">
              Boost your products to the top of the marketplace so more buyers discover them.
              Pay per day and choose which products to promote.
            </p>
            <div className="mt-4 flex gap-2 justify-center">
              <Button
                size="sm"
                onClick={() => router.push("/vendor/promote")}
                leftIcon={<Megaphone className="w-4 h-4" />}
              >
                Create campaign
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => router.push("/vendor/promote/faq")}
              >
                Learn more
              </Button>
            </div>
          </Card>
        )}

        {/* ──────────── Promoted Products (from active campaigns) ──────────── */}
        {promotedProducts.length > 0 && (
          <SectionCard
            title="Promoted products"
            subtitle={`${promotedProducts.length} product${promotedProducts.length !== 1 ? "s" : ""} currently boosted`}
          >
            <div className="space-y-2">
              {promotedProducts.map((p) => (
                <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-gray-100 bg-white p-3">
                  <div className="w-12 h-12 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                    {p.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.imageUrl} alt={p.name || "Product"} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-5 h-5 text-gray-300" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate">{p.name || "Product"}</p>
                    <p className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
                      <Zap className="w-3 h-3 text-emerald-500" />
                      Currently promoted
                    </p>
                  </div>
                  <button
                    onClick={() => router.push(`/b/${p.businessSlug || ""}/p/${p.id}`)}
                    className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-0.5 shrink-0"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* ──────────── Campaigns List ──────────── */}
        {campaigns.length > 0 && (
          <SectionCard
            title="Campaigns"
            subtitle={`${campaigns.length} total`}
          >
            {/* Tab filter */}
            <div className="flex gap-2 mb-3">
              {([
                { key: "all" as Tab, label: "All", count: campaigns.length },
                { key: "active" as Tab, label: "Active", count: activeCampaigns.length },
                { key: "ended" as Tab, label: "Ended", count: endedCampaigns.length },
              ]).map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition",
                    tab === key
                      ? "text-white bg-gradient-to-br from-orange-500 to-orange-600 shadow-sm"
                      : "bg-white border border-gray-200 text-gray-700 hover:border-orange-200"
                  )}
                >
                  {label} ({count})
                </button>
              ))}
            </div>

            {filteredCampaigns.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">
                No {tab === "active" ? "active" : tab === "ended" ? "ended" : ""} campaigns.
              </p>
            ) : (
              <div className="space-y-3">
                {filteredCampaigns.map((c) => {
                  const endsAtMs = Number(c.endsAtMs || 0);
                  const startedAtMs = Number(c.startedAtMs || 0);
                  const active = endsAtMs > Date.now();

                  const productIds: string[] = Array.isArray(c.productIds) ? c.productIds : [];
                  const products: any[] = Array.isArray(c.products) ? c.products : [];

                  const daily = Number(c.dailyBudgetKobo || 0);
                  const total = Number(c.totalBudgetKobo || 0);
                  const campaignDays = Number(c.days || 0);

                  return (
                    <div
                      key={String(c.reference || c.id)}
                      className={cn(
                        "rounded-2xl border bg-white p-4 transition",
                        active ? "border-emerald-200" : "border-gray-100"
                      )}
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded-full text-[10px] font-bold",
                              active
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                : "bg-gray-100 text-gray-500 border border-gray-200"
                            )}
                          >
                            {active ? "Active" : "Ended"}
                          </span>
                          {active && (
                            <span className="text-[11px] text-gray-500">{remainingText(endsAtMs)}</span>
                          )}
                        </div>

                        <Button
                          size="sm"
                          variant={active ? "secondary" : "primary"}
                          onClick={() => {
                            const ids = encodeURIComponent(productIds.join(","));
                            const q = `ids=${ids}&days=${encodeURIComponent(String(campaignDays || 2))}&daily=${encodeURIComponent(
                              String(Math.max(1700, Math.round(daily / 100)))
                            )}`;
                            router.push(`/vendor/promote?${q}`);
                          }}
                        >
                          {active ? "Extend" : "Renew"}
                        </Button>
                      </div>

                      {/* Details */}
                      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1">
                        <DetailRow label="Products" value={`${productIds.length}`} />
                        <DetailRow label="Duration" value={`${campaignDays || "\u2014"} day${campaignDays !== 1 ? "s" : ""}`} />
                        <DetailRow label="Daily budget" value={fmtNaira(daily)} />
                        <DetailRow label="Total" value={fmtNaira(total)} />
                        <DetailRow label="Started" value={fmtDate(startedAtMs)} />
                        <DetailRow label="Ends" value={fmtDate(endsAtMs)} />
                      </div>

                      {/* Product thumbnails */}
                      {products.length > 0 && (
                        <div className="mt-3 flex gap-2 overflow-x-auto">
                          {products.slice(0, 6).map((p) => (
                            <div
                              key={p.id}
                              className="w-10 h-10 rounded-xl bg-gray-100 overflow-hidden shrink-0 border border-gray-200"
                            >
                              {p.imageUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Package className="w-4 h-4 text-gray-300" />
                                </div>
                              )}
                            </div>
                          ))}
                          {products.length > 6 && (
                            <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 border border-gray-200">
                              <span className="text-[10px] font-bold text-gray-500">+{products.length - 6}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </SectionCard>
        )}
      </div>
    </div>
  );
}

/* ──────────── Overview Stat ──────────── */

function OverviewStat({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: any;
  label: string;
  value: string;
  color: "green" | "orange" | "blue";
}) {
  const colorStyles = {
    green: "bg-emerald-50 text-emerald-600",
    orange: "bg-orange-50 text-orange-600",
    blue: "bg-blue-50 text-blue-600",
  };

  return (
    <Card className="p-3 text-center">
      <div className={cn("w-9 h-9 rounded-xl flex items-center justify-center mx-auto", colorStyles[color])}>
        <Icon className="w-4.5 h-4.5" />
      </div>
      <p className="text-base font-black text-gray-900 mt-2 truncate">{value}</p>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mt-0.5">{label}</p>
    </Card>
  );
}

/* ──────────── Detail Row ──────────── */

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-gray-400">{label}</span>
      <span className="text-[11px] font-bold text-gray-900">{value}</span>
    </div>
  );
}
