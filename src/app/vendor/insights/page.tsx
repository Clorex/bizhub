// FILE: src/app/vendor/insights/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  AlertTriangle,
  ArrowUpCircle,
  Loader2,
  RefreshCw,
  BarChart3,
  Eye,
} from "lucide-react";
import GradientHeader from "@/components/GradientHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { auth } from "@/lib/firebase/client";
import { toast } from "@/lib/ui/toast";
import { cn } from "@/lib/cn";

type Insight = {
  factor: string;
  label: string;
  status: "good" | "improve" | "bad";
  value: string;
  tip: string;
};

type Comparison = {
  metric: string;
  yours: string;
  average: string;
};

export default function VendorInsightsPage() {
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [comparison, setComparison] = useState<Comparison[]>([]);
  const [summary, setSummary] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const r = await fetch("/api/vendor/insights", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json().catch(() => ({}));

      if (data.ok) {
        setInsights(data.insights || []);
        setComparison(data.comparison || []);
        setSummary(data.summary || null);
      }
    } catch {
      toast.error("Failed to load insights");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const statusIcon = (s: string) => {
    if (s === "good") return <CheckCircle2 className="w-5 h-5 text-green-500" />;
    if (s === "bad") return <AlertTriangle className="w-5 h-5 text-red-500" />;
    return <ArrowUpCircle className="w-5 h-5 text-amber-500" />;
  };

  const statusBg = (s: string) => {
    if (s === "good") return "bg-green-50 border-green-200";
    if (s === "bad") return "bg-red-50 border-red-200";
    return "bg-amber-50 border-amber-200";
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <GradientHeader
        title="Performance Insights"
        subtitle="Private coaching to improve your visibility"
        showBack={true}
        right={
          <button
            onClick={load}
            className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition"
          >
            <RefreshCw className={cn("w-5 h-5 text-white", loading && "animate-spin")} />
          </button>
        }
      />

      <div className="px-4 pt-4 space-y-4">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
          </div>
        )}

        {!loading && (
          <>
            {/* Intro Card */}
            <div className="p-4 bg-blue-50 rounded-2xl border border-blue-200">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                  <Eye className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-blue-800">
                    What Influences Your Visibility
                  </p>
                  <p className="text-xs text-blue-600 mt-1 leading-relaxed">
                    Your products appear based on verification level, reviews,
                    fulfillment reliability, and product completeness. No exact
                    formula is shown — just focus on the factors below.
                  </p>
                </div>
              </div>
            </div>

            {/* Factor Cards */}
            <SectionCard
              title="Your Factors"
              subtitle="Each factor influences how often buyers see you"
            >
              <div className="space-y-3">
                {insights.map((insight) => (
                  <div
                    key={insight.factor}
                    className={cn(
                      "p-4 rounded-2xl border transition",
                      statusBg(insight.status)
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 shrink-0">{statusIcon(insight.status)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-bold text-gray-900">
                            {insight.label}
                          </p>
                          <span className="text-sm font-bold text-gray-700 shrink-0 ml-2">
                            {insight.value}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                          {insight.tip}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Anonymous Comparison */}
            {comparison.length > 0 && (
              <SectionCard
                title="How You Compare"
                subtitle="Anonymous platform averages — no vendor names shown"
              >
                <div className="space-y-2">
                  {comparison.map((c) => (
                    <div
                      key={c.metric}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200"
                    >
                      <span className="text-sm text-gray-600">{c.metric}</span>
                      <div className="flex items-center gap-4">
                        <div className="text-center">
                          <p className="text-xs text-gray-400">You</p>
                          <p className="text-sm font-bold text-gray-900">{c.yours}</p>
                        </div>
                        <div className="h-6 w-px bg-gray-200" />
                        <div className="text-center">
                          <p className="text-xs text-gray-400">Avg</p>
                          <p className="text-sm font-bold text-gray-500">{c.average}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-3 text-center">
                  Comparisons are anonymous and based on platform-wide averages.
                </p>
              </SectionCard>
            )}
          </>
        )}
      </div>
    </div>
  );
}