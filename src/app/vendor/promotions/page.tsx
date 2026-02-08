"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { auth } from "@/lib/firebase/client";
import { toast } from "@/lib/ui/toast";
import { Megaphone, RefreshCw, HelpCircle } from "lucide-react";

function fmtNairaFromKobo(kobo: number) {
  const n = Number(kobo || 0) / 100;
  try {
    return `₦${n.toLocaleString()}`;
  } catch {
    return `₦${n}`;
  }
}

function fmtDate(ms?: number) {
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleDateString();
  } catch {
    return String(ms);
  }
}

function remainingText(endsAtMs: number) {
  if (!endsAtMs) return "—";
  const diff = endsAtMs - Date.now();
  if (diff <= 0) return "Ended";
  const hours = Math.ceil(diff / (60 * 60 * 1000));
  const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
  if (days >= 2) return `${days} days left`;
  return `${hours} hours left`;
}

function StatusPill({ active }: { active: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center px-3 py-1 rounded-full text-[11px] font-bold border",
        active
          ? "bg-emerald-50 text-emerald-700 border-emerald-100"
          : "bg-orange-50 text-orange-700 border-orange-100",
      ].join(" ")}
    >
      {active ? "Active" : "Ended"}
    </span>
  );
}

function niceError(e: any, fallback: string) {
  const m = String(e?.message || "").trim();
  if (!m) return fallback;
  return m.length > 140 ? fallback : m;
}

export default function VendorPromotionsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);

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

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const data = await api("/api/promotions/my");
      setCampaigns(Array.isArray(data.campaigns) ? data.campaigns : []);
    } catch (e: any) {
      const m = niceError(e, "Could not load campaigns. Please try again.");
      setMsg(m);
      setCampaigns([]);
      toast.error(m);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeCount = useMemo(
    () => campaigns.filter((c) => Number(c.endsAtMs || 0) > Date.now()).length,
    [campaigns]
  );

  return (
    <div className="min-h-screen">
      <GradientHeader
        title="Promotions"
        subtitle="Boost your products in the marketplace"
        showBack={true}
        right={
          <button
            className="rounded-2xl border border-biz-line bg-white px-3 py-2 text-xs font-bold shadow-soft inline-flex items-center gap-2"
            onClick={() => router.push("/vendor/promote/faq")}
          >
            <HelpCircle className="h-4 w-4 text-gray-700" />
            Help
          </button>
        }
      />

      <div className="px-4 pb-6 space-y-3">
        {loading ? <Card className="p-4">Loading…</Card> : null}
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}

        {!loading ? (
          <>
            <Card className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-biz-ink">Overview</p>
                  <p className="text-xs text-biz-muted mt-1">
                    Active campaigns: <b className="text-biz-ink">{activeCount}</b>
                  </p>
                </div>

                <Button
                  variant="secondary"
                  size="sm"
                  onClick={load}
                  leftIcon={<RefreshCw className="h-4 w-4" />}
                >
                  Refresh
                </Button>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button onClick={() => router.push("/vendor/promote")} leftIcon={<Megaphone className="h-4 w-4" />}>
                  New campaign
                </Button>
                <Button variant="secondary" onClick={() => router.push("/vendor/products")}>
                  Products
                </Button>
              </div>

              <p className="mt-3 text-[11px] text-biz-muted">
                Promotions increase visibility by showing your products at the top of the marketplace for the duration you choose.
              </p>
            </Card>

            {campaigns.length === 0 ? (
              <EmptyState
                title="No campaigns yet"
                description="Start a campaign to boost your products in the marketplace and reach more buyers."
                ctaLabel="Create campaign"
                onCta={() => router.push("/vendor/promote")}
              />
            ) : (
              <SectionCard title="Your campaigns" subtitle="Tap Renew to run again">
                <div className="space-y-3">
                  {campaigns.map((c) => {
                    const endsAtMs = Number(c.endsAtMs || 0);
                    const startedAtMs = Number(c.startedAtMs || 0);
                    const active = endsAtMs > Date.now();

                    const productIds: string[] = Array.isArray(c.productIds) ? c.productIds : [];
                    const products: any[] = Array.isArray(c.products) ? c.products : [];

                    const daily = Number(c.dailyBudgetKobo || 0);
                    const total = Number(c.totalBudgetKobo || 0);
                    const days = Number(c.days || 0);

                    return (
                      <div key={String(c.reference || c.id)} className="rounded-2xl border border-biz-line bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <StatusPill active={active} />
                              <span className="text-[11px] text-gray-500">{remainingText(endsAtMs)}</span>
                            </div>

                            <p className="mt-2 text-sm font-bold text-biz-ink">
                              {productIds.length} product{productIds.length !== 1 ? "s" : ""} • {days || "—"} day{days !== 1 ? "s" : ""}
                            </p>

                            <p className="text-[11px] text-gray-500 mt-1">
                              Start: {fmtDate(startedAtMs)} • End: {fmtDate(endsAtMs)}
                            </p>

                            <p className="text-[11px] text-gray-500 mt-1">
                              Daily budget: <b className="text-biz-ink">{fmtNairaFromKobo(daily)}</b> • Total:{" "}
                              <b className="text-biz-ink">{fmtNairaFromKobo(total)}</b>
                            </p>
                          </div>

                          <div className="shrink-0">
                            <Button
                              size="sm"
                              onClick={() => {
                                const ids = encodeURIComponent(productIds.join(","));
                                const q = `ids=${ids}&days=${encodeURIComponent(String(days || 2))}&daily=${encodeURIComponent(
                                  String(Math.max(1700, Math.round(daily / 100)))
                                )}`;
                                router.push(`/vendor/promote?${q}`);
                              }}
                            >
                              Renew
                            </Button>
                          </div>
                        </div>

                        {products.length ? (
                          <div className="mt-3 grid grid-cols-5 gap-2">
                            {products.slice(0, 5).map((p) => (
                              <div
                                key={p.id}
                                className="h-12 w-full rounded-2xl bg-biz-cream overflow-hidden border border-black/5"
                              >
                                {p.imageUrl ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" />
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}

                        <p className="mt-3 text-[11px] text-biz-muted break-all">ID: {String(c.reference || c.id)}</p>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}