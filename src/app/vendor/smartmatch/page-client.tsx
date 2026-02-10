// FILE: src/app/vendor/smartmatch/page-client.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import GradientHeader from "@/components/GradientHeader";
import { Card } from "@/components/Card";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { auth } from "@/lib/firebase/client";
import {
  RefreshCw,
  AlertCircle,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Eye,
  Zap,
  Shield,
  Truck,
  CreditCard,
  Package,
  BarChart3,
  Info,
  ArrowRight,
} from "lucide-react";

type FactorStatus = "good" | "improve" | "bad";

type Insight = {
  factor: string;
  label: string;
  status: FactorStatus;
  value: string;
  tip: string;
};

type ProfileSummary = {
  fulfillmentRate: number;
  avgDeliveryHours: number;
  disputeRate: number;
  totalCompletedOrders: number;
  verificationTier: number;
  apexBadgeActive: boolean;
  stockAccuracyRate: number;
  computedAtMs: number;
};

type SimulatedScore = {
  total: number;
  breakdown: {
    location: number;
    delivery: number;
    reliability: number;
    paymentFit: number;
    vendorQuality: number;
    buyerHistory: number;
    total: number;
  };
};

type InsightsResponse = {
  ok: boolean;
  enabled: boolean;
  message?: string;
  profile?: ProfileSummary;
  insights?: Insight[];
  simulatedScores?: {
    sameLocation: SimulatedScore;
    differentLocation: SimulatedScore;
  };
  summary?: {
    good: number;
    improve: number;
    bad: number;
    overallHealth: "strong" | "moderate" | "needs_work";
  };
  error?: string;
};

const FACTOR_ICONS: Record<string, any> = {
  fulfillment_rate: TrendingUp,
  delivery_speed: Truck,
  dispute_rate: Shield,
  verification: CheckCircle2,
  payment_options: CreditCard,
  stock_accuracy: Package,
};

const STATUS_CONFIG: Record<
  FactorStatus,
  { icon: any; bg: string; text: string; border: string; label: string }
> = {
  good: {
    icon: CheckCircle2,
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    label: "Good",
  },
  improve: {
    icon: AlertTriangle,
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    label: "Improve",
  },
  bad: {
    icon: XCircle,
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-200",
    label: "Needs Work",
  },
};

function HealthBadge({ health }: { health: string }) {
  if (health === "strong") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
        <CheckCircle2 className="h-3.5 w-3.5" />
        Strong visibility
      </span>
    );
  }
  if (health === "moderate") {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
        <AlertTriangle className="h-3.5 w-3.5" />
        Moderate visibility
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
      <XCircle className="h-3.5 w-3.5" />
      Needs improvement
    </span>
  );
}

function ScoreRing({ score, label, size = 80 }: { score: number; label: string; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(100, score));
  const offset = circumference - (progress / 100) * circumference;

  let color = "text-red-500";
  if (progress >= 85) color = "text-emerald-500";
  else if (progress >= 70) color = "text-blue-500";
  else if (progress >= 50) color = "text-amber-500";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={4}
            className="text-gray-100"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={4}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={color}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-black text-gray-900">{score}</span>
        </div>
      </div>
      <p className="text-[11px] text-gray-500 font-medium text-center">{label}</p>
    </div>
  );
}

