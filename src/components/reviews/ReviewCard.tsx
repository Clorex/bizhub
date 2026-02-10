// FILE: src/components/reviews/ReviewCard.tsx
"use client";

import { ReviewStars } from "./ReviewStars";
import { User, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";

type Props = {
  review: {
    id: string;
    buyerName: string;
    rating: number;
    comment: string | null;
    status: string;
    createdAt: any;
  };
  showStatus?: boolean;
};

function formatDate(v: any): string {
  try {
    if (!v) return "";
    let d: Date;
    if (typeof v?.toDate === "function") d = v.toDate();
    else if (typeof v?.seconds === "number") d = new Date(v.seconds * 1000);
    else d = new Date(v);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("en-NG", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "";
  }
}

export function ReviewCard({ review, showStatus = false }: Props) {
  const isUnderReview = review.status === "under_review";
  const isRemoved = review.status === "removed";

  if (isRemoved) return null;

  return (
    <div
      className={cn(
        "p-4 rounded-2xl border transition",
        isUnderReview
          ? "bg-amber-50 border-amber-200"
          : "bg-white border-gray-100"
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center shrink-0">
            <span className="text-sm font-bold text-white">
              {(review.buyerName || "A")[0].toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">
              {review.buyerName || "Anonymous"}
            </p>
            <div className="flex items-center gap-2 mt-0.5">
              <ReviewStars rating={review.rating} size="sm" />
              {formatDate(review.createdAt) && (
                <span className="text-xs text-gray-400">
                  {formatDate(review.createdAt)}
                </span>
              )}
            </div>
          </div>
        </div>

        {showStatus && isUnderReview && (
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">
            <AlertCircle className="w-3 h-3" />
            Under Review
          </span>
        )}
      </div>

      {/* Comment */}
      {review.comment && !isUnderReview && (
        <p className="text-sm text-gray-600 mt-3 leading-relaxed">
          {review.comment}
        </p>
      )}

      {isUnderReview && (
        <p className="text-xs text-amber-600 mt-3 italic">
          This review is being reviewed by our team.
        </p>
      )}
    </div>
  );
}