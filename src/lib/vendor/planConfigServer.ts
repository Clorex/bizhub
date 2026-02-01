// FILE: src/lib/vendor/planConfigServer.ts
import { adminDb } from "@/lib/firebase/admin";

export type BizhubPlanKey = "FREE" | "LAUNCH" | "MOMENTUM" | "APEX";

export type PlanFeatures = {
  marketplace: boolean;
  storeCustomize: boolean; // ✅ new: free uses BizHub default design
  continueInChat: boolean;
  coupons: boolean;
  assistant: boolean;
  reengagement: boolean;
  staff: boolean;
  promotions: boolean;
  monthAnalytics: boolean;
};

export type PlanLimits = {
  maxProducts: number;
  ordersVisible: number;
  reengagementDaily: number;
  chatOrdersDaily: number;

  staffMax: number;
  couponsMax: number;
  shippingOptionsMax: number;
  promotionsMaxActive: number;
};

export type PlanConfig = {
  plans: Record<BizhubPlanKey, { features: PlanFeatures; limits: PlanLimits }>;
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

function clampInt(n: any, min: number, max: number) {
  const v = Math.floor(Number(n));
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

function cleanFeatures(v: any, fallback: PlanFeatures): PlanFeatures {
  const o = v && typeof v === "object" ? v : {};
  return {
    marketplace: typeof o.marketplace === "boolean" ? o.marketplace : fallback.marketplace,
    storeCustomize: typeof o.storeCustomize === "boolean" ? o.storeCustomize : fallback.storeCustomize,
    continueInChat: typeof o.continueInChat === "boolean" ? o.continueInChat : fallback.continueInChat,
    coupons: typeof o.coupons === "boolean" ? o.coupons : fallback.coupons,
    assistant: typeof o.assistant === "boolean" ? o.assistant : fallback.assistant,
    reengagement: typeof o.reengagement === "boolean" ? o.reengagement : fallback.reengagement,
    staff: typeof o.staff === "boolean" ? o.staff : fallback.staff,
    promotions: typeof o.promotions === "boolean" ? o.promotions : fallback.promotions,
    monthAnalytics: typeof o.monthAnalytics === "boolean" ? o.monthAnalytics : fallback.monthAnalytics,
  };
}

function cleanLimits(v: any, fallback: PlanLimits): PlanLimits {
  const o = v && typeof v === "object" ? v : {};
  return {
    maxProducts: clampInt(o.maxProducts, 0, 200000) || fallback.maxProducts,
    ordersVisible: clampInt(o.ordersVisible, 1, 200000) || fallback.ordersVisible,
    reengagementDaily: clampInt(o.reengagementDaily, 0, 200000),
    chatOrdersDaily: clampInt(o.chatOrdersDaily, 0, 200000),

    staffMax: clampInt(o.staffMax, 0, 1000),
    couponsMax: clampInt(o.couponsMax, 0, 100000),
    shippingOptionsMax: clampInt(o.shippingOptionsMax, 0, 1000),
    promotionsMaxActive: clampInt(o.promotionsMaxActive, 0, 1000),
  };
}

export function fallbackPlanConfig(): PlanConfig {
  return {
    plans: {
      FREE: {
        features: {
          marketplace: false,
          storeCustomize: false,
          continueInChat: false,
          coupons: false,
          assistant: false,
          reengagement: false,
          staff: false,
          promotions: false,
          monthAnalytics: false,
        },
        limits: {
          maxProducts: 25,
          ordersVisible: 20,
          reengagementDaily: 0,
          chatOrdersDaily: 0,

          staffMax: 0,
          couponsMax: 0,
          shippingOptionsMax: 3,
          promotionsMaxActive: 0,
        },
      },

      LAUNCH: {
        features: {
          marketplace: true,
          storeCustomize: true,
          continueInChat: true,
          coupons: true,
          assistant: true,
          reengagement: true,
          staff: true,
          promotions: true,
          monthAnalytics: true,
        },
        limits: {
          maxProducts: 5000,
          ordersVisible: 200,
          reengagementDaily: 20,
          chatOrdersDaily: 500,

          staffMax: 3,
          couponsMax: 200,
          shippingOptionsMax: 50,
          promotionsMaxActive: 5,
        },
      },

      MOMENTUM: {
        features: {
          marketplace: true,
          storeCustomize: true,
          continueInChat: true,
          coupons: true,
          assistant: true,
          reengagement: true,
          staff: true,
          promotions: true,
          monthAnalytics: true,
        },
        limits: {
          maxProducts: 20000,
          ordersVisible: 500,
          reengagementDaily: 60,
          chatOrdersDaily: 2000,

          staffMax: 5,
          couponsMax: 500,
          shippingOptionsMax: 150,
          promotionsMaxActive: 10,
        },
      },

      APEX: {
        features: {
          marketplace: true,
          storeCustomize: true,
          continueInChat: true,
          coupons: true,
          assistant: true,
          reengagement: true,
          staff: true,
          promotions: true,
          monthAnalytics: true,
        },
        limits: {
          maxProducts: 100000,
          ordersVisible: 2000,
          reengagementDaily: 150,
          chatOrdersDaily: 10000,

          staffMax: 10,
          couponsMax: 2000,
          shippingOptionsMax: 300,
          promotionsMaxActive: 20,
        },
      },
    },
  };
}

export async function getPlanConfig(): Promise<PlanConfig> {
  const snap = await adminDb.collection("platform").doc("planConfig").get();
  if (!snap.exists) return fallbackPlanConfig();

  const raw = snap.data() as any;
  const plansRaw = raw?.plans && typeof raw.plans === "object" ? raw.plans : null;
  if (!plansRaw) return fallbackPlanConfig();

  const fallback = fallbackPlanConfig();

  const out: any = { plans: {} as any };

  (["FREE", "LAUNCH", "MOMENTUM", "APEX"] as BizhubPlanKey[]).forEach((k) => {
    const p = plansRaw[k] || plansRaw[String(k).toLowerCase()] || null;
    const fb = fallback.plans[k];

    out.plans[k] = {
      features: cleanFeatures(p?.features, fb.features),
      limits: cleanLimits(p?.limits, fb.limits),
    };
  });

  return out as PlanConfig;
}

export async function getBusinessPlanResolved(businessId: string) {
  const bizSnap = await adminDb.collection("businesses").doc(businessId).get();
  const biz = bizSnap.exists ? (bizSnap.data() as any) : null;

  const hasSub = hasActiveSubscription(biz);
  const planKey = resolvePlanKey(biz);

  const cfg = await getPlanConfig();
  const plan = cfg.plans[planKey] ?? fallbackPlanConfig().plans[planKey];

  return {
    planKey,
    hasActiveSubscription: hasSub,
    features: plan.features,
    limits: plan.limits,
    business: biz,
  };
}