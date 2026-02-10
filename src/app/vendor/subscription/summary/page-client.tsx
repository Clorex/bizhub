"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { auth } from "@/lib/firebase/client";
import { toast } from "@/lib/ui/toast";
import {
  CheckCircle2,
  Crown,
  AlertCircle,
  RefreshCw,
  Clock,
  CreditCard,
  ArrowLeft,
} from "lucide-react";

type BizhubPlanKey = "FREE" | "LAUNCH" | "MOMENTUM" | "APEX";
type BizhubBillingCycle = "monthly" | "quarterly" | "biannually" | "yearly";
type TabKey = "benefits" | "purchases" | "history";

const NAIRA = "\u20A6";
const BULLET = "\u2022";
const EM_DASH = "\u2014";

function fmtNaira(n: number) {
  const amount = Number(n || 0);
  try {
    return `${NAIRA}${new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(amount)}`;
  } catch {
    return `${NAIRA}${amount}`;
  }
}

function fmtDateTime(ms?: number) {
  if (!ms) return EM_DASH;
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ms);
  }
}

function flattenGroups(groups: Record<string, string[]>) {
  const out: string[] = [];
  for (const [, items] of Object.entries(groups || {})) {
    for (const t of items || []) {
      const s = String(t || "").trim();
      if (s) out.push(s);
    }
  }
  const seen = new Set<string>();
  return out.filter((x) => (seen.has(x) ? false : (seen.add(x), true)));
}

