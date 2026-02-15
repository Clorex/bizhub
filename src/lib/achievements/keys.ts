// FILE: src/lib/achievements/keys.ts

/**
 * Achievement key definitions.
 * Each key can only unlock ONCE per actor (vendor or customer).
 */
export type AchievementKey =
  | "vendor_first_order"
  | "vendor_first_visit"
  | "vendor_first_product"
  | "customer_first_order";

export interface AchievementDef {
  key: AchievementKey;
  actorType: "vendor" | "customer";
  title: string;
  message: string;
  emoji: string;
}

export const ACHIEVEMENT_DEFS: Record<AchievementKey, AchievementDef> = {
  vendor_first_order: {
    key: "vendor_first_order",
    actorType: "vendor",
    title: "First Order Received!",
    message: "Congratulations \u2014 you received your first order! Your store is officially in business.",
    emoji: "\uD83C\uDF89",
  },
  vendor_first_visit: {
    key: "vendor_first_visit",
    actorType: "vendor",
    title: "First Store Visit!",
    message: "Congratulations \u2014 your store got its first visit! Someone is checking you out.",
    emoji: "\uD83D\uDC40",
  },
  vendor_first_product: {
    key: "vendor_first_product",
    actorType: "vendor",
    title: "First Product Added!",
    message: "Congratulations \u2014 you added your first product! Your store is coming to life.",
    emoji: "\uD83D\uDE80",
  },
  customer_first_order: {
    key: "customer_first_order",
    actorType: "customer",
    title: "First Purchase!",
    message: "Congratulations \u2014 you placed your first order on BizHub! Happy shopping.",
    emoji: "\uD83D\uDED2",
  },
};
