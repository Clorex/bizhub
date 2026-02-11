'use client';

import React from 'react';
import Badge from '@/components/ui/badge';

interface AnalyticsHeaderProps {
  storeName: string;
  subscriptionTier: string;
  daysRemaining?: number;
  expiryWarning?: string | null;
}

/**
 * Analytics Page Header
 * Shows store name, subscription tier badge, and expiry warning.
 */
export default function AnalyticsHeader({
  storeName,
  subscriptionTier,
  daysRemaining,
  expiryWarning,
}: AnalyticsHeaderProps) {
  const tierVariant = subscriptionTier === 'pro'
    ? 'orange'
    : subscriptionTier === 'premium'
    ? 'orange'
    : 'default';

  return (
    <div className="mb-6 md:mb-8">
      {/* Top row */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
            Analytics
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {storeName} — Last 30 days performance
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={tierVariant} size="md">
            {subscriptionTier.charAt(0).toUpperCase() + subscriptionTier.slice(1)} Plan
          </Badge>
          {daysRemaining !== undefined && daysRemaining <= 7 && (
            <Badge variant="warning" size="md">
              {daysRemaining}d left
            </Badge>
          )}
        </div>
      </div>

      {/* Expiry warning */}
      {expiryWarning && (
        <div className="mt-3 flex items-center gap-2 text-sm text-amber-600 bg-amber-50 rounded-xl px-4 py-2.5">
          <svg
            className="w-4 h-4 flex-shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
          <span>{expiryWarning}</span>
        </div>
      )}
    </div>
  );
}