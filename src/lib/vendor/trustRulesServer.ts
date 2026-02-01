// FILE: src/lib/vendor/trustRulesServer.ts
import { adminDb } from "@/lib/firebase/admin";

export type TrustRules = {
  dispute: {
    warnOpenDisputes: number;   // show red warning to vendor
    reduceOpenDisputes: number; // reduce marketplace visibility
  };
};

function clampInt(n: any, min: number, max: number) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

export async function getTrustRules(): Promise<TrustRules> {
  // Stored in platform/trustRules (same collection used by platform/finance)
  const snap = await adminDb.collection("platform").doc("trustRules").get();

  // Safe defaults (only used if doc missing)
  const fallback: TrustRules = {
    dispute: { warnOpenDisputes: 2, reduceOpenDisputes: 4 },
  };

  if (!snap.exists) return fallback;

  const d = snap.data() as any;
  const dispute = d?.dispute || {};

  return {
    dispute: {
      warnOpenDisputes: clampInt(dispute.warnOpenDisputes, 1, 100),
      reduceOpenDisputes: clampInt(dispute.reduceOpenDisputes, 1, 100),
    },
  };
}