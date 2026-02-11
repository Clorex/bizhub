import React from 'react';
import { formatPercentage } from '@/utils/analytics/format-percentage';

interface GrowthIndicatorProps {
  value: number;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

/**
 * Growth Indicator
 * Shows growth percentage with colored arrow.
 * Green = up, Red = down, Grey = neutral.
 */
export default function GrowthIndicator({
  value,
  size = 'md',
  showIcon = true,
  className = '',
}: GrowthIndicatorProps) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const isNeutral = value === 0;

  const colorClass = isPositive
    ? 'text-green-500'
    : isNegative
    ? 'text-red-500'
    : 'text-gray-400';

  const bgClass = isPositive
    ? 'bg-green-50'
    : isNegative
    ? 'bg-red-50'
    : 'bg-gray-50';

  const sizeStyles = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
    lg: 'text-base px-3 py-1.5',
  };

  const iconSize = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  return (
    <span
      className={`
        inline-flex items-center gap-1 font-semibold rounded-full
        ${colorClass} ${bgClass} ${sizeStyles[size]}
        ${className}
      `}
    >
      {showIcon && !isNeutral && (
        <svg
          className={`${iconSize[size]} ${isNegative ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={3}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M5 15l7-7 7 7"
          />
        </svg>
      )}
      {formatPercentage(value)}
    </span>
  );
}

/**
 * Large Growth Display
 * Used for the big percentage number on dashboard card.
 */
export function GrowthLarge({
  value,
  className = '',
}: {
  value: number;
  className?: string;
}) {
  const colorClass = value > 0
    ? 'analytics-growth-positive'
    : value < 0
    ? 'analytics-growth-negative'
    : 'analytics-growth-neutral';

  const sign = value > 0 ? '+' : '';

  return (
    <span className={`analytics-growth-number ${colorClass} ${className}`}>
      {sign}{Math.round(value)}%
    </span>
  );
}