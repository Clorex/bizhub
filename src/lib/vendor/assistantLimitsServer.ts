// FILE: src/lib/vendor/assistantLimitsServer.ts
import { adminDb } from "@/lib/firebase/admin";

export type BizhubPlanKey = "FREE" | "LAUNCH" | "MOMENTUM" | "APEX";

export type AssistantLimits = {
  canUseAssistant: boolean;
  canSendWhatsappSummary: boolean;
  canUseShareTemplates: boolean;
};

function hasActiveSubscription(biz: any) {
  const exp = Number(biz?.subscription?.expiresAtMs || 0);
  return !!(biz?.subscription?.planKey && exp && exp > Date.now());
}

function resolvePlanKey(biz: any): BizhubPlanKey {
  if (!hasActiveSubscription(biz)) return "FREE";
  const k = String(biz?.subscription?.planKey || "").toUpperCase();
  if (k === "LAUNCH" || k === "MOMENTUM" || k === "APEX") return k;
  return "LAUNCH";
}

function cleanLimits(v: any): AssistantLimits {
  const obj = v && typeof v === "object" ? v : {};
  return {
    canUseAssistant: !!obj.canUseAssistant,
    canSendWhatsappSummary: !!obj.canSendWhatsappSummary,
    canUseShareTemplates: !!obj.canUseShareTemplates,
  };
}

async function loadLimitsDoc(): Promise<Record<string, AssistantLimits> | null> {
  const snap = await adminDb.collection("platform").doc("assistantLimits").get();
  if (!snap.exists) return null;
  const data = snap.data() as any;
  const plans = data?.plans && typeof data.plans === "object" ? data.plans : null;
  if (!plans) return null;

  const out: Record<string, AssistantLimits> = {};
  for (const [k, v] of Object.entries(plans)) out[String(k).toUpperCase()] = cleanLimits(v);
  return out;
}

export async function getAssistantLimitsResolved(businessId: string) {
  const bizSnap = await adminDb.collection("businesses").doc(businessId).get();
  const biz = bizSnap.exists ? (bizSnap.data() as any) : null;

  const hasSub = hasActiveSubscription(biz);
  const planKey = resolvePlanKey(biz);

  const plans = await loadLimitsDoc();

  // Safe fallback (restrict free, allow paid basic)
  const fallback: Record<BizhubPlanKey, AssistantLimits> = {
    FREE: { canUseAssistant: false, canSendWhatsappSummary: false, canUseShareTemplates: false },
    LAUNCH: { canUseAssistant: true, canSendWhatsappSummary: true, canUseShareTemplates: true },
    MOMENTUM: { canUseAssistant: true, canSendWhatsappSummary: true, canUseShareTemplates: true },
    APEX: { canUseAssistant: true, canSendWhatsappSummary: true, canUseShareTemplates: true },
  };

  const resolved = plans?.[planKey] ?? fallback[planKey];

  return {
    planKey,
    hasActiveSubscription: hasSub,
    limits: resolved,
  };
}