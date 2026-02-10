// FILE: src/app/vendor/reviews/page.tsx
"use client";

import GradientHeader from "@/components/GradientHeader";
import { VendorReviewsPanel } from "@/components/reviews/VendorReviewsPanel";

export default function VendorReviewsPage() {
  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <GradientHeader
        title="Reviews & Ratings"
        subtitle="How buyers rate your business"
        showBack={true}
      />

      <div className="px-4 pt-4">
        <VendorReviewsPanel />
      </div>
    </div>
  );
}