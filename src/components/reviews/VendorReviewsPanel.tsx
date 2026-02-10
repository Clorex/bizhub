"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  Loader2,
  MessageSquare,
  Shield,
  RefreshCw,
} from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";
import { ReviewStars } from "./ReviewStars";
import { ReviewCard } from "./ReviewCard";
import { auth } from "@/lib/firebase/client";
import { toast } from "@/lib/ui/toast";
import { cn } from "@/lib/cn";
import { ratingToLabel } from "@/lib/reviews/config";

type ReviewSummary = {
  averageRating: number;
  totalReviews: number;
  ratingScore: number;
  recoveryProgress: number;
  recentTrend: "improving" | "stable" | "declining";
  appealCount: number;
};

export function VendorReviewsPanel() {
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<any[]>([]);
  const [summary, setSummary] = useState<ReviewSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const r = await fetch("/api/vendor/reviews", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json().catch(() => ({}));

      if (data.ok) {
        setReviews(data.reviews || []);
        setSummary(data.summary || null);
      }
    } catch (e: any) {
      toast.error("Failed to load reviews");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const trendIcon = summary?.recentTrend === "improving"
    ? TrendingUp
    : summary?.recentTrend === "declining"
      ? TrendingDown
      : Minus;

  const trendColor = summary?.recentTrend === "improving"
    ? "text-green-600"
    : summary?.recentTrend === "declining"
      ? "text-red-600"
      : "text-gray-500";

  const trendLabel = summary?.recentTrend === "improving"
    ? "Improving"
    : summary?.recentTrend === "declining"
      ? "Declining"
      : "Stable";

  const TrendIcon = trendIcon;

  if (loading) {
    return (
      <SectionCard title="Reviews & Visibility" subtitle="Loading...">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
        </div>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Card */}
      <SectionCard
        title="Your Reviews & Visibility"
        subtitle="How buyers see your business"
        right={
          <button
            onClick={load}
            className="text-xs text-orange-600 font-bold flex items-center gap-1"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        }
      >
        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {/* Average Rating */}
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl p-4 text-center border border-amber-200">
            <div className="flex items-center justify-center mb-1">
              <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
            </div>
            <p className="text-2xl font-black text-amber-700">
              {summary?.averageRating
                ? summary.averageRating.toFixed(1)
                : "—"}
            </p>
            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide mt-0.5">
              {summary?.averageRating
                ? ratingToLabel(summary.averageRating)
                : "No ratings"}
            </p>
          </div>

          {/* Total Reviews */}
          <div className="bg-gray-50 rounded-2xl p-4 text-center border border-gray-200">
            <div className="flex items-center justify-center mb-1">
              <MessageSquare className="w-5 h-5 text-gray-500" />
            </div>
            <p className="text-2xl font-black text-gray-900">
              {summary?.totalReviews ?? 0}
            </p>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mt-0.5">
              Reviews
            </p>
          </div>

          {/* Trend */}
          <div className="bg-gray-50 rounded-2xl p-4 text-center border border-gray-200">
            <div className="flex items-center justify-center mb-1">
              <TrendIcon className={cn("w-5 h-5", trendColor)} />
            </div>
            <p className={cn("text-sm font-black", trendColor)}>
              {trendLabel}
            </p>
            <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mt-0.5">
              Trend
            </p>
          </div>
        </div>

        {/* Visibility Impact */}
        <div className="p-4 bg-blue-50 rounded-2xl border border-blue-200">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <Eye className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-blue-800">
                Visibility Impact
              </p>
              <p className="text-xs text-blue-600 mt-1 leading-relaxed">
                Higher ratings increase how often buyers see your products and
                offers. Deliver quality, respond professionally, and your
                visibility will improve.
              </p>
            </div>
          </div>
        </div>

        {/* Recovery Progress (shown only if below 3.5) */}
        {summary &&
          summary.averageRating > 0 &&
          summary.averageRating < 3.5 &&
          summary.totalReviews >= 5 && (
            <div className="mt-4 p-4 bg-orange-50 rounded-2xl border border-orange-200">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center shrink-0">
                  <Shield className="w-5 h-5 text-orange-600" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-orange-800">
                    Recovery Progress
                  </p>
                  <p className="text-xs text-orange-600 mt-1">
                    Keep delivering great service. Positive reviews will restore
                    your visibility over time.
                  </p>
                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold text-orange-700">
                        Progress
                      </span>
                      <span className="text-[10px] font-bold text-orange-700">
                        {summary.recoveryProgress}%
                      </span>
                    </div>
                    <div className="h-2 bg-orange-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full transition-all duration-500"
                        style={{
                          width: `${Math.min(100, summary.recoveryProgress)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
      </SectionCard>

      {/* Recent Reviews */}
      <SectionCard
        title="Recent Feedback"
        subtitle={`${reviews.length} review${reviews.length !== 1 ? "s" : ""}`}
      >
        {reviews.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">
              No reviews yet
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Reviews will appear here after buyers rate their orders.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.slice(0, 10).map((review: any) => (
              <ReviewCard key={review.id} review={review} showStatus />
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}