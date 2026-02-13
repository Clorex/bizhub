'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import AnalyticsSummaryCard from '@/components/analytics/analytics-summary-card';
import AnalyticsSummaryCardLocked from '@/components/analytics/analytics-summary-card-locked';
import AnalyticsSummaryCardSkeleton from '@/components/analytics/analytics-summary-card-skeleton';
import { useVendorAnalytics } from '@/hooks/use-vendor-analytics';
import '@/styles/analytics.css';
import '@/styles/charts.css';

interface DashboardAnalyticsCardProps {
  range?: 'today' | 'week' | 'month';
}

export default function DashboardAnalyticsCard({ range = 'week' }: DashboardAnalyticsCardProps) {
  const router = useRouter();
  const { summary, access, isLoading, error } = useVendorAnalytics(range);

  // CRITICAL: While loading, show skeleton — never default to "locked"
  if (isLoading) {
    return <AnalyticsSummaryCardSkeleton />;
  }

  // On error, hide the card entirely (dashboard has its own error handling)
  if (error) {
    return null;
  }

  // Access is derived from the server response (store/business entitlement).
  // If access is null after loading without error, treat as free tier.
  const tier = access?.tier ?? 0;
  const canSeeInsights = access?.canSeeInsights ?? false;

  // Only show locked card if we have confirmed the tier is too low.
  // Apex (tier 3) and Momentum (tier 2) should NEVER see the locked card.
  if (!canSeeInsights && tier < 2) {
    return (
      <AnalyticsSummaryCardLocked
        onUpgrade={() => router.push('/vendor/subscription')}
      />
    );
  }

  if (summary) {
    const periodLabel =
      range === 'today' ? 'Today' : range === 'month' ? 'This Month' : 'This Week';

    return (
      <AnalyticsSummaryCard
        data={summary}
        periodLabel={periodLabel}
        onViewFull={() => router.push('/vendor/analytics')}
      />
    );
  }

  return null;
}
