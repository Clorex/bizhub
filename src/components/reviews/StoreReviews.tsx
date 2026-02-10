// FILE: src/components/reviews/StoreReviews.tsx
"use client";

import { useEffect, useState } from "react";
import { Star, MessageSquare } from "lucide-react";
import { SectionCard } from "@/components/ui/SectionCard";
import { ReviewStars } from "./ReviewStars";
import { ReviewCard } from "./ReviewCard";

type Props = {
  storeSlug: string;
};

export function StoreReviews({ storeSlug }: Props) {
  const [loading, setLoading] = useState(true);
  const [reviews, setReviews] = useState<any[]>([]);
  const [summary, setSummary] = useState<{
    averageRating: number;
    totalReviews: number;
  } | null>(null);

  useEffect(() => {
    if (!storeSlug) return;

    const load = async () => {
      try {
        const r = await fetch(
          `/api/public/store/${encodeURIComponent(storeSlug)}/reviews`
        );
        const data = await r.json().catch(() => ({}));
        if (data.ok) {
          setReviews(data.reviews || []);
          setSummary(data.summary || null);
        }
      } catch {
        // Silent fail — reviews are supplementary
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [storeSlug]);

  if (loading) return null;
  if (!summary && reviews.length === 0) return null;

  return (
    <SectionCard
      title="Customer Reviews"
      subtitle={
        summary
          ? `${summary.averageRating.toFixed(1)} ★ · ${summary.totalReviews} review${summary.totalReviews !== 1 ? "s" : ""}`
          : undefined
      }
    >
      {/* Summary Bar */}
      {summary && summary.totalReviews > 0 && (
        <div className="flex items-center gap-4 p-4 bg-amber-50 rounded-2xl border border-amber-200 mb-4">
          <div className="text-center">
            <p className="text-3xl font-black text-amber-700">
              {summary.averageRating.toFixed(1)}
            </p>
            <ReviewStars rating={summary.averageRating} size="sm" />
          </div>
          <div className="h-12 w-px bg-amber-200" />
          <div>
            <p className="text-sm font-bold text-amber-800">
              {summary.totalReviews} Review{summary.totalReviews !== 1 ? "s" : ""}
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              From verified buyers
            </p>
          </div>
        </div>
      )}

      {/* Reviews List */}
      {reviews.length > 0 ? (
        <div className="space-y-3">
          {reviews.slice(0, 5).map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      ) : (
        <div className="text-center py-6">
          <MessageSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">No reviews yet</p>
        </div>
      )}
    </SectionCard>
  );
}