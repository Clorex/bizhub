'use client';

import { useState, useEffect } from 'react';
import { EngagementData } from '@/types/analytics';
import { ANALYTICS_CONFIG } from '@/config/analytics.config';

interface UseCustomerEngagementReturn {
  data: EngagementData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook to fetch customer engagement data.
 */
export function useCustomerEngagement(vendorId: string): UseCustomerEngagementReturn {
  const [data, setData] = useState<EngagementData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    if (!vendorId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${ANALYTICS_CONFIG.ENDPOINTS.CUSTOMER_ENGAGEMENT}?vendor_id=${vendorId}`
      );

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Failed to fetch engagement data');
        setData(null);
        return;
      }

      if (result.success) {
        setData(result.data);
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

  return { data, isLoading, error, refetch: fetchData };
}