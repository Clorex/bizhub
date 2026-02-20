// FILE: src/types/buyer-intent.ts
// Types for Buyer Intent Radar (Hot Deals Advantage) — Apex Only

export type IntentLevel = "warm" | "strong" | "hot";

export type IntentEventType =
  | "product_view"
  | "repeat_view"
  | "time_spent"
  | "add_to_cart"
  | "save"
  | "contact_click"
  | "checkout_start"
  | "compare"
  | "store_revisit";

export interface BuyerIntentEvent {
  id: string;
  product_id: string;
  business_id: string;
  anonymous_id: string; // hashed user/session — never raw identity
  event_type: IntentEventType;
  duration_seconds?: number;
  created_at: number; // ms
}

export interface ProductIntentScore {
  product_id: string;
  business_id: string;
  intent_score_total: number;
  warm_count: number;
  strong_count: number;
  hot_count: number;
  unique_users: number;
  last_computed_at: number; // ms
}

export interface ProductHotFlag {
  id: string;
  product_id: string;
  business_id: string;
  flag_level: IntentLevel;
  message: string;
  suggested_action: string;
  metadata: HotFlagMetadata | null;
  created_at: number; // ms
  expires_at: number; // ms
}

export interface HotFlagMetadata {
  product_name?: string;
  product_price?: number;
  intent_score?: number;
  strong_count?: number;
  hot_count?: number;
  unique_interested?: number;
  top_signals?: string[];
}

export interface IntentRadarDashboardData {
  hot_products: ProductIntentSummary[];
  strong_products: ProductIntentSummary[];
  total_hot_flags: number;
  total_strong_flags: number;
  last_computed_at: string | null;
}

export interface ProductIntentSummary {
  product_id: string;
  product_name: string;
  product_image?: string;
  flag_level: IntentLevel;
  message: string;
  suggested_action: string;
  intent_score: number;
  strong_count: number;
  hot_count: number;
  unique_interested: number;
  created_at: string;
}

export interface ProductIntentDetail {
  product_id: string;
  product_name: string;
  product_image?: string;
  intent_score_total: number;
  warm_count: number;
  strong_count: number;
  hot_count: number;
  unique_users: number;
  flag_level: IntentLevel | null;
  suggested_action: string | null;
  signal_breakdown: SignalBreakdown;
  flags: ProductHotFlag[];
}

export interface SignalBreakdown {
  views: number;
  repeat_views: number;
  time_minutes: number;
  add_to_carts: number;
  saves: number;
  contact_clicks: number;
  checkout_starts: number;
}

// Intent score weights
export const INTENT_WEIGHTS: Record<IntentEventType, number> = {
  product_view: 5,
  repeat_view: 8,
  time_spent: 4, // per minute
  add_to_cart: 20,
  save: 15,
  contact_click: 25,
  checkout_start: 30,
  compare: 10,
  store_revisit: 6,
};

// Intent level thresholds
export const INTENT_THRESHOLDS = {
  WARM: 40,
  STRONG: 70,
  HOT: 100,
} as const;

// Hot deal trigger rules
export const HOT_DEAL_RULES = {
  STRONG_USERS_IN_48H: 2,
  HOT_USERS_FOR_FLAG: 1,
  FLAG_EXPIRY_HOURS: 48,
  ALERT_COOLDOWN_HOURS: 24,
} as const;

export const INTENT_LEVEL_LABELS: Record<IntentLevel, string> = {
  warm: "Warm Interest",
  strong: "Strong Interest",
  hot: "Hot Deal Signal",
};

export const INTENT_LEVEL_ORDER: Record<IntentLevel, number> = {
  hot: 3,
  strong: 2,
  warm: 1,
};
