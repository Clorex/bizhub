"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase/client";

import { Card } from "@/components/Card";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SectionCard } from "@/components/ui/SectionCard";
import { BIZHUB_PLANS, type BizhubBillingCycle, type BizhubPlanKey } from "@/lib/bizhubPlans";
import { CheckCircle2, LogOut } from "lucide-react";

function fmtNaira(n: number) {
  try {
    return `₦${Number(n || 0).toLocaleString()}`;
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

const PLAN_ORDER: BizhubPlanKey[] = ["LAUNCH", "MOMENTUM", "APEX"];

export default function VendorSubscriptionPage() {
  const router = useRouter();
  const sp = useSearchParams();
  const lockedMode = sp.get("locked") === "1";

  const [cycle, setCycle] = useState<BizhubBillingCycle>("yearly");
  const [selectedPlan, setSelectedPlan] = useState<BizhubPlanKey>("LAUNCH");

  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [access, setAccess] = useState<any>(null);
  const [my, setMy] = useState<any>(null);

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

  async function load() {
    setLoading(true);
    setMsg(null);
    try {
      const [a, m] = await Promise.all([
        authedFetch("/api/vendor/access"),
        authedFetch("/api/subscriptions/my"),
      ]);

      setAccess(a);
      setMy(m);

      // If currently subscribed, default to that plan
      const entPlan = String(m?.entitlement?.planKey || "FREE") as BizhubPlanKey;
      if (entPlan !== "FREE") setSelectedPlan(entPlan);
    } catch (e: any) {
      setMsg(e?.message || "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function doSignOut() {
    await signOut(auth);
    router.replace("/market");
  }

  async function subscribe() {
    setMsg(null);
    try {
      const data = await authedFetch("/api/subscriptions/initialize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planKey: selectedPlan, cycle }),
      });

      window.location.href = data.authorization_url;
    } catch (e: any) {
      setMsg(e?.message || "Failed to start payment");
    }
  }

  const plan = BIZHUB_PLANS[selectedPlan];
  const price = plan.priceNgn[cycle];

  const freeEndsAtMs = Number(access?.freeEndsAtMs || 0) || null;

  const topHeader = (
    <div className="relative">
      <div className="h-2 w-full bg-gradient-to-r from-biz-accent2 to-biz-accent" />
      <div className="px-4 pt-5 pb-5 bg-gradient-to-b from-biz-sand to-biz-bg">
        <div className="flex items-start justify-between gap-3">
          <button
            onClick={doSignOut}
            className="h-10 w-10 rounded-2xl bg-white border border-biz-line shadow-soft flex items-center justify-center"
            aria-label="Sign out"
            title="Sign out"
          >
            <LogOut className="h-5 w-5 text-gray-700" />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-biz-ink">
              Subscription<span className="text-biz-accent">.</span>
            </h1>
            <p className="text-xs text-biz-muted mt-1">
              {lockedMode ? "Subscribe to continue using BizHub" : "Upgrade your plan"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {topHeader}

      <div className="px-4 pb-6 space-y-3">
        {loading ? <Card className="p-4">Loading…</Card> : null}
        {msg ? <Card className="p-4 text-red-700">{msg}</Card> : null}

        {!loading ? (
          <>
            {lockedMode ? (
              <Card className="p-4">
                <p className="text-sm font-bold text-biz-ink">Free access ended</p>
                <p className="text-xs text-biz-muted mt-1">
                  Your 7‑day restricted access has ended. Subscribe to unlock and continue.
                </p>
                {freeEndsAtMs ? (
                  <p className="text-[11px] text-gray-500 mt-2">
                    Ended on: <b className="text-biz-ink">{fmtDate(freeEndsAtMs)}</b>
                  </p>
                ) : null}
              </Card>
            ) : null}

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

            <SectionCard title="Choose a plan" subtitle="Pay with Paystack • Instant activation">
              <div className="space-y-2">
                {PLAN_ORDER.map((k) => {
                  const p = BIZHUB_PLANS[k];
                  const active = selectedPlan === k;
                  const pPrice = p.priceNgn[cycle];

                  return (
                    <button
                      key={k}
                      className={[
                        "w-full text-left rounded-2xl border p-3 transition",
                        active
                          ? "border-transparent bg-gradient-to-br from-biz-accent2 to-biz-accent text-white shadow-float"
                          : "border-biz-line bg-white hover:bg-black/[0.02]",
                      ].join(" ")}
                      onClick={() => setSelectedPlan(k)}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={active ? "text-sm font-bold" : "text-sm font-bold text-biz-ink"}>
                            {p.name}
                          </p>
                          <p className={active ? "text-[11px] opacity-90 mt-1" : "text-[11px] text-biz-muted mt-1"}>
                            {p.tagline}
                          </p>
                        </div>

                        <div className="text-right shrink-0">
                          <p className={active ? "text-sm font-bold" : "text-sm font-bold text-biz-ink"}>
                            {fmtNaira(pPrice)}
                          </p>
                          <p className={active ? "text-[11px] opacity-90 mt-1" : "text-[11px] text-gray-500 mt-1"}>
                            {cycle}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </SectionCard>

            <SectionCard title="What you get" subtitle="Key benefits">
              <div className="space-y-2">
                {plan.highlights.map((t) => (
                  <div key={t} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5" />
                    <span>{t}</span>
                  </div>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Button onClick={() => router.push(`/vendor/subscription/summary?plan=${encodeURIComponent(selectedPlan)}&cycle=${encodeURIComponent(cycle)}`)}>
                  Continue
                </Button>
                <Button variant="secondary" onClick={subscribe}>
                  Pay now
                </Button>
              </div>

              <p className="mt-3 text-[11px] text-biz-muted">
                In locked mode, only subscription and sign out are available.
              </p>
            </SectionCard>

            {!lockedMode ? (
              <Card className="p-4">
                <Button variant="secondary" onClick={() => router.push("/vendor")}>
                  Back to dashboard
                </Button>
              </Card>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}