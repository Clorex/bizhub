// FILE: src/types/restock.ts
// Types for Smart Restock & Demand Alerts (Apex Only)

export type RestockSeverity = "info" | "warning" | "high" | "urgent";

export type RestockFlagType =
  | "stockout_warning"
  | "stockout_urgent"
  | "demand_rising"
  | "demand_spike"
  | "conversion_warning"
  | "opportunity_trending"
  | "no_stock_high_demand";

export interface ProductInsightFlag {
  id: string;
  product_id: string;
  business_id: string;
  flag_type: RestockFlagType;
  severity: RestockSeverity;
  message: string;
  metadata: RestockFlagMetadata | null;
  created_at: string;
  resolved_at: string | null;
  expires_at: string | null;
}

export interface RestockFlagMetadata {
  // Stock tracking
  current_stock?: number;
  sales_velocity?: number;
  days_to_stockout?: number;
  track_stock?: boolean;

  // Demand signals
  views_growth_pct?: number;
  cart_growth_pct?: number;
  orders_growth_pct?: number;

  // Product context
  product_name?: string;
  product_price?: number;

  // Conversion
  views_count?: number;
  orders_count?: number;
  conversion_rate?: number;

  // Trending
  store_avg_velocity?: number;
  product_velocity?: number;
}

export interface ProductDailyMetricRow {
  product_id: string;
  business_id: string;
  date: string;
  views: number;
  detail_opens: number;
  add_to_carts: number;
  saves: number;
  orders: number;
  units_sold: number;
  revenue: number;
}

export interface RestockAlertConfig {
  enabled: boolean;
  growth_threshold_pct: number;
  spike_threshold_pct: number;
  stockout_warn_days: number;
  stockout_urgent_days: number;
  alert_cooldown_hours: number;
  email_alerts_enabled: boolean;
}

export interface RestockDashboardData {
  risk_products: ProductInsightSummary[];
  rising_demand_products: ProductInsightSummary[];
  needs_attention_products: ProductInsightSummary[];
  total_active_flags: number;
  last_computed_at: string | null;
}

export interface ProductInsightSummary {
  product_id: string;
  product_name: string;
  product_image?: string;
  flags: ProductInsightFlag[];
  top_severity: RestockSeverity;
  top_message: string;
}

export interface ProductInsightDetail {
  product_id: string;
  product_name: string;
  sales_velocity: number;
  demand_trend: "rising" | "falling" | "stable";
  demand_trend_pct: number;
  restock_estimate_days: number | null;
  current_stock: number | null;
  track_stock: boolean;
  conversion_rate: number;
  conversion_hint: string | null;
  flags: ProductInsightFlag[];
  daily_metrics: ProductDailyMetricRow[];
}

export const RESTOCK_FLAG_LABELS: Record<RestockFlagType, string> = {
  stockout_warning: "Low Stock Warning",
  stockout_urgent: "Urgent: Stock Critical",
  demand_rising: "Demand Rising",
  demand_spike: "Demand Spike",
  conversion_warning: "Low Conversion",
  opportunity_trending: "Trending Product",
  no_stock_high_demand: "High Demand, No Stock Tracking",
};

export const RESTOCK_SEVERITY_ORDER: Record<RestockSeverity, number> = {
  urgent: 4,
  high: 3,
  warning: 2,
  info: 1,
};

export const DEFAULT_RESTOCK_CONFIG: RestockAlertConfig = {
  enabled: true,
  growth_threshold_pct: 60,
  spike_threshold_pct: 120,
  stockout_warn_days: 7,
  stockout_urgent_days: 3,
  alert_cooldown_hours: 48,
  email_alerts_enabled: false,
};
