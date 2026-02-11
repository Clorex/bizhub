'use client';

import { useState, useEffect } from 'react';
import { AnalyticsSummary } from '@/types/analytics';
import { ANALYTICS_CONFIG } from '@/config/analytics.config';

interface UseAnalyticsSummaryReturn {
  data: AnalyticsSummary | null;
  isLoading: boolean;
  error: string | null;
  isLocked: boolean;
  refetch: () => void;
}

/**
 * Hook to fetch analytics summary for dashboard card.
 */
export function useAnalyticsSummary(vendorId: string): UseAnalyticsSummaryReturn {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  const fetchData = async () => {
    if (!vendorId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${ANALYTICS_CONFIG.ENDPOINTS.SUMMARY}?vendor_id=${vendorId}`
      );

      const result = await response.json();

      if (response.status === 403) {
        setIsLocked(true);
        setData(null);
        return;
      }

      if (!response.ok) {
        setError(result.error || 'Failed to fetch analytics');
        setData(null);
        return;
      }

      if (result.success) {
        setData(result.data);
        setIsLocked(false);
      } else {
        setError(result.error || 'Unknown error');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [vendorId]);

  return { data, isLoading, error, isLocked, refetch: fetchData };
}