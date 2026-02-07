// FILE: src/lib/vendor/limitsServer.ts
import { getBusinessPlanResolved } from "@/lib/vendor/planConfigServer";

export type BizhubPlanKey = "FREE" | "LAUNCH" | "MOMENTUM" | "APEX";

export type VendorPlanFeatures = {
  marketplace: boolean;
  storeCustomize: boolean;
  continueInChat: boolean;
  coupons: boolean;
  assistant: boolean;
  reengagement: boolean;
  staff: boolean;
  promotions: boolean;
  monthAnalytics: boolean;

  bestSellers: boolean;
  deadStock: boolean;
  followUps: boolean;
  proofOfPayment: boolean;
  customerNotes: boolean;
  installmentPlans: boolean;

  /** ✅ NEW */
  usdCheckout: boolean;
};

export type VendorPlanLimits = {
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

  canUpdateStatus?: boolean;
  canUseNotes?: boolean;
};

export type VendorLimitsResolved = {
  planKey: BizhubPlanKey;
  hasActiveSubscription: boolean;
  limits: VendorPlanLimits;
  features: VendorPlanFeatures;
};

function cleanPlanKey(v: any): BizhubPlanKey {
  const k = String(v || "FREE").toUpperCase();
  if (k === "LAUNCH" || k === "MOMENTUM" || k === "APEX") return k;
  return "FREE";
}

export async function getVendorLimitsResolved(businessId: string): Promise<VendorLimitsResolved> {
  const resolved = await getBusinessPlanResolved(businessId);

  const planKey = cleanPlanKey(resolved.planKey);
  const hasActiveSubscription = !!resolved.hasActiveSubscription;

  const f: any = resolved.features || {};
  const l: any = resolved.limits || {};

  const features: VendorPlanFeatures = {
    marketplace: !!f.marketplace,
    storeCustomize: !!f.storeCustomize,
    continueInChat: !!f.continueInChat,
    coupons: !!f.coupons,
    assistant: !!f.assistant,
    reengagement: !!f.reengagement,
    staff: !!f.staff,
    promotions: !!f.promotions,
    monthAnalytics: !!f.monthAnalytics,

    bestSellers: !!f.bestSellers,
    deadStock: !!f.deadStock,
    followUps: !!f.followUps,
    proofOfPayment: !!f.proofOfPayment,
    customerNotes: !!f.customerNotes,
    installmentPlans: !!f.installmentPlans,

    usdCheckout: !!f.usdCheckout,
  };

  const limits: VendorPlanLimits = {
    maxProducts: Number(l.maxProducts || 0),
    ordersVisible: Number(l.ordersVisible || 0),
    reengagementDaily: Number(l.reengagementDaily || 0),
    chatOrdersDaily: Number(l.chatOrdersDaily || 0),

    staffMax: Number(l.staffMax || 0),
    couponsMax: Number(l.couponsMax || 0),
    shippingOptionsMax: Number(l.shippingOptionsMax || 0),
    promotionsMaxActive: Number(l.promotionsMaxActive || 0),

    followUpsCap72h: Number(l.followUpsCap72h || 0),

    bestSellersMaxRows: Number(l.bestSellersMaxRows || 0),
    bestSellersMaxDays: Number(l.bestSellersMaxDays || 0),

    deadStockMaxRows: Number(l.deadStockMaxRows || 0),
    deadStockMaxDays: Number(l.deadStockMaxDays || 0),
    deadStockIgnoreNewerThanDays: Number(l.deadStockIgnoreNewerThanDays || 0),

    canUpdateStatus: planKey !== "FREE" && hasActiveSubscription,
    canUseNotes: !!features.customerNotes,
  };

  return { planKey, hasActiveSubscription, features, limits };
}