function BreakdownBar({
  label,
  value,
  max,
}: {
  label: string;
  value: number;
  max: number;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;

  let barColor = "bg-red-400";
  if (pct >= 80) barColor = "bg-emerald-500";
  else if (pct >= 60) barColor = "bg-blue-500";
  else if (pct >= 40) barColor = "bg-amber-500";

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-700">{label}</span>
        <span className="text-xs font-bold text-gray-900">
          {value}/{max}
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function VendorSmartMatchPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<InsightsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function authedFetch(path: string) {
    const token = await auth.currentUser?.getIdToken();
    const r = await fetch(path, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(json?.error || "Request failed");
    return json;
  }

  async function load(isRefresh = false) {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const result = (await authedFetch(
        "/api/vendor/smartmatch/insights"
      )) as InsightsResponse;

      setData(result);

      if (!result.ok) {
        setError(result.error || "Failed to load insights");
      }
    } catch (e: any) {
      setError(e?.message || "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const notEnabled = data?.ok && data?.enabled === false;
  const profile = data?.profile;
  const insights = data?.insights || [];
  const simScores = data?.simulatedScores;
  const summary = data?.summary;

  const lastComputed = profile?.computedAtMs
    ? new Date(profile.computedAtMs).toLocaleString()
    : null;

  return (
    <div className="min-h-screen bg-gray-50/30">
      <GradientHeader
        title="Visibility & Match"
        subtitle="How buyers find your products"
        showBack={true}
        right={
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 rounded-full border border-gray-100 bg-white px-3 py-2 text-xs font-semibold text-gray-600 shadow-sm disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        }
      />

      <div className="px-4 pb-32 space-y-4">
        {/* Error */}
        {error ? (
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50">
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-red-700">
                  Could not load insights
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{error}</p>
              </div>
            </div>
          </Card>
        ) : null}

        {/* Not enabled */}
        {notEnabled ? (
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                <Info className="h-5 w-5 text-gray-400" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-gray-700">
                  Smart Match not enabled
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {data?.message ||
                    "This feature is not yet available on the platform."}
                </p>
              </div>
            </div>
          </Card>
        ) : null}

        {/* Loading skeleton */}
        {loading ? (
          <>
            <div className="h-32 rounded-3xl bg-gray-100 animate-pulse" />
            <div className="h-24 rounded-2xl bg-gray-100 animate-pulse" />
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-20 rounded-2xl bg-gray-100 animate-pulse"
                />
              ))}
            </div>
          </>
        ) : null}

        {/* Main content — only when loaded and enabled */}
        {!loading && data?.ok && data?.enabled ? (
          <>
            {/* Hero: Overall health + simulated scores */}
            <div className="rounded-3xl p-5 text-white shadow-sm bg-gradient-to-br from-orange-500 to-orange-600">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4 opacity-90" />
                    <p className="text-xs opacity-90">Visibility Score</p>
                  </div>
                  <p className="text-2xl font-black mt-1">
                    {simScores?.sameLocation?.total ?? "—"}/100
                  </p>
                  <p className="text-[11px] opacity-90 mt-1">
                    How a buyer in your area sees you
                  </p>
                </div>

                <div className="text-right">
                  {summary ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 justify-end">
                        <CheckCircle2 className="h-3.5 w-3.5 opacity-90" />
                        <span className="text-xs opacity-90">
                          {summary.good} good
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 justify-end">
                        <AlertTriangle className="h-3.5 w-3.5 opacity-90" />
                        <span className="text-xs opacity-90">
                          {summary.improve} to improve
                        </span>
                      </div>
                      {summary.bad > 0 ? (
                        <div className="flex items-center gap-1.5 justify-end">
                          <XCircle className="h-3.5 w-3.5 opacity-90" />
                          <span className="text-xs opacity-90">
                            {summary.bad} critical
                          </span>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Health badge + last computed */}
            <Card className="p-4">
              <div className="flex items-center justify-between">
                {summary ? (
                  <HealthBadge health={summary.overallHealth} />
                ) : null}
                {lastComputed ? (
                  <p className="text-[11px] text-gray-400">
                    Updated: {lastComputed}
                  </p>
                ) : null}
              </div>
            </Card>

            {/* Score comparison */}
            {simScores ? (
              <SectionCard
                title="How buyers see you"
                subtitle="Simulated match scores for different buyer locations"
              >
                <div className="flex items-center justify-around py-2">
                  <ScoreRing
                    score={simScores.sameLocation.total}
                    label="Same location"
                  />
                  <ScoreRing
                    score={simScores.differentLocation.total}
                    label="Different state"
                  />
                </div>

                <div className="mt-4 space-y-2.5">
                  <p className="text-xs font-bold text-gray-700">
                    Score breakdown (same location buyer)
                  </p>
                  <BreakdownBar
                    label="Location match"
                    value={simScores.sameLocation.breakdown.location}
                    max={25}
                  />
                  <BreakdownBar
                    label="Delivery speed"
                    value={simScores.sameLocation.breakdown.delivery}
                    max={15}
                  />
                  <BreakdownBar
                    label="Order reliability"
                    value={simScores.sameLocation.breakdown.reliability}
                    max={25}
                  />
                  <BreakdownBar
                    label="Payment options"
                    value={simScores.sameLocation.breakdown.paymentFit}
                    max={10}
                  />
                  <BreakdownBar
                    label="Vendor quality"
                    value={simScores.sameLocation.breakdown.vendorQuality}
                    max={15}
                  />
                  <BreakdownBar
                    label="Buyer history"
                    value={simScores.sameLocation.breakdown.buyerHistory}
                    max={10}
                  />
                </div>
              </SectionCard>
            ) : null}

            {/* Factor-by-factor insights */}
            <SectionCard
              title="Your visibility factors"
              subtitle="What affects how buyers find you"
            >
              <div className="space-y-2">
                {insights.map((insight) => {
                  const statusCfg = STATUS_CONFIG[insight.status];
                  const FactorIcon =
                    FACTOR_ICONS[insight.factor] || BarChart3;
                  const StatusIcon = statusCfg.icon;

                  return (
                    <div
                      key={insight.factor}
                      className={`rounded-2xl border p-4 ${statusCfg.border} ${statusCfg.bg}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/80 shrink-0">
                          <FactorIcon className="h-5 w-5 text-gray-700" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-bold text-gray-900">
                              {insight.label}
                            </p>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <StatusIcon
                                className={`h-4 w-4 ${statusCfg.text}`}
                              />
                              <span
                                className={`text-xs font-bold ${statusCfg.text}`}
                              >
                                {statusCfg.label}
                              </span>
                            </div>
                          </div>

                          <p className="text-sm font-semibold text-gray-800 mt-1">
                            {insight.value}
                          </p>

                          <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                            {insight.tip}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            {/* Quick stats */}
            {profile ? (
              <SectionCard
                title="Key metrics"
                subtitle="Numbers behind your visibility score"
              >
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl border border-gray-100 bg-white p-3">
                    <p className="text-[11px] text-gray-500">
                      Orders completed
                    </p>
                    <p className="text-lg font-black text-gray-900 mt-0.5">
                      {profile.totalCompletedOrders}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-white p-3">
                    <p className="text-[11px] text-gray-500">
                      Fulfillment rate
                    </p>
                    <p className="text-lg font-black text-gray-900 mt-0.5">
                      {profile.fulfillmentRate}%
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-white p-3">
                    <p className="text-[11px] text-gray-500">
                      Avg delivery
                    </p>
                    <p className="text-lg font-black text-gray-900 mt-0.5">
                      {profile.avgDeliveryHours > 0
                        ? `${Math.round(profile.avgDeliveryHours)}h`
                        : "—"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-white p-3">
                    <p className="text-[11px] text-gray-500">Dispute rate</p>
                    <p className="text-lg font-black text-gray-900 mt-0.5">
                      {profile.disputeRate}%
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-white p-3">
                    <p className="text-[11px] text-gray-500">
                      Stock accuracy
                    </p>
                    <p className="text-lg font-black text-gray-900 mt-0.5">
                      {profile.stockAccuracyRate}%
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-white p-3">
                    <p className="text-[11px] text-gray-500">
                      Verification
                    </p>
                    <p className="text-lg font-black text-gray-900 mt-0.5">
                      {profile.apexBadgeActive
                        ? "Apex"
                        : profile.verificationTier >= 3
                          ? "Address"
                          : profile.verificationTier >= 2
                            ? "ID"
                            : profile.verificationTier >= 1
                              ? "Basic"
                              : "None"}
                    </p>
                  </div>
                </div>
              </SectionCard>
            ) : null}

            {/* How it works explainer */}
            <SectionCard
              title="How Smart Match works"
              subtitle="Your products appear higher when you perform well"
            >
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-50 shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-orange-600">1</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      Buyers search or browse
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      We detect their location, category interest, and
                      preferences automatically.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-50 shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-orange-600">2</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      We score each vendor
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Based on location proximity, delivery speed, fulfillment
                      rate, verification, and more.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-50 shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-orange-600">3</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      Best matches rank higher
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Buyers see a "Best Match" or "Recommended" badge with an
                      explanation of why.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-50 shrink-0 mt-0.5">
                    <span className="text-xs font-bold text-orange-600">4</span>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      Everyone is included
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      Free and paid vendors both benefit. Good behavior is
                      rewarded automatically.
                    </p>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* CTA */}
            <Card className="p-4">
              <p className="text-sm font-bold text-gray-900">
                Improve your visibility
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Focus on the factors marked as "Improve" or "Needs Work" above.
                Small improvements in fulfillment rate and delivery speed have
                the biggest impact.
              </p>

              <div className="mt-3 space-y-2">
                <Button
                  variant="secondary"
                  onClick={() => router.push("/vendor/verification")}
                >
                  <Shield className="h-4 w-4 mr-1.5" />
                  Verify your store
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => router.push("/vendor/orders")}
                >
                  <Zap className="h-4 w-4 mr-1.5" />
                  Manage orders
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => router.push("/vendor/products")}
                >
                  <Package className="h-4 w-4 mr-1.5" />
                  Update stock levels
                </Button>
              </div>
            </Card>
          </>
        ) : null}
      </div>
    </div>
  );
}