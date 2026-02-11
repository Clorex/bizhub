import { ANALYTICS_CONFIG } from '@/config/analytics.config';

/**
 * Chart Theme
 * Centralized theming for all charts.
 * Orange primary accent. No blue. No random gradients.
 */
export const chartTheme = {
  // Colors
  colors: {
    primary: ANALYTICS_CONFIG.COLORS.primary,
    primaryLight: ANALYTICS_CONFIG.COLORS.primaryLight,
    primaryDark: ANALYTICS_CONFIG.COLORS.primaryDark,
    green: ANALYTICS_CONFIG.COLORS.green,
    red: ANALYTICS_CONFIG.COLORS.red,
    grey: ANALYTICS_CONFIG.COLORS.grey,
    grid: ANALYTICS_CONFIG.COLORS.chartGrid,
    white: ANALYTICS_CONFIG.COLORS.white,
    darkText: ANALYTICS_CONFIG.COLORS.darkText,
  },

  // Bar chart color palette (all orange variants)
  barColors: [
    '#F97316',
    '#EA580C',
    '#FB923C',
    '#FDBA74',
    '#FED7AA',
  ],

  // Donut chart color palette
  donutColors: [
    '#FED7AA',
    '#F97316',
    '#EA580C',
  ],

  // Font
  fontFamily: 'inherit',
  fontSize: {
    xs: 10,
    sm: 11,
    md: 12,
    lg: 14,
  },

  // Axis
  axis: {
    stroke: '#E2E8F0',
    tickSize: 0,
    tickMargin: 8,
  },

  // Grid
  grid: {
    stroke: '#E2E8F0',
    strokeDasharray: '3 3',
    opacity: 0.6,
  },

  // Tooltip
  tooltip: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 10,
  },

  // Animation
  animation: {
    duration: 800,
    easing: 'ease-out',
  },
} as const;