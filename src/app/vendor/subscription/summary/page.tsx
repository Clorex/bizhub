"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { auth } from "@/lib/firebase/client";
import {
  BIZHUB_PLANS,
  type BizhubBillingCycle,
  type BizhubPlanKey,
} from "@/lib/bizhubPlans";
import { CheckCircle2 } from "lucide-react";

type TabKey = "benefits" | "purchases" | "history";

function fmtNaira(n: number) {
  try {
    return `₦${Number(n || 0).toLocaleString()}`;
  } catch {
    return `₦${n}`;
  }
}

function fmtDateTime(ms?: number) {
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleString();
  } catch {
    return String(ms);
  }
}

function DetailsList({
  groups,
}: {
  groups: Record<string, string[]>;
}) {
  return (
    <div className="space-y-2">
      {Object.entries(groups).map(([k, items]) => (
        <details
          key={k}
          className="rounded-2xl border border-biz-line bg-white p-3"
        >
          <summary className="cursor-pointer text-sm font-extrabold text-biz-ink">
            {k}
          </summary>
          <div className="mt-2 space-y-2">
            {items.map((t) => (
              <div key={t} className="flex items-start gap-2 text-sm text-gray-700">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
                <span>{t}</span>
              </div>
            ))}
          </div>
        </details>
      ))}
    </div>
  );
}