function DetailsList({ groups }: { groups: Record<string, string[]> }) {
  return (
    <div className="space-y-2">
      {Object.entries(groups || {}).map(([k, items]) => (
        <details key={k} className="rounded-2xl border border-gray-100 bg-white p-3 group">
          <summary className="cursor-pointer text-sm font-bold text-gray-900 flex items-center justify-between">
            <span>{k}</span>
            <span className="text-gray-400 text-xs group-open:rotate-90 transition-transform">›</span>
          </summary>
          <div className="mt-2 space-y-2">
            {(items || []).map((t) => (
              <div key={t} className="flex items-start gap-2 text-sm text-gray-700">
                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const s = String(status || "").toLowerCase();
  const map: Record<string, string> = {
    active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
    success: "bg-emerald-50 text-emerald-700 border-emerald-200",
    pending: "bg-yellow-50 text-yellow-700 border-yellow-200",
    failed: "bg-red-50 text-red-700 border-red-200",
    expired: "bg-gray-50 text-gray-600 border-gray-200",
  };
  const cls = map[s] || "bg-gray-50 text-gray-600 border-gray-200";

  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border capitalize ${cls}`}>
      {status || EM_DASH}
    </span>
  );
}

type PlansResponse = {
  ok: boolean;
  plans: Record<
    BizhubPlanKey,
    {
      key: BizhubPlanKey;
      name: string;
      tagline: string;
      recommendedFor?: string;
      priceNgn: Record<BizhubBillingCycle, number>;
      benefits: Record<string, string[]>;
      purchases: Record<string, string[]>;
    }
  >;
};

function niceError(e: any, fallback: string) {
  const m = String(e?.message || "").trim();
  if (!m) return fallback;
  return m.length > 140 ? fallback : m;
}

export default function SubscriptionSummaryPageClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const planFromUrl = String(sp.get("plan") || "LAUNCH").toUpperCase();
  const cycleFromUrl = String(sp.get("cycle") || "yearly").toLowerCase();

  const planKey: BizhubPlanKey = (["FREE", "LAUNCH", "MOMENTUM", "APEX"] as BizhubPlanKey[]).includes(
    planFromUrl as any
  )
    ? (planFromUrl as BizhubPlanKey)
    : "LAUNCH";

  const initialCycle: BizhubBillingCycle = (
    ["monthly", "quarterly", "biannually", "yearly"] as BizhubBillingCycle[]
  ).includes(cycleFromUrl as any)
    ? (cycleFromUrl as BizhubBillingCycle)
    : "yearly";

  const [tab, setTab] = useState<TabKey>("benefits");
  const [cycle, setCycle] = useState<BizhubBillingCycle>(initialCycle);

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [history, setHistory] = useState<any[]>([]);
  const [entitlement, setEntitlement] = useState<any>(null);
  const [plans, setPlans] = useState<PlansResponse["plans"] | null>(null);

  const mountedRef = useRef(true);

  const plan = plans?.[planKey] || null;
  const price = Number(plan?.priceNgn?.[cycle] ?? 0);

  async function authedFetch(path: string, init?: RequestInit) {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error("Please log in again to continue.");

    const r = await fetch(path, {
      ...init,
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || data?.code || "We couldn't complete that request.");
    return data;
  }

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const [plansData, subData] = await Promise.all([
        authedFetch("/api/vendor/plans") as Promise<PlansResponse>,
        authedFetch("/api/subscriptions/my"),
      ]);

      if (!mountedRef.current) return;

      if (!plansData?.ok || !plansData?.plans) throw new Error("Could not load plans. Please try again.");

      setPlans(plansData.plans);
      setHistory(Array.isArray(subData.purchases) ? subData.purchases : []);
      setEntitlement(subData.entitlement || null);
    } catch (e: any) {
      if (!mountedRef.current) return;
      const m = niceError(e, "Could not load subscription details. Please try again.");
      setMsg(m);
      toast.error(m);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    load();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const canPay = planKey !== "FREE" && price > 0;

  async function payNow() {
    if (!canPay) return;

    setPaying(true);
    setMsg(null);
    try {
      const data = await authedFetch("/api/subscriptions/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey, cycle }),
      });

      if (!data?.authorization_url) throw new Error("Could not start payment. Please try again.");

      window.location.href = String(data.authorization_url);
    } catch (e: any) {
      const m = niceError(e, "Could not start payment. Please try again.");
      setMsg(m);
      toast.error(m);
    } finally {
      setPaying(false);
    }
  }

  const entPlanKey = String(entitlement?.planKey || "FREE") as BizhubPlanKey;
  const entExpiry = Number(entitlement?.expiresAtMs || 0);
  const entName = plans?.[entPlanKey]?.name || (entPlanKey === "FREE" ? "Free access" : entPlanKey);

  const headline = useMemo(() => {
    return planKey === "FREE" ? "Free access" : `${plan?.name || planKey}`;
  }, [planKey, plan?.name]);

  const highlights = useMemo(() => {
    const flat = flattenGroups(plan?.benefits || {});
    return flat.slice(0, 4);
  }, [plan]);

  return (
    <div className="min-h-screen bg-gray-50/30">
      <GradientHeader
        title="Summary"
        subtitle="Review and pay"
        showBack={true}
        right={
          <button
            className="flex items-center gap-1.5 rounded-full border border-gray-100 bg-white px-3 py-2 text-xs font-semibold text-gray-600 shadow-sm"
            onClick={() => router.push("/vendor/subscription")}
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Change
          </button>
        }
      />

      <div className="px-4 pb-32 space-y-4">
        {/* Error */}
        {msg ? (
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-red-700">Something went wrong</p>
                <p className="text-xs text-gray-500 mt-0.5">{msg}</p>
              </div>
            </div>
          </Card>
        ) : null}

        {/* Current access */}
        <Card className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50">
              <Crown className="h-5 w-5 text-orange-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500">Current access</p>
              <p className="text-sm font-bold text-gray-900 mt-0.5">
                {loading ? (
                  <span className="inline-block h-4 w-32 rounded bg-gray-100 animate-pulse" />
                ) : (
                  entName
                )}
              </p>
              <p className="text-[11px] text-gray-500 mt-1">
                {loading
                  ? EM_DASH
                  : entPlanKey === "FREE"
                    ? "Upgrade anytime to unlock more tools."
                    : `Active until: ${fmtDateTime(entExpiry)}`}
              </p>
            </div>
          </div>
        </Card>

        {/* Selected plan hero card */}
        {loading ? (
          <div className="rounded-3xl p-5 bg-gray-100 animate-pulse h-48" />
        ) : (
          <div className="rounded-3xl p-5 text-white shadow-sm bg-gradient-to-br from-orange-500 to-orange-600">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs opacity-90">Selected plan</p>
                <p className="text-xl font-black mt-1">{headline}</p>
                <p className="text-[11px] opacity-90 mt-1">{plan?.tagline || ""}</p>
                {plan?.recommendedFor ? (
                  <p className="text-[11px] opacity-90 mt-2">
                    Recommended for: <span className="font-semibold">{plan.recommendedFor}</span>
                  </p>
                ) : null}
              </div>

              <div className="text-right shrink-0">
                <p className="text-lg font-black">{price === 0 ? "Free" : fmtNaira(price)}</p>
                <p className="text-[11px] opacity-90 mt-1 capitalize">{cycle}</p>
              </div>
            </div>

            {highlights.length > 0 ? (
              <div className="mt-4 space-y-2">
                {highlights.map((t) => (
                  <div key={t} className="flex items-start gap-2 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-white/80 shrink-0" />
                    <span className="opacity-90">{t}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        )}

        {/* Billing cycle selector */}
        <SectionCard title="Billing cycle" subtitle="Choose how often you want to pay">
          <SegmentedControl<BizhubBillingCycle>
            value={cycle}
            onChange={setCycle}
            options={[
              { value: "monthly", label: "Monthly" },
              { value: "quarterly", label: "Quarterly" },
              { value: "biannually", label: "Biannual" },
              { value: "yearly", label: "Yearly" },
            ]}
          />
        </SectionCard>

        {/* Tab switcher */}
        <Card className="p-2">
          <div className="grid grid-cols-3 gap-2">
            <button
              className={
                tab === "benefits"
                  ? "rounded-2xl py-2.5 text-xs font-bold text-white bg-gradient-to-br from-orange-500 to-orange-600 shadow-sm"
                  : "rounded-2xl py-2.5 text-xs font-bold bg-white border border-gray-100 text-gray-700"
              }
              onClick={() => setTab("benefits")}
              type="button"
            >
              Benefits
            </button>

            <button
              className={
                tab === "purchases"
                  ? "rounded-2xl py-2.5 text-xs font-bold text-white bg-gradient-to-br from-orange-500 to-orange-600 shadow-sm"
                  : "rounded-2xl py-2.5 text-xs font-bold bg-white border border-gray-100 text-gray-700"
              }
              onClick={() => setTab("purchases")}
              type="button"
            >
              Add-ons
            </button>

            <button
              className={
                tab === "history"
                  ? "rounded-2xl py-2.5 text-xs font-bold text-white bg-gradient-to-br from-orange-500 to-orange-600 shadow-sm"
                  : "rounded-2xl py-2.5 text-xs font-bold bg-white border border-gray-100 text-gray-700"
              }
              onClick={() => setTab("history")}
              type="button"
            >
              History
            </button>
          </div>
        </Card>

        {/* Tab content */}
        <Card className="p-4">
          {tab === "benefits" ? (
            <>
              <div className="flex items-start gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">What's included</p>
                  <p className="text-xs text-gray-500 mt-0.5">Everything you get on this plan</p>
                </div>
              </div>

              {loading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 rounded-2xl bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : (
                <DetailsList groups={plan?.benefits || {}} />
              )}
            </>
          ) : null}

          {tab === "purchases" ? (
            <>
              <div className="flex items-start gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-50">
                  <CreditCard className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">Optional add-ons</p>
                  <p className="text-xs text-gray-500 mt-0.5">Extra tools you can buy later</p>
                </div>
              </div>

              {loading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-12 rounded-2xl bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : Object.keys(plan?.purchases || {}).length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-sm text-gray-500">No add-ons available for this plan.</p>
                </div>
              ) : (
                <DetailsList groups={plan?.purchases || {}} />
              )}
            </>
          ) : null}

          {tab === "history" ? (
            <>
              <div className="flex items-start gap-3 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
                  <Clock className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="font-bold text-gray-900">Payment history</p>
                  <p className="text-xs text-gray-500 mt-0.5">Your recent subscription payments</p>
                </div>
              </div>

              {loading ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => (
                    <div key={i} className="h-20 rounded-2xl bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : history.length === 0 ? (
                <div className="text-center py-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 mx-auto mb-3">
                    <Clock className="h-6 w-6 text-gray-400" />
                  </div>
                  <p className="text-sm font-semibold text-gray-700">No payments yet</p>
                  <p className="text-xs text-gray-500 mt-1">Your payment history will appear here.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {history
                    .slice(0, 20)
                    .sort((a: any, b: any) => Number(b.startedAtMs || 0) - Number(a.startedAtMs || 0))
                    .map((h: any) => (
                      <div key={h.id} className="rounded-2xl border border-gray-100 bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-900">
                              {String(h.planKey || EM_DASH)} {BULLET} {String(h.cycle || EM_DASH)}
                            </p>
                            <p className="text-[11px] text-gray-400 mt-1 break-all font-mono">
                              {String(h.reference || h.id)}
                            </p>
                            <p className="text-[11px] text-gray-500 mt-1">
                              {fmtDateTime(Number(h.startedAtMs || 0))}
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-gray-900">
                              {fmtNaira(
                                Number(h.amount || (h.amountKobo ? h.amountKobo / 100 : 0) || 0)
                              )}
                            </p>
                            <div className="mt-1">
                              <StatusBadge status={String(h.status || "")} />
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </>
          ) : null}
        </Card>

        {/* Spacer for fixed bottom */}
        <div className="h-32" />
      </div>

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div className="mx-auto w-full max-w-[430px] px-4 safe-pb pb-4">
          <Card className="p-4 space-y-2">
            {planKey === "FREE" ? (
              <Button variant="secondary" onClick={() => router.push("/vendor/subscription")}>
                Back to plans
              </Button>
            ) : (
              <Button onClick={payNow} loading={paying} disabled={!canPay || !plan}>
                Pay {fmtNaira(price)}
              </Button>
            )}

            <Button variant="secondary" onClick={() => router.push("/vendor")}>
              Return to dashboard
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}