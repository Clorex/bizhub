'use client';

import { useState, useEffect, useCallback } from 'react';
import { auth } from '@/lib/firebase/client';
import {
  VendorAnalyticsResponse,
  adaptToSummary,
  adaptToSalesGrowth,
  adaptToRevenueBreakdown,
  adaptToConversion,
  adaptToTopProducts,
  adaptToEngagement,
  getAnalyticsAccess,
} from '@/lib/analytics/adapter';
import {
  AnalyticsSummary,
  SalesGrowthData,
  RevenueBreakdownData,
  ConversionData,
  TopProductsData,
  EngagementData,
} from '@/types/analytics';

type Range = 'today' | 'week' | 'month';

interface UseVendorAnalyticsReturn {
  // Raw response
  raw: VendorAnalyticsResponse | null;

  // Adapted data for components
  summary: AnalyticsSummary | null;
  salesGrowth: SalesGrowthData | null;
  revenueBreakdown: RevenueBreakdownData | null;
  conversion: ConversionData | null;
  topProducts: TopProductsData | null;
  engagement: EngagementData | null;

  // Access info
  access: ReturnType<typeof getAnalyticsAccess> | null;

  // State
  isLoading: boolean;
  error: string | null;
  notice: string | null;
  usedRange: Range;

  // Actions
  refetch: () => void;
  setRange: (range: Range) => void;
}

/**
 * Single hook that calls YOUR existing /api/vendor/analytics endpoint
 * and adapts the response for all analytics components.
 *
 * This replaces all the individual hooks from the batches.
 */
export function useVendorAnalytics(initialRange: Range = 'week'): UseVendorAnalyticsReturn {
  const [range, setRange] = useState<Range>(initialRange);
  const [raw, setRaw] = useState<VendorAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [usedRange, setUsedRange] = useState<Range>(initialRange);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setNotice(null);

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setError('Please log in to view analytics.');
        setIsLoading(false);
        return;
      }

      const response = await fetch(`/api/vendor/analytics?range=${range}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();

      if (!response.ok) {
        if (data?.code === 'VENDOR_LOCKED') {
          setError('Subscribe to access analytics.');
        } else {
          setError(data?.error || 'Could not load analytics.');
        }
        setRaw(null);
        setIsLoading(false);
        return;
      }

      if (!data.ok) {
        setError(data?.error || 'Analytics unavailable.');
        setRaw(null);
        setIsLoading(false);
        return;
      }

      setRaw(data as VendorAnalyticsResponse);

      if (data.meta?.notice) {
        setNotice(data.meta.notice);
      }

      const serverRange = String(data.meta?.usedRange || range) as Range;
      setUsedRange(serverRange);
    } catch (err: any) {
      setError(err?.message || 'Network error. Please try again.');
      setRaw(null);
    } finally {
      setIsLoading(false);
    }
  }, [range]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Adapt data for components
  const summary = raw ? adaptToSummary(raw) : null;
  const salesGrowth = raw ? adaptToSalesGrowth(raw) : null;
  const revenueBreakdown = raw ? adaptToRevenueBreakdown(raw) : null;
  const conversion = raw && raw.insights ? adaptToConversion(raw) : null;
  const topProducts = raw && raw.insights ? adaptToTopProducts(raw) : null;
  const engagement = raw ? adaptToEngagement(raw) : null;
  const access = raw ? getAnalyticsAccess(raw) : null;

  return {
    raw,
    summary,
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
    refetch: fetchData,
    setRange,
  };
}