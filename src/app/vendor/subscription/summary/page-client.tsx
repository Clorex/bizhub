// FILE: src/app/vendor/subscription/summary/page-client.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { auth } from "@/lib/firebase/client";
import { toast } from "@/lib/ui/toast";
import { CheckCircle2 } from "lucide-react";

type BizhubPlanKey = "FREE" | "LAUNCH" | "MOMENTUM" | "APEX";
type BizhubBillingCycle = "monthly" | "quarterly" | "biannually" | "yearly";
type TabKey = "benefits" | "purchases" | "history";

const NAIRA = "\u20A6"; // ₦
const BULLET = "\u2022"; // •
const EM_DASH = "\u2014"; // —

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
        <details key={k} className="rounded-2xl border border-biz-line bg-white p-3">
          <summary className="cursor-pointer text-sm font-extrabold text-biz-ink">{k}</summary>
          <div className="mt-2 space-y-2">
            {(items || []).map((t) => (
              <div key={t} className="flex items-start gap-2 text-sm text-gray-700">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
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

  const planKey: BizhubPlanKey = (["FREE", "LAUNCH", "MOMENTUM", "APEX"] as BizhubPlanKey[]).includes(planFromUrl as any)
    ? (planFromUrl as BizhubPlanKey)
    : "LAUNCH";

  const initialCycle: BizhubBillingCycle = (["monthly", "quarterly", "biannually", "yearly"] as BizhubBillingCycle[]).includes(
    cycleFromUrl as any
  )
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

  useEffect(() => {
    mountedRef.current = true;

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

    load();
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    <div className="min-h-screen">
      <GradientHeader
        title="Summary"
        subtitle="Review and pay"
        showBack={true}
        right={
          <button
            className="rounded-2xl border border-biz-line bg-white px-3 py-2 text-xs font-extrabold shadow-soft"
            onClick={() => router.push("/vendor/subscription")}
          >
            Change
          </button>
        }
      />

      <div className="px-4 pb-24 space-y-3">
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}

        <Card className="p-4">
          <p className="text-xs text-biz-muted">Current access</p>
          <p className="text-sm font-extrabold text-biz-ink mt-1">{loading ? "Loading..." : entName}</p>
          <p className="text-[11px] text-gray-500 mt-1">
            {loading
              ? EM_DASH
              : entPlanKey === "FREE"
                ? "Upgrade anytime to unlock more tools."
                : `Active until: ${fmtDateTime(entExpiry)}`}
          </p>
        </Card>

        <div className="rounded-[26px] p-4 text-white shadow-float bg-gradient-to-br from-biz-accent2 to-biz-accent">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs opacity-95">Selected plan</p>
              <p className="text-xl font-extrabold mt-1">{headline}</p>
              <p className="text-[11px] opacity-95 mt-1">{plan?.tagline || ""}</p>
              {plan?.recommendedFor ? (
                <p className="text-[11px] opacity-95 mt-2">
                  Recommended for: <b>{plan.recommendedFor}</b>
                </p>
              ) : null}
            </div>

            <div className="text-right">
              <p className="text-sm font-extrabold">{price === 0 ? "Free" : fmtNaira(price)}</p>
              <p className="text-[11px] opacity-95 mt-1">{cycle}</p>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {highlights.map((t) => (
              <div key={t} className="flex items-start gap-2 text-sm">
                <span className="mt-1 h-2 w-2 rounded-full bg-white/90 shrink-0" />
                <span className="opacity-95">{t}</span>
              </div>
            ))}
          </div>
        </div>

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

        <Card className="p-2">
          <div className="grid grid-cols-3 gap-2">
            <button
              className={
                tab === "benefits"
                  ? "rounded-2xl py-2 text-xs font-extrabold text-white bg-gradient-to-br from-biz-accent2 to-biz-accent shadow-float"
                  : "rounded-2xl py-2 text-xs font-extrabold bg-white border border-biz-line text-biz-ink"
              }
              onClick={() => setTab("benefits")}
              type="button"
            >
              Benefits
            </button>

            <button
              className={
                tab === "purchases"
                  ? "rounded-2xl py-2 text-xs font-extrabold text-white bg-gradient-to-br from-biz-accent2 to-biz-accent shadow-float"
                  : "rounded-2xl py-2 text-xs font-extrabold bg-white border border-biz-line text-biz-ink"
              }
              onClick={() => setTab("purchases")}
              type="button"
            >
              Add-ons
            </button>

            <button
              className={
                tab === "history"
                  ? "rounded-2xl py-2 text-xs font-extrabold text-white bg-gradient-to-br from-biz-accent2 to-biz-accent shadow-float"
                  : "rounded-2xl py-2 text-xs font-extrabold bg-white border border-biz-line text-biz-ink"
              }
              onClick={() => setTab("history")}
              type="button"
            >
              History
            </button>
          </div>
        </Card>

        <Card className="p-4">
          {tab === "benefits" ? (
            <>
              <p className="font-extrabold text-biz-ink">What's included</p>
              <p className="text-xs text-biz-muted mt-1">Everything you get on this plan</p>
              <div className="mt-3">
                <DetailsList groups={plan?.benefits || {}} />
              </div>
            </>
          ) : null}

          {tab === "purchases" ? (
            <>
              <p className="font-extrabold text-biz-ink">Optional add-ons</p>
              <p className="text-xs text-biz-muted mt-1">Extra tools you can buy later</p>
              <div className="mt-3">
                {Object.keys(plan?.purchases || {}).length === 0 ? (
                  <p className="text-sm text-biz-muted">No add-ons available for this plan.</p>
                ) : (
                  <DetailsList groups={plan?.purchases || {}} />
                )}
              </div>
            </>
          ) : null}

          {tab === "history" ? (
            <>
              <p className="font-extrabold text-biz-ink">Payment history</p>
              <p className="text-xs text-biz-muted mt-1">Your recent subscription payments</p>

              {loading ? (
                <div className="mt-3 text-sm text-biz-muted">Loading…</div>
              ) : history.length === 0 ? (
                <div className="mt-3 text-sm text-biz-muted">No payments yet.</div>
              ) : (
                <div className="mt-3 space-y-2">
                  {history
                    .slice(0, 20)
                    .sort((a: any, b: any) => Number(b.startedAtMs || 0) - Number(a.startedAtMs || 0))
                    .map((h: any) => (
                      <div key={h.id} className="rounded-2xl border border-biz-line bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-sm font-extrabold text-biz-ink">
                              {String(h.planKey || EM_DASH)} {BULLET} {String(h.cycle || EM_DASH)}
                            </p>
                            <p className="text-[11px] text-gray-500 mt-1 break-all">ID: {String(h.reference || h.id)}</p>
                            <p className="text-[11px] text-gray-500 mt-1">Date: {fmtDateTime(Number(h.startedAtMs || 0))}</p>
                          </div>

                          <div className="text-right shrink-0">
                            <p className="text-sm font-extrabold text-biz-ink">
                              {fmtNaira(Number(h.amount || (h.amountKobo ? h.amountKobo / 100 : 0) || 0))}
                            </p>
                            <p className="text-[11px] text-gray-500 mt-1 capitalize">{String(h.status || EM_DASH)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </>
          ) : null}
        </Card>

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

        <div className="h-28" />
      </div>
    </div>
  );
}