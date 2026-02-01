// FILE: src/lib/vendor/lockServer.ts
import { adminDb } from "@/lib/firebase/admin";
import { computeVendorAccessState } from "@/lib/vendor/access";

export type VendorLockResult = {
  business: any;
  locked: boolean;
  freeEndsAtMs: number | null;
  reason: string;
};

/**
 * Batch 8 change:
 * - Vendor is NEVER locked out of the app for not paying.
 * - This function is kept for backwards compatibility with existing endpoints.
 */
export async function requireVendorUnlocked(businessId: string): Promise<VendorLockResult> {
  const snap = await adminDb.collection("businesses").doc(businessId).get();
  if (!snap.exists) {
    const err: any = new Error("Business not found");
    err.code = "BUSINESS_NOT_FOUND";
    throw err;
  }

  const business = { id: snap.id, ...(snap.data() as any) };
  const state = computeVendorAccessState(business);

  return {
    business,
    locked: false,
    freeEndsAtMs: null,
    reason: state.reason,
  };
}