export default function SubscriptionSummaryPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const planFromUrl = String(sp.get("plan") || "LAUNCH") as BizhubPlanKey;
  const cycleFromUrl = String(sp.get("cycle") || "yearly") as BizhubBillingCycle;

  const [tab, setTab] = useState<TabKey>("benefits");
  const [cycle, setCycle] = useState<BizhubBillingCycle>(cycleFromUrl);

  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const [history, setHistory] = useState<any[]>([]);
  const [entitlement, setEntitlement] = useState<any>(null);

  const planKey: BizhubPlanKey = (["FREE", "LAUNCH", "MOMENTUM", "APEX"] as BizhubPlanKey[]).includes(planFromUrl)
    ? planFromUrl
    : "LAUNCH";

  const plan = BIZHUB_PLANS[planKey];
  const price = plan.priceNgn[cycle];

  async function authedFetch(path: string, init?: RequestInit) {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(path, {
      ...init,
      headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data?.error || "Request failed");
    return data;
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setMsg(null);
      try {
        const data = await authedFetch("/api/subscriptions/my");
        if (!mounted) return;

        setHistory(Array.isArray(data.purchases) ? data.purchases : []);
        setEntitlement(data.entitlement || null);
      } catch (e: any) {
        if (!mounted) return;
        setMsg(e?.message || "Failed to load");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const headline = useMemo(() => {
    if (planKey === "FREE") return "Free plan";
    return `${plan.name} plan`;
  }, [planKey, plan.name]);

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

      window.location.href = data.authorization_url;
    } catch (e: any) {
      setMsg(e?.message || "Failed to start payment");
    } finally {
      setPaying(false);
    }
  }

  const entPlanKey = String(entitlement?.planKey || "FREE");
  const entSource = String(entitlement?.source || "free");
  const entExpiry = Number(entitlement?.expiresAtMs || 0);

  return (
    <div className="min-h-screen">
      <GradientHeader
        title="Summary"
        subtitle="Review plan details and continue"
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

      <div className="px-4 pb-6 space-y-3">
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}

        {/* Current access banner */}
        <Card className="p-4">
          <p className="text-xs text-biz-muted">Current access</p>
          <p className="text-sm font-extrabold text-biz-ink mt-1">
            {entPlanKey === "FREE" ? "Free plan" : `${BIZHUB_PLANS[entPlanKey as BizhubPlanKey]?.name || entPlanKey} • ${entSource}`}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">
            {entPlanKey === "FREE" ? "Upgrade anytime." : `Expires: ${fmtDateTime(entExpiry)}`}
          </p>
        </Card>

        {/* Plan card */}
        <div className="rounded-[26px] p-4 text-white shadow-float bg-gradient-to-br from-biz-accent2 to-biz-accent">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs opacity-95">Selected plan</p>
              <p className="text-xl font-extrabold mt-1">{headline}</p>
              <p className="text-[11px] opacity-95 mt-1">{plan.tagline}</p>
            </div>

            <div className="text-right">
              <p className="text-sm font-extrabold">
                {price === 0 ? "Free" : fmtNaira(price)}
              </p>
              <p className="text-[11px] opacity-95 mt-1">{cycle}</p>
            </div>
          </div>

          <div className="mt-3 space-y-2">
            {plan.highlights.slice(0, 4).map((t) => (
              <div key={t} className="flex items-start gap-2 text-sm">
                <span className="mt-1 h-2 w-2 rounded-full bg-white/90" />
                <span className="opacity-95">{t}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Cycle selector (like the concept) */}
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

        {/* Tabs */}
        <Card className="p-2">
          <div className="grid grid-cols-3 gap-2">
            <button
              className={tab === "benefits"
                ? "rounded-2xl py-2 text-xs font-extrabold text-white bg-gradient-to-br from-biz-accent2 to-biz-accent shadow-float"
                : "rounded-2xl py-2 text-xs font-extrabold bg-white border border-biz-line text-biz-ink"}
              onClick={() => setTab("benefits")}
            >
              Benefits
            </button>

            <button
              className={tab === "purchases"
                ? "rounded-2xl py-2 text-xs font-extrabold text-white bg-gradient-to-br from-biz-accent2 to-biz-accent shadow-float"
                : "rounded-2xl py-2 text-xs font-extrabold bg-white border border-biz-line text-biz-ink"}
              onClick={() => setTab("purchases")}
            >
              Purchases
            </button>

            <button
              className={tab === "history"
                ? "rounded-2xl py-2 text-xs font-extrabold text-white bg-gradient-to-br from-biz-accent2 to-biz-accent shadow-float"
                : "rounded-2xl py-2 text-xs font-extrabold bg-white border border-biz-line text-biz-ink"}
              onClick={() => setTab("history")}
            >
              History
            </button>
          </div>
        </Card>

        {/* Tab content */}
        <Card className="p-4">
          {tab === "benefits" ? (
            <>
              <p className="font-extrabold text-biz-ink">Plan benefits</p>
              <p className="text-xs text-biz-muted mt-1">
                What’s included in this plan.
              </p>
              <div className="mt-3">
                <DetailsList groups={plan.benefits} />
              </div>
            </>
          ) : null}

          {tab === "purchases" ? (
            <>
              <p className="font-extrabold text-biz-ink">Plan purchases</p>
              <p className="text-xs text-biz-muted mt-1">
                Extras you can add to grow faster.
              </p>
              <div className="mt-3">
                <DetailsList groups={plan.purchases} />
              </div>
            </>
          ) : null}

          {tab === "history" ? (
            <>
              <p className="font-extrabold text-biz-ink">Subscription purchases</p>
              <p className="text-xs text-biz-muted mt-1">
                Your recent subscription payments.
              </p>

              {loading ? (
                <div className="mt-3 text-sm text-biz-muted">Loading…</div>
              ) : history.length === 0 ? (
                <div className="mt-3 text-sm text-biz-muted">
                  No subscription payments yet.
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {history.map((h) => (
                    <div
                      key={h.id}
                      className="rounded-2xl border border-biz-line bg-white p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-extrabold text-biz-ink">
                            {String(h.planKey || "—")} • {String(h.cycle || "—")}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-1 break-all">
                            Ref: {String(h.reference || h.id)}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-1">
                            Started: {fmtDateTime(Number(h.startedAtMs || 0))}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <p className="text-sm font-extrabold text-biz-ink">
                            {fmtNaira(Number(h.amount || (h.amountKobo ? h.amountKobo / 100 : 0) || 0))}
                          </p>
                          <p className="text-[11px] text-gray-500 mt-1">
                            {String(h.status || "—")}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : null}
        </Card>

        {/* Bottom action */}
        <div className="fixed bottom-0 left-0 right-0 z-40">
          <div className="mx-auto w-full max-w-[430px] px-4 safe-pb pb-4">
            <Card className="p-4 space-y-2">
              {planKey === "FREE" ? (
                <Button variant="secondary" onClick={() => router.push("/vendor/subscription")}>
                  Back to plans
                </Button>
              ) : (
                <Button onClick={payNow} loading={paying} disabled={!canPay}>
                  Pay {fmtNaira(price)}
                </Button>
              )}

              <Button variant="secondary" onClick={() => router.push("/vendor")}>
                Return to dashboard
              </Button>
            </Card>
          </div>
        </div>

        {/* Spacer so content not hidden behind fixed CTA */}
        <div className="h-28" />
      </div>
    </div>
  );
}