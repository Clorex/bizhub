// FILE: src/components/reviews/ReviewForm.tsx
"use client";

import { useState } from "react";
import { Send, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ReviewStars } from "./ReviewStars";
import { auth } from "@/lib/firebase/client";
import { toast } from "@/lib/ui/toast";
import { MAX_COMMENT_LENGTH } from "@/lib/reviews/config";

type Props = {
  orderId: string;
  onSuccess?: () => void;
};

export function ReviewForm({ orderId, onSuccess }: Props) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit = rating >= 1 && rating <= 5 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) throw new Error("Please log in to leave a review");

      const body: any = { rating };
      if (comment.trim()) {
        body.comment = comment.trim();
      }

      const r = await fetch(`/api/orders/${encodeURIComponent(orderId)}/review`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await r.json().catch(() => ({}));

      if (!r.ok) throw new Error(data?.error || "Failed to submit review");

      setSubmitted(true);
      toast.success("Thank you for your review!");
      onSuccess?.();
    } catch (e: any) {
      toast.error(e?.message || "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="p-6 text-center bg-green-50 rounded-2xl border border-green-200">
        <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
          <CheckCircle2 className="w-7 h-7 text-green-600" />
        </div>
        <p className="text-base font-bold text-green-800">Review Submitted!</p>
        <p className="text-sm text-green-600 mt-1">
          Your feedback helps improve the marketplace.
        </p>
      </div>
    );
  }

  return (
    <div className="p-5 bg-white rounded-2xl border border-gray-100 space-y-5">
      {/* Header */}
      <div>
        <p className="text-base font-bold text-gray-900">Rate Your Experience</p>
        <p className="text-sm text-gray-500 mt-1">
          Your honest feedback helps vendors improve and buyers make better decisions.
        </p>
      </div>

      {/* Star Rating */}
      <div>
        <p className="text-sm font-medium text-gray-700 mb-2">
          How was your experience? <span className="text-red-500">*</span>
        </p>
        <div className="flex items-center gap-3">
          <ReviewStars rating={rating} size="lg" interactive onRate={setRating} />
          {rating > 0 && (
            <span className="text-sm font-semibold text-amber-600">
              {rating === 5
                ? "Excellent!"
                : rating === 4
                  ? "Good"
                  : rating === 3
                    ? "Average"
                    : rating === 2
                      ? "Poor"
                      : "Very Bad"}
            </span>
          )}
        </div>
      </div>

      {/* Comment */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-gray-700">
            Comment <span className="text-gray-400">(optional)</span>
          </p>
          <span className="text-xs text-gray-400">
            {comment.length}/{MAX_COMMENT_LENGTH}
          </span>
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
          placeholder="Tell us about your experience..."
          rows={3}
          className="w-full px-4 py-3 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent resize-none transition"
        />
      </div>

      {/* Submit */}
      <Button
        onClick={handleSubmit}
        disabled={!canSubmit}
        className="w-full"
        leftIcon={
          submitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )
        }
      >
        {submitting ? "Submitting..." : "Submit Review"}
      </Button>
    </div>
  );
}