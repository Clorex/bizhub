// FILE: src/lib/vendor/limitsServer.ts
import { adminDb } from "@/lib/firebase/admin";

export type BizhubPlanKey = "FREE" | "LAUNCH" | "MOMENTUM" | "APEX";

export type VendorPlanLimits = {
  ordersVisible: number;
  canUpdateStatus: boolean;
  canUseNotes: boolean;
};

export type VendorLimitsResolved = {
  planKey: BizhubPlanKey;
  hasActiveSubscription: boolean;
  limits: VendorPlanLimits;
};

function hasActiveSubscription(biz: any) {
  const exp = Number(biz?.subscription?.expiresAtMs || 0);
  return !!(biz?.subscription?.planKey && exp && exp > Date.now());
}

function resolvePlanKey(biz: any): BizhubPlanKey {
  const subOn = hasActiveSubscription(biz);
  if (!subOn) return "FREE";

  const k = String(biz?.subscription?.planKey || "").toUpperCase();
  if (k === "LAUNCH" || k === "MOMENTUM" || k === "APEX") return k;
  return "LAUNCH";
}

function clampInt(n: any, min: number, max: number) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function cleanLimits(v: any): VendorPlanLimits {
  const obj = v && typeof v === "object" ? v : {};
  return {
    ordersVisible: clampInt(obj.ordersVisible, 1, 2000),
    canUpdateStatus: !!obj.canUpdateStatus,
    canUseNotes: !!obj.canUseNotes,
  };
}

async function loadLimitsDoc(): Promise<Record<string, VendorPlanLimits> | null> {
  // Stored in platform/vendorLimits (same collection used by platform/finance)
  const snap = await adminDb.collection("platform").doc("vendorLimits").get();
  if (!snap.exists) return null;
  const data = snap.data() as any;
  const plans = data?.plans && typeof data.plans === "object" ? data.plans : null;
  if (!plans) return null;

  const out: Record<string, VendorPlanLimits> = {};
  for (const [k, v] of Object.entries(plans)) out[String(k).toUpperCase()] = cleanLimits(v);
  return out;
}

export async function getVendorLimitsResolved(businessId: string): Promise<VendorLimitsResolved> {
  const bizSnap = await adminDb.collection("businesses").doc(businessId).get();
  const biz = bizSnap.exists ? (bizSnap.data() as any) : null;

  const hasSub = hasActiveSubscription(biz);
  const planKey = resolvePlanKey(biz);

  const plans = await loadLimitsDoc();

  // Fail-safe: if config doc missing, behave like FREE (restricted).
  const freeFallback: VendorPlanLimits = { ordersVisible: 10, canUpdateStatus: false, canUseNotes: false };

  const resolved =
    plans?.[planKey] ??
    (planKey !== "FREE" ? plans?.["LAUNCH"] : null) ??
    plans?.["FREE"] ??
    freeFallback;

  return {
    planKey,
    hasActiveSubscription: hasSub,
    limits: resolved,
  };
}