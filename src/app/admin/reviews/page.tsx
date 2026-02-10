// FILE: src/app/admin/reviews/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Shield,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  MessageSquare,
  Star,
  ChevronRight,
  Eye,
} from "lucide-react";
import GradientHeader from "@/components/GradientHeader";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/Button";
import { ReviewStars } from "@/components/reviews/ReviewStars";
import { auth } from "@/lib/firebase/client";
import { toast } from "@/lib/ui/toast";
import { cn } from "@/lib/cn";
import { APPEAL_REASONS } from "@/lib/reviews/config";

type Appeal = {
  id: string;
  reviewId: string;
  orderId: string;
  businessId: string;
  reason: string;
  explanation: string;
  status: string;
  createdAt: any;
};

type ReviewData = {
  id: string;
  buyerName: string;
  rating: number;
  comment: string | null;
  status: string;
  orderId: string;
  businessId: string;
};

export default function AdminReviewsPage() {
  const [loading, setLoading] = useState(true);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [reviewsMap, setReviewsMap] = useState<Record<string, ReviewData>>({});
  const [resolving, setResolving] = useState<string | null>(null);

  // Resolution form state
  const [activeAppeal, setActiveAppeal] = useState<string | null>(null);
  const [decision, setDecision] = useState<string>("");
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) return;

      const r = await fetch("/api/admin/reviews?view=appeals", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await r.json().catch(() => ({}));

      if (data.ok) {
        setAppeals(data.appeals || []);
        setReviewsMap(data.reviewsMap || {});
      }
    } catch {
      toast.error("Failed to load appeals");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = useCallback(
    async (appealId: string, reviewId: string) => {
      if (!decision) {
        toast.error("Please select a decision");
        return;
      }

      setResolving(appealId);
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) throw new Error("Not authenticated");

        const r = await fetch(`/api/admin/reviews/${reviewId}/resolve`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            decision,
            notes: notes.trim() || null,
          }),
        });

        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data?.error || "Failed to resolve");

        toast.success(data.message || "Appeal resolved");
        setActiveAppeal(null);
        setDecision("");
        setNotes("");
        await load();
      } catch (e: any) {
        toast.error(e?.message || "Failed to resolve appeal");
      } finally {
        setResolving(null);
      }
    },
    [decision, notes, load]
  );

  const getReasonLabel = (key: string) =>
    APPEAL_REASONS.find((r) => r.key === key)?.label || key;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <GradientHeader
        title="Review Moderation"
        subtitle={`${appeals.length} pending appeal${appeals.length !== 1 ? "s" : ""}`}
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

        {!loading && appeals.length === 0 && (
          <SectionCard title="All Clear" subtitle="No pending appeals">
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
              <p className="text-sm text-gray-500">
                No review appeals pending. All caught up!
              </p>
            </div>
          </SectionCard>
        )}

        {!loading &&
          appeals.map((appeal) => {
            const review = reviewsMap[appeal.reviewId];
            const isActive = activeAppeal === appeal.id;

            return (
              <SectionCard
                key={appeal.id}
                title={`Appeal: ${getReasonLabel(appeal.reason)}`}
                subtitle={`Order: ${appeal.orderId?.slice(0, 8) || "—"}`}
              >
                {/* Review being appealed */}
                {review && (
                  <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200 mb-4">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                        <span className="text-xs font-bold text-orange-600">
                          {(review.buyerName || "A")[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {review.buyerName || "Anonymous"}
                        </p>
                        <ReviewStars rating={review.rating} size="sm" />
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-sm text-gray-600 mt-2 bg-white p-3 rounded-xl border border-gray-100">
                        "{review.comment}"
                      </p>
                    )}
                  </div>
                )}

                {/* Vendor explanation */}
                <div className="p-4 bg-blue-50 rounded-2xl border border-blue-200 mb-4">
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-wide mb-1">
                    Vendor's Explanation
                  </p>
                  <p className="text-sm text-blue-800">{appeal.explanation}</p>
                </div>

                {/* Resolution form */}
                {!isActive ? (
                  <Button
                    size="sm"
                    onClick={() => setActiveAppeal(appeal.id)}
                    leftIcon={<Shield className="w-4 h-4" />}
                  >
                    Resolve This Appeal
                  </Button>
                ) : (
                  <div className="space-y-4 p-4 bg-white rounded-2xl border border-gray-200">
                    <p className="text-sm font-bold text-gray-900">Make a Decision</p>

                    {/* Decision buttons */}
                    <div className="space-y-2">
                      {[
                        {
                          key: "review_valid",
                          label: "Review is Valid",
                          desc: "Restore the review as-is",
                          icon: CheckCircle2,
                          color: "green",
                        },
                        {
                          key: "partially_valid",
                          label: "Partially Valid",
                          desc: "Edit abusive text, keep rating",
                          icon: Eye,
                          color: "amber",
                        },
                        {
                          key: "review_invalid",
                          label: "Review is Invalid",
                          desc: "Remove review, warn buyer if needed",
                          icon: XCircle,
                          color: "red",
                        },
                      ].map((opt) => {
                        const Icon = opt.icon;
                        const isSelected = decision === opt.key;
                        return (
                          <button
                            key={opt.key}
                            onClick={() => setDecision(opt.key)}
                            className={cn(
                              "w-full flex items-center gap-3 p-3 rounded-xl border transition text-left",
                              isSelected
                                ? `bg-${opt.color}-50 border-${opt.color}-300`
                                : "bg-white border-gray-200 hover:bg-gray-50"
                            )}
                          >
                            <Icon
                              className={cn(
                                "w-5 h-5 shrink-0",
                                isSelected ? `text-${opt.color}-600` : "text-gray-400"
                              )}
                            />
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                {opt.label}
                              </p>
                              <p className="text-xs text-gray-500">{opt.desc}</p>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    {/* Admin notes */}
                    <div>
                      <label className="text-xs font-bold text-gray-700">
                        Admin Notes (optional)
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={2}
                        className="w-full mt-1 px-3 py-2 text-sm rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                        placeholder="Internal notes about this decision..."
                      />
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                      <Button
                        size="sm"
                        onClick={() => resolve(appeal.id, appeal.reviewId)}
                        disabled={!decision || resolving === appeal.id}
                        leftIcon={
                          resolving === appeal.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Shield className="w-4 h-4" />
                          )
                        }
                      >
                        {resolving === appeal.id ? "Resolving..." : "Confirm Decision"}
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setActiveAppeal(null);
                          setDecision("");
                          setNotes("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </SectionCard>
            );
          })}
      </div>
    </div>
  );
}