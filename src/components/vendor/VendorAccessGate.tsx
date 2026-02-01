// FILE: src/components/vendor/VendorAccessGate.tsx
"use client";

/**
 * Batch 8 change:
 * - No more hard redirect/lock to subscription screen.
 * - Vendors stay inside the app; features are gated softly/hard-blocked per feature.
 */
export function VendorAccessGate({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}