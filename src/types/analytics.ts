// ===========================
// SALES GROWTH
// ===========================
export interface DailySalesPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface SalesGrowthData {
  current_period_total: number;
  previous_period_total: number;
  growth_percentage: number;
  daily_sales: DailySalesPoint[];
  peak_day: DailySalesPoint | null;
  insight: string;
}

// ===========================
// REVENUE BREAKDOWN
// ===========================
export interface ProductRevenue {
  product_id: string;
  product_name: string;
  revenue: number;
  percentage: number;
}

export interface RevenueBreakdownData {
  top_products: ProductRevenue[];
  total_revenue: number;
  insight: string;
}

// ===========================
// CONVERSION
// ===========================
export interface ConversionData {
  profile_views: number;
  product_clicks: number;
  purchases: number;
  conversion_rate: number;
  insight: string;
}

// ===========================
// TOP PRODUCTS
// ===========================
export interface TopProduct {
  product_id: string;
  product_name: string;
  product_image: string;
  units_sold: number;
  revenue: number;
  growth_percentage: number;
  trend: 'up' | 'down' | 'neutral';
}

export interface TopProductsData {
  products: TopProduct[];
}

// ===========================
// CUSTOMER ENGAGEMENT
// ===========================
export interface EngagementData {
  saves: number;
  cart_adds: number;
  shares: number;
  insight: string;
}

// ===========================
// SUMMARY (DASHBOARD CARD)
// ===========================
export interface AnalyticsSummary {
  sales_growth_percentage: number;
  daily_sales: DailySalesPoint[];
  insight: string;
}

// ===========================
// DAILY STATS AGGREGATE
// ===========================
export interface VendorDailyStats {
  id: string;
  vendor_id: string;
  date: Date;
  sales_count: number;
  revenue: number;
  views: number;
  clicks: number;
  purchases: number;
  saves: number;
  cart_adds: number;
  shares: number;
}

// ===========================
// API RESPONSE WRAPPER
// ===========================
export interface AnalyticsApiResponse<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  cached: boolean;
}

// ===========================
// DATE RANGE
// ===========================
export interface DateRange {
  start: Date;
  end: Date;
}

export interface AnalyticsPeriod {
  current: DateRange;
  previous: DateRange;
}