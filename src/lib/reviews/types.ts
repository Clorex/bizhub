// FILE: src/lib/reviews/types.ts

/**
 * myBizHub — Vendor Review & Rating System
 *
 * Core types for reviews, appeals, and recovery tracking.
 */

/* ------------------------------------------------------------------ */
/*  Review                                                            */
/* ------------------------------------------------------------------ */

export type ReviewStatus = "active" | "under_review" | "removed";

export type Review = {
  /** Firestore doc ID */
  id: string;

  /** The order this review is tied to */
  orderId: string;

  /** Buyer who left the review */
  buyerId: string;

  /** Buyer display name (denormalized for display) */
  buyerName: string;

  /** Vendor business ID */
  businessId: string;

  /** Star rating: 1–5 */
  rating: number;

  /** Optional text comment */
  comment: string | null;

  /** Current status */
  status: ReviewStatus;

  /** Decay weight factor (1.0 = full, 0.5 = minimum) */
  weightFactor: number;

  /** Timestamps */
  createdAt: any;
  updatedAt: any;

  /** Months since creation (computed at read time, not stored) */
  _monthsAge?: number;
};

/* ------------------------------------------------------------------ */
/*  Review Appeal                                                     */
/* ------------------------------------------------------------------ */

export type AppealReason =
  | "abusive_language"
  | "false_claim"
  | "issue_resolved"
  | "buyer_violated_policy"
  | "spam_irrelevant";

export type AppealStatus = "pending" | "review_valid" | "partially_valid" | "review_invalid";

export type ReviewAppeal = {
  /** Firestore doc ID */
  id: string;

  /** The review being appealed */
  reviewId: string;

  /** Order ID (denormalized for admin lookup) */
  orderId: string;

  /** Vendor business ID */
  businessId: string;

  /** Vendor user ID who filed the appeal */
  vendorUid: string;

  /** Reason category */
  reason: AppealReason;

  /** Vendor explanation */
  explanation: string;

  /** Current appeal status */
  status: AppealStatus;

  /** Admin resolution details */
  adminUid?: string;
  adminNotes?: string;
  adminAction?: "restored" | "comment_edited" | "removed" | "rating_adjusted";

  /** Timestamps */
  createdAt: any;
  resolvedAt?: any;
};

/* ------------------------------------------------------------------ */
/*  Vendor Review Summary (stored on business doc)                    */
/* ------------------------------------------------------------------ */

export type VendorReviewSummary = {
  /** Average rating (weighted by decay) */
  averageRating: number;

  /** Raw average (unweighted) */
  rawAverageRating: number;

  /** Total active reviews */
  totalReviews: number;

  /** Rating score for SmartMatch (+20 to -10) */
  ratingScore: number;

  /** Number of appeals filed */
  appealCount: number;

  /** Recovery progress (0–100%) */
  recoveryProgress: number;

  /** Recent trend: "improving" | "stable" | "declining" */
  recentTrend: "improving" | "stable" | "declining";

  /** Last computed timestamp */
  computedAtMs: number;
};

/* ------------------------------------------------------------------ */
/*  Buyer Review Abuse Tracking                                       */
/* ------------------------------------------------------------------ */

export type BuyerReviewProfile = {
  /** Total reviews submitted */
  totalReviews: number;

  /** Reviews flagged/removed by admin */
  removedReviews: number;

  /** Whether review privilege is suspended */
  reviewSuspended: boolean;

  /** Suspension reason */
  suspensionReason?: string;

  /** Last warning timestamp */
  lastWarningAt?: any;
};

/* ------------------------------------------------------------------ */
/*  Admin Review Action Log                                           */
/* ------------------------------------------------------------------ */

export type ReviewActionLog = {
  id: string;
  reviewId: string;
  appealId?: string;
  action: "appeal_filed" | "review_restored" | "comment_edited" | "review_removed" | "rating_adjusted" | "buyer_warned" | "buyer_suspended";
  adminUid?: string;
  vendorUid?: string;
  details?: string;
  timestamp: any;
};