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