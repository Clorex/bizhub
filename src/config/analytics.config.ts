export const ANALYTICS_CONFIG = {
  // Time periods
  DEFAULT_PERIOD_DAYS: 30,
  
  // Cache TTL (in seconds)
  CACHE_TTL_SUMMARY: 300,        // 5 minutes
  CACHE_TTL_SALES_GROWTH: 600,   // 10 minutes
  CACHE_TTL_REVENUE: 600,        // 10 minutes
  CACHE_TTL_CONVERSION: 600,     // 10 minutes
  CACHE_TTL_TOP_PRODUCTS: 600,   // 10 minutes
  CACHE_TTL_ENGAGEMENT: 600,     // 10 minutes
  
  // Display limits
  TOP_PRODUCTS_LIMIT: 5,
  PRODUCT_NAME_MAX_LENGTH: 15,
  
  // Chart settings
  CHART_HEIGHT_MOBILE: 120,
  CHART_HEIGHT_DESKTOP: 200,
  
  // Growth thresholds
  GROWTH_STRONG_THRESHOLD: 20,
  GROWTH_STEADY_THRESHOLD: 0,
  
  // Conversion thresholds
  CONVERSION_GOOD_THRESHOLD: 50,
  CONVERSION_AVERAGE_THRESHOLD: 20,
  
  // Colors (brand)
  COLORS: {
    primary: '#F97316',
    primaryLight: '#FED7AA',
    primaryDark: '#EA580C',
    white: '#FFFFFF',
    lightGrey: '#F1F5F9',
    darkText: '#1F2937',
    green: '#22C55E',
    red: '#EF4444',
    grey: '#94A3B8',
    chartGrid: '#E2E8F0',
  },
  
  // API endpoints
  ENDPOINTS: {
    SUMMARY: '/api/vendor/analytics/summary',
    SALES_GROWTH: '/api/vendor/analytics/sales-growth',
    REVENUE_BREAKDOWN: '/api/vendor/analytics/revenue-breakdown',
    CONVERSION: '/api/vendor/analytics/conversion',
    TOP_PRODUCTS: '/api/vendor/analytics/top-products',
    CUSTOMER_ENGAGEMENT: '/api/vendor/analytics/customer-engagement',
    SUBSCRIPTION_STATUS: '/api/vendor/subscription/status',
  },
} as const;
// ===========================
// SMART RESTOCK & DEMAND ALERTS CONFIG
// ===========================
export const RESTOCK_CONFIG = {
  // Growth thresholds for demand detection
  DEMAND_RISING_THRESHOLD_PCT: 60,
  DEMAND_SPIKE_THRESHOLD_PCT: 120,

  // Stockout prediction
  STOCKOUT_WARN_DAYS: 7,
  STOCKOUT_URGENT_DAYS: 3,

  // Alert cooldown (hours) to prevent spam
  ALERT_COOLDOWN_HOURS: 48,

  // Conversion warning threshold
  LOW_CONVERSION_VIEWS_MIN: 20,
  LOW_CONVERSION_RATE_THRESHOLD: 0.02,

  // Trending threshold (product velocity vs store average)
  TRENDING_VELOCITY_MULTIPLIER: 1.5,

  // Cache TTL
  CACHE_TTL_RESTOCK_DASHBOARD: 300, // 5 minutes

  // API endpoints
  ENDPOINTS: {
    RESTOCK_DASHBOARD: '/api/vendor/restock/dashboard',
    RESTOCK_PRODUCT: '/api/vendor/restock/product',
    RESTOCK_CONFIG: '/api/vendor/restock/config',
    RESTOCK_DISMISS: '/api/vendor/restock/dismiss',
  },
} as const;

// ===========================
// BUYER INTENT RADAR CONFIG
// ===========================
export const INTENT_RADAR_CONFIG = {
  // Score thresholds
  WARM_THRESHOLD: 40,
  STRONG_THRESHOLD: 70,
  HOT_THRESHOLD: 100,

  // Hot deal trigger rules
  STRONG_USERS_48H: 2,
  HOT_USERS_FOR_FLAG: 1,

  // Flag expiry
  FLAG_EXPIRY_HOURS: 48,

  // Alert cooldown
  ALERT_COOLDOWN_HOURS: 24,

  // Cache TTL
  CACHE_TTL_INTENT_DASHBOARD: 300,

  // API endpoints
  ENDPOINTS: {
    INTENT_DASHBOARD: '/api/vendor/intent-radar/dashboard',
    INTENT_PRODUCT: '/api/vendor/intent-radar/product',
  },
} as const;
