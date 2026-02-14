"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { SectionCard } from "@/components/ui/SectionCard";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { auth } from "@/lib/firebase/client";
import { CheckCircle2, Crown, AlertCircle, RefreshCw } from "lucide-react";

type BizhubPlanKey = "FREE" | "LAUNCH" | "MOMENTUM" | "APEX";
type BizhubBillingCycle = "monthly" | "quarterly" | "biannually" | "yearly";
type InfoTab = "benefits" | "purchases";

const SUMMARY_PATH = "/vendor/subscription/summary";
const NAIRA = "\u20A6";
const EM_DASH = "\u2014";

function fmtNaira(n: number) {
  const amount = Number(n || 0);
  try {
    return `${NAIRA}${new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(amount)}`;
  } catch {
    return `${NAIRA}${amount}`;
  }
}

function cycleLabel(cycle: BizhubBillingCycle) {
  if (cycle === "monthly") return "Monthly";
  if (cycle === "quarterly") return "Quarterly";
  if (cycle === "biannually") return "Biannual";
  return "Yearly";
}

function cycleSuffix(cycle: BizhubBillingCycle) {
  if (cycle === "monthly") return "/month";
  if (cycle === "quarterly") return "/quarter";
  if (cycle === "biannually") return "/6 months";
  return "/year";
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

function RadioRow(props: {
  selected: boolean;
  title: string;
  subtitle: string;
  right?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={[
        "w-full text-left rounded-2xl border bg-white p-4 transition",
        props.selected ? "border-orange-300 ring-2 ring-orange-100" : "border-gray-100 hover:bg-gray-50/50",
        props.disabled ? "opacity-60 cursor-not-allowed" : "",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div
            className={[
              "mt-1 h-5 w-5 rounded-full border-2 flex items-center justify-center",
              props.selected ? "border-orange-500" : "border-gray-300",
            ].join(" ")}
          >
            {props.selected ? <div className="h-2.5 w-2.5 rounded-full bg-orange-500" /> : null}
          </div>

          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900">{props.title}</p>
            <p className="text-[11px] text-gray-500 mt-1">{props.subtitle}</p>
          </div>
        </div>

        {props.right ? <div className="shrink-0">{props.right}</div> : null}
      </div>
    </button>
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
      features: any;
      limits: any;
    }
  >;
};

export default function VendorSubscriptionPageClient() {
  const router = useRouter();
  const sp = useSearchParams();

  const planFromUrl = String(sp.get("plan") || "LAUNCH").toUpperCase();
  const cycleFromUrl = String(sp.get("cycle") || "yearly").toLowerCase();

  const initialPlan: BizhubPlanKey = (["LAUNCH", "MOMENTUM", "APEX"] as BizhubPlanKey[]).includes(planFromUrl as any)
    ? (planFromUrl as BizhubPlanKey)
    : "LAUNCH";

  const initialCycle: BizhubBillingCycle = (["monthly", "quarterly", "biannually", "yearly"] as BizhubBillingCycle[]).includes(
    cycleFromUrl as any
  )
    ? (cycleFromUrl as BizhubBillingCycle)
    : "yearly";

  const [planKey, setPlanKey] = useState<BizhubPlanKey>(initialPlan);
  const [cycle, setCycle] = useState<BizhubBillingCycle>(initialCycle);
  const [tab, setTab] = useState<InfoTab>("benefits");

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [plans, setPlans] = useState<PlansResponse["plans"] | null>(null);
  const [entitlement, setEntitlement] = useState<any>(null);
  const [showAll, setShowAll] = useState(false);

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
      const [plansData, subData] = await Promise.all([
        authedFetch("/api/vendor/plans") as Promise<PlansResponse>,
        authedFetch("/api/subscriptions/my"),
      ]);

      if (!plansData?.ok || !plansData?.plans) throw new Error("Failed to load plan config");
      setPlans(plansData.plans);
      setEntitlement(subData.entitlement || null);
    } catch (e: any) {
      setMsg(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const plan = plans?.[planKey] || null;
  const price = Number(plan?.priceNgn?.[cycle] ?? 0);

  const entPlanKey = String(entitlement?.planKey || "FREE") as BizhubPlanKey;
  const entExpiry = Number(entitlement?.expiresAtMs || 0);

  const entName =
    plans?.[entPlanKey]?.name || (entPlanKey === "FREE" ? "Free access" : String(entPlanKey || "Free access"));

  const benefitsFlat = useMemo(() => flattenGroups(plan?.benefits || {}), [plan]);
  const purchasesFlat = useMemo(() => flattenGroups(plan?.purchases || {}), [plan]);

  const activeList = tab === "benefits" ? benefitsFlat : purchasesFlat;
  const visibleCount = showAll ? activeList.length : Math.min(activeList.length, 8);
  const visibleList = activeList.slice(0, visibleCount);

  function continueToSummary() {
    router.push(`${SUMMARY_PATH}?plan=${encodeURIComponent(planKey)}&cycle=${encodeURIComponent(cycle)}`);
  }

  return (
    <div className="min-h-screen bg-gray-50/30">
      <GradientHeader
        title="Subscription"
        subtitle="Pick a plan and continue"
        showBack={true}
        right={
          <button
            onClick={load}
            className="flex items-center gap-1.5 rounded-full border border-gray-100 bg-white px-3 py-2 text-xs font-semibold text-gray-600 shadow-sm"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
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
                    : entExpiry
                      ? `Active until: ${new Date(entExpiry).toLocaleString()}`
                      : EM_DASH}
              </p>
            </div>
          </div>
        </Card>

        {/* Plan selector */}
        <SectionCard title="Choose a plan" subtitle="Instant activation after payment.">
          <SegmentedControl<BizhubPlanKey>
            value={planKey}
            onChange={(v) => {
              setPlanKey(v);
              setShowAll(false);
            }}
            options={[
              { value: "LAUNCH", label: "Launch" },
              { value: "MOMENTUM", label: "Momentum" },
              { value: "APEX", label: "Apex" },
            ]}
          />
        </SectionCard>

        {/* Billing cycle options */}
        {loading ? (
          <Card className="p-4 space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-16 rounded-2xl bg-gray-100 animate-pulse" />
            ))}
          </Card>
        ) : plan ? (
          <div className="space-y-2">
            <RadioRow
              selected={cycle === "monthly"}
              title={`${fmtNaira(plan.priceNgn.monthly)} ${cycleSuffix("monthly")}`}
              subtitle={plan.tagline}
              onClick={() => { setCycle("monthly"); setShowAll(false); }}
              right={<span className="text-[11px] font-semibold text-gray-500">{cycleLabel("monthly")}</span>}
            />

            <RadioRow
              selected={cycle === "quarterly"}
              title={`${fmtNaira(plan.priceNgn.quarterly)} ${cycleSuffix("quarterly")}`}
              subtitle={plan.tagline}
              onClick={() => { setCycle("quarterly"); setShowAll(false); }}
              right={<span className="text-[11px] font-semibold text-gray-500">{cycleLabel("quarterly")}</span>}
            />

            <RadioRow
              selected={cycle === "biannually"}
              title={`${fmtNaira(plan.priceNgn.biannually)} ${cycleSuffix("biannually")}`}
              subtitle={plan.tagline}
              onClick={() => { setCycle("biannually"); setShowAll(false); }}
              right={<span className="text-[11px] font-semibold text-gray-500">{cycleLabel("biannually")}</span>}
            />

            <RadioRow
              selected={cycle === "yearly"}
              title={`${fmtNaira(plan.priceNgn.yearly)} ${cycleSuffix("yearly")}`}
              subtitle={plan.tagline}
              onClick={() => { setCycle("yearly"); setShowAll(false); }}
              right={
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-gray-500">{cycleLabel("yearly")}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-50 text-orange-700 border border-orange-200">
                    Popular
                  </span>
                </div>
              }
            />
          </div>
        ) : (
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                <AlertCircle className="h-5 w-5 text-gray-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700">Plans not available</p>
                <p className="text-xs text-gray-500 mt-0.5">Please try refreshing the page.</p>
              </div>
            </div>
          </Card>
        )}

        {/* Benefits / Purchases tabs */}
        <Card className="p-3">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => { setTab("benefits"); setShowAll(false); }}
              className={
                tab === "benefits"
                  ? "rounded-2xl py-2.5 text-xs font-bold text-white bg-gradient-to-br from-orange-500 to-orange-600 shadow-sm"
                  : "rounded-2xl py-2.5 text-xs font-bold bg-white border border-gray-100 text-gray-700"
              }
            >
              Plan benefits
            </button>

            <button
              type="button"
              onClick={() => { setTab("purchases"); setShowAll(false); }}
              className={
                tab === "purchases"
                  ? "rounded-2xl py-2.5 text-xs font-bold text-white bg-gradient-to-br from-orange-500 to-orange-600 shadow-sm"
                  : "rounded-2xl py-2.5 text-xs font-bold bg-white border border-gray-100 text-gray-700"
              }
            >
              Plan purchases
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {visibleList.length === 0 ? (
              <p className="text-sm text-gray-500 py-2">Nothing listed for this section.</p>
            ) : (
              visibleList.map((t) => (
                <div key={t} className="flex items-start gap-2 rounded-2xl border border-gray-100 bg-white p-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                  <span className="text-sm text-gray-700">{t}</span>
                </div>
              ))
            )}
          </div>

          {activeList.length > 8 ? (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-3 text-sm font-bold text-orange-600"
            >
              {showAll ? "Show less" : "Show more"}
            </button>
          ) : null}
        </Card>
      </div>

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <div className="mx-auto w-full max-w-[430px] px-4 safe-pb pb-4">
          <Card className="p-4">
            <Button onClick={continueToSummary} disabled={!plan || loading}>
              Continue ({fmtNaira(price)})
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}