import { ANALYTICS_CONFIG } from '@/config/analytics.config';

/**
 * Chart Configuration
 * Responsive sizing and settings for all charts.
 */
export const chartConfig = {
  // Height settings
  height: {
    mini: ANALYTICS_CONFIG.CHART_HEIGHT_MOBILE,
    mobile: 180,
    desktop: ANALYTICS_CONFIG.CHART_HEIGHT_DESKTOP,
    donut: 200,
    engagement: 160,
  },

  // Margins
  margin: {
    mini: { top: 5, right: 5, bottom: 5, left: 5 },
    standard: { top: 10, right: 10, bottom: 20, left: 40 },
    bar: { top: 10, right: 10, bottom: 40, left: 40 },
  },

  // Responsive breakpoint
  breakpoint: 768,

  // Dot settings for line charts
  dot: {
    radius: 0,
    activeRadius: 5,
    strokeWidth: 2,
  },

  // Stroke settings
  stroke: {
    width: 2.5,
    dashArray: '3 3',
  },

  // Bar settings
  bar: {
    radius: [8, 8, 0, 0] as [number, number, number, number],
    maxBarSize: 48,
  },
} as const;

/**
 * Get responsive chart height.
 */
export function getChartHeight(
  type: 'mini' | 'standard' | 'donut' | 'engagement',
  isMobile: boolean
): number {
  switch (type) {
    case 'mini':
      return chartConfig.height.mini;
    case 'standard':
      return isMobile ? chartConfig.height.mobile : chartConfig.height.desktop;
    case 'donut':
      return chartConfig.height.donut;
    case 'engagement':
      return chartConfig.height.engagement;
    default:
      return chartConfig.height.mobile;
  }
}