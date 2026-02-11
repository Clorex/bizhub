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

  const tier = access?.tier ?? 0;
  const canSeeInsights = access?.canSeeInsights ?? false;

  if (isLoading) {
    return <AnalyticsSummaryCardSkeleton />;
  }

  if (error) {
    return null;
  }

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