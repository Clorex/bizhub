'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import GradientHeader from '@/components/GradientHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Card } from '@/components/Card';
import { Button } from '@/components/ui/Button';
import { SectionCard } from '@/components/ui/SectionCard';
import { PageSkeleton } from '@/components/vendor/PageSkeleton';

// Analytics components
import SalesGrowthSection from '@/components/analytics/sales-growth-section';
import RevenueBreakdownSection from '@/components/analytics/revenue-breakdown-section';
import ConversionSection from '@/components/analytics/conversion-section';
import TopProductsSection from '@/components/analytics/top-products-section';
import CustomerEngagementSection from '@/components/analytics/customer-engagement-section';
import LockedAnalyticsOverlay from '@/components/analytics/locked-analytics-overlay';

// Hook
import { useVendorAnalytics } from '@/hooks/use-vendor-analytics';
import { getTierDisplayName } from '@/lib/analytics/adapter';

// Icons
import {
  RefreshCw,
  AlertCircle,
  Gem,
  Lock,
  BarChart3,
  Bell,
} from 'lucide-react';
import { cn } from '@/lib/cn';

import '@/styles/analytics.css';
import '@/styles/charts.css';

type Range = 'today' | 'week' | 'month';

export default function VendorAnalyticsPage() {
  const router = useRouter();

  const {
    raw,
    salesGrowth,
    revenueBreakdown,
    conversion,
    topProducts,
    engagement,
    access,
    isLoading,
    error,
    notice,
    usedRange,
    refetch,
    setRange,
  } = useVendorAnalytics('week');

  const [refreshing, setRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const handleRangeChange = (newRange: Range) => {
    setRange(newRange);
  };

  // Access info from server (store/business entitlement — NOT viewer)
  const monthUnlocked = access?.canSeeMonthRange ?? false;
  const canSeeInsights = access?.canSeeInsights ?? false;
  const canSeeComparisons = access?.canSeeComparisons ?? false;
  const tierName = access ? getTierDisplayName(access.planKey) : 'Free';
  const tier = access?.tier ?? 0;

  // Whether to show upgrade prompts — only after loading is done
  // and only if the confirmed tier is below threshold
  const showUpgradePrompts = !isLoading && tier < 2;

  const periodLabel =
    usedRange === 'today' ? 'Today' : usedRange === 'month' ? 'This Month' : 'This Week';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <GradientHeader title="Analytics" subtitle="Loading your data..." showBack />
        <PageSkeleton />
      </div>
    );
  }

  if (error) {
    const isLocked = error.includes('Subscribe') || error.includes('locked');

    if (isLocked) {
      return (
        <div className="min-h-screen bg-gray-50">
          <GradientHeader title="Analytics" subtitle="Premium Feature" showBack />
          <LockedAnalyticsOverlay reason={error} />
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gray-50">
        <GradientHeader title="Analytics" subtitle="Something went wrong" showBack />
        <div className="px-4 pt-6">
          <Card className="p-6 bg-red-50 border-red-200">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-red-800">{error}</p>
                <Button variant="secondary" size="sm" className="mt-3" onClick={handleRefresh}>
                  Try Again
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-28 bg-gray-50">
      <GradientHeader
        title="Analytics"
        subtitle={`${tierName} Plan \u00B7 ${periodLabel}`}
        showBack
        right={
          <div className="flex items-center gap-2">
            {/* Only show upgrade gem for non-entitled tiers */}
            {showUpgradePrompts && (
              <button
                onClick={() => router.push('/vendor/subscription')}
                className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition"
                aria-label="Upgrade"
              >
                <Gem className="w-5 h-5 text-white" />
              </button>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center hover:bg-white/30 transition disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('w-5 h-5 text-white', refreshing && 'animate-spin')} />
            </button>
          </div>
        }
      />

      <div className="px-4 space-y-4 pt-4">
        <SegmentedControl<Range>
          value={usedRange}
          onChange={handleRangeChange}
          options={[
            { value: 'today', label: 'Today' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month', disabled: !monthUnlocked },
          ]}
        />

        {notice && (
          <Card className="p-4 bg-orange-50 border-orange-200">
            <div className="flex items-start gap-3">
              <Bell className="w-5 h-5 text-orange-600 shrink-0 mt-0.5" />
              <p className="text-sm text-orange-800">{notice}</p>
            </div>
          </Card>
        )}

        {/* Sales growth always visible (base feature) */}
        <SalesGrowthSection data={salesGrowth} />

        {/* Locked sections — only show locked card if confirmed non-entitled */}
        {canSeeInsights ? (
          <RevenueBreakdownSection data={revenueBreakdown} />
        ) : (
          <LockedSectionCard
            title="Revenue Breakdown"
            description="See which products drive the most revenue."
            requiredPlan="Momentum"
            onUpgrade={() => router.push('/vendor/subscription')}
          />
        )}

        {canSeeInsights ? (
          <ConversionSection data={conversion} />
        ) : (
          <LockedSectionCard
            title="Conversion Performance"
            description="Track how visitors become buyers."
            requiredPlan="Momentum"
            onUpgrade={() => router.push('/vendor/subscription')}
          />
        )}

        {canSeeInsights ? (
          <TopProductsSection data={topProducts} />
        ) : (
          <LockedSectionCard
            title="Top Performing Products"
            description="See your best sellers ranked by units sold."
            requiredPlan="Momentum"
            onUpgrade={() => router.push('/vendor/subscription')}
          />
        )}

        {canSeeInsights ? (
          <CustomerEngagementSection data={engagement} />
        ) : (
          <LockedSectionCard
            title="Customer Engagement"
            description="Understand visitor interest before they buy."
            requiredPlan="Momentum"
            onUpgrade={() => router.push('/vendor/subscription')}
          />
        )}

        {canSeeComparisons && raw?.comparisons && (
          <SectionCard title="Period Comparison" subtitle="Current vs Previous">
            <div className="grid grid-cols-2 gap-4">
              <ComparisonStat
                label="Revenue Change"
                value={raw.comparisons.deltas.revenueDelta}
                percentage={raw.comparisons.deltas.revenueDeltaPct}
                isCurrency
              />
              <ComparisonStat
                label="Orders Change"
                value={raw.comparisons.deltas.ordersDelta}
                percentage={raw.comparisons.deltas.ordersDeltaPct}
              />
            </div>
          </SectionCard>
        )}

        {raw?.checkin && (
          <SectionCard title={raw.checkin.title || 'Daily Check-in'}>
            <div className="space-y-2">
              {(raw.checkin.lines || []).map((line: string, i: number) => (
                <p key={i} className="text-sm text-gray-600">
                  {line}
                </p>
              ))}
              {raw.checkin.suggestion && (
                <div className="mt-3 flex items-start gap-2 text-sm text-gray-500 bg-gray-50 rounded-xl px-4 py-3">
                  <span className="flex-shrink-0">{"\uD83D\uDCA1"}</span>
                  <span>{raw.checkin.suggestion}</span>
                </div>
              )}
            </div>
          </SectionCard>
        )}

        {raw?.nudges && raw.nudges.length > 0 && (
          <SectionCard title="Notifications" subtitle="Things to act on">
            <div className="space-y-3">
              {raw.nudges.map((nudge: any) => (
                <Card
                  key={nudge.id}
                  className={cn(
                    'p-4',
                    nudge.tone === 'warn' ? 'bg-red-50 border-red-200' : 'bg-blue-50 border-blue-200'
                  )}
                >
                  <p
                    className={cn(
                      'text-sm font-bold',
                      nudge.tone === 'warn' ? 'text-red-800' : 'text-blue-800'
                    )}
                  >
                    {nudge.title}
                  </p>
                  <p
                    className={cn(
                      'text-xs mt-1',
                      nudge.tone === 'warn' ? 'text-red-600' : 'text-blue-600'
                    )}
                  >
                    {nudge.body}
                  </p>
                  {nudge.cta && (
                    <button
                      onClick={() => router.push(nudge.cta.url)}
                      className={cn(
                        'text-xs font-bold mt-2 underline',
                        nudge.tone === 'warn' ? 'text-red-700' : 'text-blue-700'
                      )}
                    >
                      {nudge.cta.label} {"\u2192"}
                    </button>
                  )}
                </Card>
              ))}
            </div>
          </SectionCard>
        )}

        {/* Bottom upgrade CTA — only for confirmed low-tier vendors */}
        {showUpgradePrompts && (
          <Card className="p-5 bg-gradient-to-br from-purple-50 to-orange-50 border-purple-100">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-orange-500 flex items-center justify-center shrink-0">
                <BarChart3 className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-gray-900">Unlock Deep Analytics</p>
                <p className="text-xs text-gray-600 mt-1">
                  Get revenue breakdown, conversion tracking, top products, and AI insights with
                  Momentum or Apex.
                </p>
                <Button size="sm" className="mt-3" onClick={() => router.push('/vendor/subscription')}>
                  View Plans {"\u2192"}
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

/* LockedSectionCard */

function LockedSectionCard({
  title,
  description,
  requiredPlan,
  onUpgrade,
}: {
  title: string;
  description: string;
  requiredPlan: string;
  onUpgrade: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5 relative overflow-hidden">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center shrink-0">
          <Lock className="w-5 h-5 text-gray-400" />
        </div>
        <div className="flex-1">
          <h3 className="text-base font-bold text-gray-800">{title}</h3>
          <p className="text-xs text-gray-500 mt-1">{description}</p>
          <p className="text-xs text-orange-500 font-semibold mt-2">
            Requires {requiredPlan} plan or higher
          </p>
          <button
            onClick={onUpgrade}
            className="mt-3 inline-flex items-center justify-center px-4 py-2 bg-orange-500 text-white text-xs font-semibold rounded-xl hover:bg-orange-600 transition"
          >
            Upgrade Now
          </button>
        </div>
      </div>
    </div>
  );
}

/* ComparisonStat */

function ComparisonStat({
  label,
  value,
  percentage,
  isCurrency = false,
}: {
  label: string;
  value: number;
  percentage: number | null;
  isCurrency?: boolean;
}) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const colorClass = isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-500';

  const sign = isPositive ? '+' : '';
  const displayValue = isCurrency
    ? `${sign}\u20A6${Math.abs(value).toLocaleString('en-NG')}`
    : `${sign}${value}`;

  return (
    <div className="bg-gray-50 rounded-xl p-3 text-center">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={cn('text-lg font-bold', colorClass)}>{displayValue}</p>
      {percentage !== null && percentage !== undefined && (
        <p className={cn('text-xs font-semibold mt-0.5', colorClass)}>
          {sign}
          {Math.round(percentage)}%
        </p>
      )}
    </div>
  );
}
