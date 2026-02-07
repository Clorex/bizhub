// FILE: src/lib/vendor/planConfigServer.ts
import { adminDb } from "@/lib/firebase/admin";

export type BizhubPlanKey = "FREE" | "LAUNCH" | "MOMENTUM" | "APEX";

export type PlanFeatures = {
  marketplace: boolean;
  storeCustomize: boolean;
  continueInChat: boolean;
  coupons: boolean;
  assistant: boolean;

  reengagement: boolean;
  reengagementSmartGroups: boolean;
  reengagementSmartMessages: boolean;
  reengagementAiRemix: boolean;

  apexVerifiedBadge: boolean;
  apexSmartRiskShield: boolean;
  apexPriorityDisputeOverride: boolean;

  staff: boolean;
  promotions: boolean;
  monthAnalytics: boolean;

  bestSellers: boolean;
  deadStock: boolean;
  followUps: boolean;
  proofOfPayment: boolean;
  customerNotes: boolean;
  installmentPlans: boolean;

  /** ✅ NEW: allow customers pay in USD at checkout (only used on MOMENTUM/APEX) */
  usdCheckout: boolean;
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

  followUpsCap72h: number;

  bestSellersMaxRows: number;
  bestSellersMaxDays: number;

  deadStockMaxRows: number;
  deadStockMaxDays: number;
  deadStockIgnoreNewerThanDays: number;
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

function pickInt(raw: any, fallback: number, min: number, max: number) {
  if (raw === undefined || raw === null || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  const v = Math.floor(n);
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
    reengagementSmartGroups:
      typeof o.reengagementSmartGroups === "boolean" ? o.reengagementSmartGroups : fallback.reengagementSmartGroups,
    reengagementSmartMessages:
      typeof o.reengagementSmartMessages === "boolean" ? o.reengagementSmartMessages : fallback.reengagementSmartMessages,
    reengagementAiRemix:
      typeof o.reengagementAiRemix === "boolean" ? o.reengagementAiRemix : fallback.reengagementAiRemix,

    apexVerifiedBadge: typeof o.apexVerifiedBadge === "boolean" ? o.apexVerifiedBadge : fallback.apexVerifiedBadge,
    apexSmartRiskShield:
      typeof o.apexSmartRiskShield === "boolean" ? o.apexSmartRiskShield : fallback.apexSmartRiskShield,
    apexPriorityDisputeOverride:
      typeof o.apexPriorityDisputeOverride === "boolean"
        ? o.apexPriorityDisputeOverride
        : fallback.apexPriorityDisputeOverride,

    staff: typeof o.staff === "boolean" ? o.staff : fallback.staff,
    promotions: typeof o.promotions === "boolean" ? o.promotions : fallback.promotions,
    monthAnalytics: typeof o.monthAnalytics === "boolean" ? o.monthAnalytics : fallback.monthAnalytics,

    bestSellers: typeof o.bestSellers === "boolean" ? o.bestSellers : fallback.bestSellers,
    deadStock: typeof o.deadStock === "boolean" ? o.deadStock : fallback.deadStock,
    followUps: typeof o.followUps === "boolean" ? o.followUps : fallback.followUps,
    proofOfPayment: typeof o.proofOfPayment === "boolean" ? o.proofOfPayment : fallback.proofOfPayment,
    customerNotes: typeof o.customerNotes === "boolean" ? o.customerNotes : fallback.customerNotes,
    installmentPlans: typeof o.installmentPlans === "boolean" ? o.installmentPlans : fallback.installmentPlans,

    usdCheckout: typeof o.usdCheckout === "boolean" ? o.usdCheckout : fallback.usdCheckout,
  };
}

function cleanLimits(v: any, fallback: PlanLimits): PlanLimits {
  const o = v && typeof v === "object" ? v : {};
  return {
    maxProducts: pickInt(o.maxProducts, fallback.maxProducts, 0, 200000),
    ordersVisible: pickInt(o.ordersVisible, fallback.ordersVisible, 1, 200000),
    reengagementDaily: pickInt(o.reengagementDaily, fallback.reengagementDaily, 0, 200000),
    chatOrdersDaily: pickInt(o.chatOrdersDaily, fallback.chatOrdersDaily, 0, 200000),

    staffMax: pickInt(o.staffMax, fallback.staffMax, 0, 1000),
    couponsMax: pickInt(o.couponsMax, fallback.couponsMax, 0, 100000),
    shippingOptionsMax: pickInt(o.shippingOptionsMax, fallback.shippingOptionsMax, 0, 1000),
    promotionsMaxActive: pickInt(o.promotionsMaxActive, fallback.promotionsMaxActive, 0, 1000),

    followUpsCap72h: pickInt(o.followUpsCap72h, fallback.followUpsCap72h, 0, 500),

    bestSellersMaxRows: pickInt(o.bestSellersMaxRows, fallback.bestSellersMaxRows, 0, 1000),
    bestSellersMaxDays: pickInt(o.bestSellersMaxDays, fallback.bestSellersMaxDays, 0, 365),

    deadStockMaxRows: pickInt(o.deadStockMaxRows, fallback.deadStockMaxRows, 0, 2000),
    deadStockMaxDays: pickInt(o.deadStockMaxDays, fallback.deadStockMaxDays, 0, 365),
    deadStockIgnoreNewerThanDays: pickInt(o.deadStockIgnoreNewerThanDays, fallback.deadStockIgnoreNewerThanDays, 0, 60),
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
          reengagementSmartGroups: false,
          reengagementSmartMessages: false,
          reengagementAiRemix: false,

          apexVerifiedBadge: false,
          apexSmartRiskShield: false,
          apexPriorityDisputeOverride: false,

          staff: false,
          promotions: false,
          monthAnalytics: false,

          bestSellers: false,
          deadStock: false,
          followUps: false,
          proofOfPayment: false,
          customerNotes: false,
          installmentPlans: false,

          usdCheckout: false,
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

          followUpsCap72h: 0,

          bestSellersMaxRows: 0,
          bestSellersMaxDays: 0,

          deadStockMaxRows: 0,
          deadStockMaxDays: 0,
          deadStockIgnoreNewerThanDays: 7,
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
          reengagementSmartGroups: true,
          reengagementSmartMessages: true,
          reengagementAiRemix: false,

          apexVerifiedBadge: false,
          apexSmartRiskShield: false,
          apexPriorityDisputeOverride: false,

          staff: true,
          promotions: true,
          monthAnalytics: true,

          bestSellers: true,
          deadStock: false,
          followUps: true,
          proofOfPayment: true,
          customerNotes: true,
          installmentPlans: false,

          usdCheckout: false,
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

          followUpsCap72h: 10,

          bestSellersMaxRows: 5,
          bestSellersMaxDays: 7,

          deadStockMaxRows: 0,
          deadStockMaxDays: 0,
          deadStockIgnoreNewerThanDays: 7,
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
          reengagementSmartGroups: true,
          reengagementSmartMessages: true,
          reengagementAiRemix: false,

          apexVerifiedBadge: false,
          apexSmartRiskShield: false,
          apexPriorityDisputeOverride: false,

          staff: true,
          promotions: true,
          monthAnalytics: true,

          bestSellers: true,
          deadStock: true,
          followUps: true,
          proofOfPayment: true,
          customerNotes: true,
          installmentPlans: false,

          usdCheckout: true, // ✅ default ON
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

          followUpsCap72h: 25,

          bestSellersMaxRows: 20,
          bestSellersMaxDays: 30,

          deadStockMaxRows: 80,
          deadStockMaxDays: 30,
          deadStockIgnoreNewerThanDays: 7,
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
          reengagementSmartGroups: true,
          reengagementSmartMessages: true,
          reengagementAiRemix: true,

          apexVerifiedBadge: true,
          apexSmartRiskShield: true,
          apexPriorityDisputeOverride: true,

          staff: true,
          promotions: true,
          monthAnalytics: true,

          bestSellers: true,
          deadStock: true,
          followUps: true,
          proofOfPayment: true,
          customerNotes: true,
          installmentPlans: true,

          usdCheckout: true, // ✅ default ON
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

          followUpsCap72h: 50,

          bestSellersMaxRows: 50,
          bestSellersMaxDays: 90,

          deadStockMaxRows: 200,
          deadStockMaxDays: 90,
          deadStockIgnoreNewerThanDays: 7,
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

// ---------------------
// The rest of your file stays the same (addons sync, applyAddonsToPlan, getBusinessPlanResolved).
// ---------------------

function deepEqualJson(a: any, b: any) {
  try {
    return JSON.stringify(a || null) === JSON.stringify(b || null);
  } catch {
    return false;
  }
}

function syncAddonEntitlementsCompute(entMap: any, subscriptionActive: boolean, nowMs: number) {
  const next: any = { ...(entMap || {}) };
  let changed = false;

  for (const sku of Object.keys(next)) {
    const e = next[sku] || {};
    const status = String(e.status || "inactive");
    const expiresAtMs = Number(e.expiresAtMs || 0) || 0;
    const remainingMs = Number(e.remainingMs || 0) || 0;

    if (!subscriptionActive) {
      if (status === "active" && expiresAtMs > nowMs) {
        next[sku] = {
          ...e,
          status: "paused",
          remainingMs: Math.max(0, expiresAtMs - nowMs),
          expiresAtMs: null,
          updatedAtMs: nowMs,
          pausedAtMs: nowMs,
        };
        changed = true;
      } else if (status === "active" && expiresAtMs && expiresAtMs <= nowMs) {
        next[sku] = { ...e, status: "expired", expiresAtMs: expiresAtMs, remainingMs: null, updatedAtMs: nowMs };
        changed = true;
      }
    } else {
      if (status === "paused" && remainingMs > 0) {
        next[sku] = {
          ...e,
          status: "active",
          expiresAtMs: nowMs + remainingMs,
          remainingMs: null,
          updatedAtMs: nowMs,
          resumedAtMs: nowMs,
        };
        changed = true;
      } else if (status === "paused" && remainingMs <= 0) {
        next[sku] = { ...e, status: "expired", expiresAtMs: null, remainingMs: null, updatedAtMs: nowMs };
        changed = true;
      } else if (status === "active" && expiresAtMs && expiresAtMs <= nowMs) {
        next[sku] = { ...e, status: "expired", expiresAtMs: expiresAtMs, remainingMs: null, updatedAtMs: nowMs };
        changed = true;
      }
    }
  }

  return { next, changed };
}

async function syncAddonEntitlementsIfNeeded(businessId: string, biz: any, subscriptionActive: boolean) {
  if (!biz || typeof biz !== "object") return biz;

  const nowMs = Date.now();

  const sync = biz?.addonSync && typeof biz.addonSync === "object" ? biz.addonSync : {};
  const lastState = !!sync.lastKnownSubActive;
  const lastMs = Number(sync.lastSyncMs || 0) || 0;

  const entMap = biz?.addonEntitlements && typeof biz.addonEntitlements === "object" ? biz.addonEntitlements : {};

  let mustSync = false;

  if (lastState !== subscriptionActive) mustSync = true;

  if (!mustSync) {
    for (const sku of Object.keys(entMap)) {
      const e = entMap[sku] || {};
      const status = String(e.status || "");
      const expiresAtMs = Number(e.expiresAtMs || 0) || 0;
      const remainingMs = Number(e.remainingMs || 0) || 0;

      if (subscriptionActive) {
        if (status === "paused" && remainingMs > 0) {
          mustSync = true;
          break;
        }
        if (status === "active" && expiresAtMs && expiresAtMs <= nowMs) {
          mustSync = true;
          break;
        }
      } else {
        if (status === "active" && expiresAtMs && expiresAtMs > nowMs) {
          mustSync = true;
          break;
        }
      }
    }
  }

  if (!mustSync && lastState === subscriptionActive && nowMs - lastMs < 10 * 60 * 1000) {
    return biz;
  }

  const computed = syncAddonEntitlementsCompute(entMap, subscriptionActive, nowMs);
  const nextEnt = computed.next;

  const ref = adminDb.collection("businesses").doc(businessId);

  if (!computed.changed || deepEqualJson(entMap, nextEnt)) {
    if (lastState !== subscriptionActive || nowMs - lastMs >= 10 * 60 * 1000) {
      await ref.set({ addonSync: { lastKnownSubActive: subscriptionActive, lastSyncMs: nowMs } }, { merge: true });
    }
    return biz;
  }

  await ref.set(
    {
      addonEntitlements: nextEnt,
      addonSync: { lastKnownSubActive: subscriptionActive, lastSyncMs: nowMs },
      updatedAtMs: nowMs,
    },
    { merge: true }
  );

  return { ...biz, addonEntitlements: nextEnt, addonSync: { lastKnownSubActive: subscriptionActive, lastSyncMs: nowMs } };
}

function addonIsActive(ent: any, nowMs: number) {
  if (!ent || typeof ent !== "object") return false;
  if (String(ent.status || "") !== "active") return false;
  const exp = Number(ent.expiresAtMs || 0);
  return !!(exp && exp > nowMs);
}

function applyAddonsToPlan(args: {
  planKey: BizhubPlanKey;
  hasActiveSubscription: boolean;
  business: any;
  features: PlanFeatures;
  limits: PlanLimits;
}) {
  const { planKey, hasActiveSubscription, business } = args;
  const nowMs = Date.now();

  if (!hasActiveSubscription || planKey === "FREE") {
    return { features: args.features, limits: args.limits, addons: {} as any };
  }

  const entMap =
    business?.addonEntitlements && typeof business.addonEntitlements === "object" ? business.addonEntitlements : {};

  const basicInstallments = addonIsActive(entMap["addon_installments_basic"], nowMs);
  const advancedInstallments = addonIsActive(entMap["addon_installments_advanced"], nowMs);

  const launchDeadStock = addonIsActive(entMap["addon_deadstock_40_15"], nowMs);
  const momentumDeadStockExpansion = addonIsActive(entMap["addon_deadstock_150_60"], nowMs);

  const launchFollowUpsBoost = addonIsActive(entMap["addon_followups_boost_20"], nowMs);
  const momentumFollowUpsBoost = addonIsActive(entMap["addon_followups_boost_50"], nowMs);

  const launchStaffPlus1 = addonIsActive(entMap["addon_staff_plus1"], nowMs);

  const launchBestSellersExpansion = addonIsActive(entMap["addon_bestsellers_10_14"], nowMs);
  const momentumBestSellersExpansion = addonIsActive(entMap["addon_bestsellers_50_90"], nowMs);

  const launchAiRemix = addonIsActive(entMap["addon_reengage_remix_lite"], nowMs);
  const momentumAiRemix = addonIsActive(entMap["addon_reengage_remix_apex_capped"], nowMs);

  const nextFeatures: PlanFeatures = { ...args.features };
  const nextLimits: PlanLimits = { ...args.limits };
  const addons: any = {};

  if (planKey === "LAUNCH" || planKey === "MOMENTUM") {
    nextFeatures.reengagementAiRemix = false;
  }

  if (planKey === "LAUNCH" && basicInstallments) {
    nextFeatures.installmentPlans = true;
    addons.installmentPlansTier = "basic";
    addons.installmentPlansSku = "addon_installments_basic";
  }

  if (planKey === "MOMENTUM" && advancedInstallments) {
    nextFeatures.installmentPlans = true;
    addons.installmentPlansTier = "advanced";
    addons.installmentPlansSku = "addon_installments_advanced";
  }

  if (planKey === "LAUNCH" && launchDeadStock) {
    nextFeatures.deadStock = true;
    nextLimits.deadStockMaxRows = Math.max(Number(nextLimits.deadStockMaxRows || 0), 40);
    nextLimits.deadStockMaxDays = Math.max(Number(nextLimits.deadStockMaxDays || 0), 15);
    addons.deadStockTier = "40_15";
    addons.deadStockSku = "addon_deadstock_40_15";
  }

  if (planKey === "MOMENTUM" && momentumDeadStockExpansion) {
    nextFeatures.deadStock = true;
    nextLimits.deadStockMaxRows = Math.max(Number(nextLimits.deadStockMaxRows || 0), 150);
    nextLimits.deadStockMaxDays = Math.max(Number(nextLimits.deadStockMaxDays || 0), 60);
    addons.deadStockTier = "150_60";
    addons.deadStockSku = "addon_deadstock_150_60";
  }

  if (planKey === "LAUNCH" && launchFollowUpsBoost) {
    nextLimits.followUpsCap72h = Math.max(Number(nextLimits.followUpsCap72h || 0), 20);
    addons.followUpsBoostSku = "addon_followups_boost_20";
    addons.followUpsBoostCap72h = 20;
  }

  if (planKey === "MOMENTUM" && momentumFollowUpsBoost) {
    nextLimits.followUpsCap72h = Math.max(Number(nextLimits.followUpsCap72h || 0), 50);
    addons.followUpsBoostSku = "addon_followups_boost_50";
    addons.followUpsBoostCap72h = 50;
  }

  if (planKey === "LAUNCH" && launchStaffPlus1) {
    nextLimits.staffMax = Math.max(0, Number(nextLimits.staffMax || 0)) + 1;
    addons.staffSeatAddonSku = "addon_staff_plus1";
    addons.staffMaxEffective = nextLimits.staffMax;
  }

  if (planKey === "LAUNCH" && launchBestSellersExpansion) {
    nextLimits.bestSellersMaxRows = Math.max(Number(nextLimits.bestSellersMaxRows || 0), 10);
    nextLimits.bestSellersMaxDays = Math.max(Number(nextLimits.bestSellersMaxDays || 0), 14);
    addons.bestSellersExpansionSku = "addon_bestsellers_10_14";
    addons.bestSellersTier = "10_14";
  }

  if (planKey === "MOMENTUM" && momentumBestSellersExpansion) {
    nextLimits.bestSellersMaxRows = Math.max(Number(nextLimits.bestSellersMaxRows || 0), 50);
    nextLimits.bestSellersMaxDays = Math.max(Number(nextLimits.bestSellersMaxDays || 0), 90);
    addons.bestSellersExpansionSku = "addon_bestsellers_50_90";
    addons.bestSellersTier = "50_90";
  }

  if (planKey === "LAUNCH" && launchAiRemix) {
    nextFeatures.reengagementAiRemix = true;
    addons.reengagementAiRemixSku = "addon_reengage_remix_lite";
    addons.reengagementAiRemixTier = "lite";
    addons.reengagementAiRemixCapPer24h = 5;
  }

  if (planKey === "MOMENTUM" && momentumAiRemix) {
    nextFeatures.reengagementAiRemix = true;
    addons.reengagementAiRemixSku = "addon_reengage_remix_apex_capped";
    addons.reengagementAiRemixTier = "apex_capped";
    addons.reengagementAiRemixCapPer24h = 25;
  }

  return { features: nextFeatures, limits: nextLimits, addons };
}

export async function getBusinessPlanResolved(businessId: string) {
  const bizRef = adminDb.collection("businesses").doc(businessId);
  const bizSnap = await bizRef.get();
  let biz = bizSnap.exists ? (bizSnap.data() as any) : null;

  const hasSub = hasActiveSubscription(biz);
  const planKey = resolvePlanKey(biz);

  biz = await syncAddonEntitlementsIfNeeded(businessId, biz, hasSub);

  const cfg = await getPlanConfig();
  const basePlan = cfg.plans[planKey] ?? fallbackPlanConfig().plans[planKey];

  const applied = applyAddonsToPlan({
    planKey,
    hasActiveSubscription: hasSub,
    business: biz,
    features: basePlan.features,
    limits: basePlan.limits,
  });

  return {
    planKey,
    hasActiveSubscription: hasSub,
    features: applied.features,
    limits: applied.limits,
    business: biz,
    addons: applied.addons,
  };
}